"""SQLite 存储层 - 直接写入 /home/z/my-project/db/custom.db。

表已由 Prisma 创建好（Hotel / CrawlSession / CrawlAlert），列名为驼峰式。
本模块只负责增删改查，不创建表。
"""
from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

from loguru import logger

# 数据库路径（与 Next.js / Prisma 共享）
# 相对路径：从本文件往上两级到项目根目录，再进 db/custom.db
# 这样对方解压到任何位置都能正常工作
DB_PATH = Path(__file__).resolve().parents[2] / "db" / "custom.db"

# Hotel 表所有列（顺序与 Hotel.to_sqlite_tuple() 一致）
HOTEL_COLUMNS = [
    "hotelId", "crawlTime", "city", "searchKeyword", "checkinDate", "checkoutDate",
    "name", "hotelType", "score", "scoreLabel", "reviewQuote", "locationDesc",
    "tags", "lowStockAlert", "originalPrice", "currentPrice", "consumptionCount",
    "bookingStatus", "promotions", "address", "openYear", "decorateYear", "starLevel",
    "facilities", "nearbyPois", "commentCount", "imageCount",
]
HOTEL_PLACEHOLDERS = ",".join(["?"] * len(HOTEL_COLUMNS))


class Database:
    """SQLite 操作封装（线程不安全，每个工作线程各自实例化）。"""

    def __init__(self, db_path: Path = DB_PATH):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        # check_same_thread=False 以便 mitmproxy 回调线程使用
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        logger.debug(f"已连接 SQLite: {self.db_path}")

    # ---------------- Hotel ----------------
    def upsert_hotel(self, hotel_tuple: Tuple) -> None:
        """插入或替换一条酒店记录。

        Args:
            hotel_tuple: 27 元素元组，顺序与 HOTEL_COLUMNS 对齐
        """
        if len(hotel_tuple) != len(HOTEL_COLUMNS):
            raise ValueError(
                f"hotel_tuple 长度 {len(hotel_tuple)} 与列数 {len(HOTEL_COLUMNS)} 不符"
            )
        sql = (
            f"INSERT OR REPLACE INTO Hotel ({','.join(HOTEL_COLUMNS)}) "
            f"VALUES ({HOTEL_PLACEHOLDERS})"
        )
        try:
            self.conn.execute(sql, hotel_tuple)
            self.conn.commit()
        except sqlite3.Error as e:
            logger.error(f"upsert_hotel 失败: {e}, hotelId={hotel_tuple[0]}")
            self.conn.rollback()
            raise

    def hotel_exists(self, hotel_id: str) -> bool:
        """判断某 hotelId 是否已存在。"""
        cur = self.conn.execute("SELECT 1 FROM Hotel WHERE hotelId=? LIMIT 1", (hotel_id,))
        return cur.fetchone() is not None

    def get_hotel_count(self, city: Optional[str] = None) -> int:
        """获取酒店总数（可选按城市过滤）。"""
        if city:
            cur = self.conn.execute("SELECT COUNT(*) FROM Hotel WHERE city=?", (city,))
        else:
            cur = self.conn.execute("SELECT COUNT(*) FROM Hotel")
        row = cur.fetchone()
        return int(row[0]) if row else 0

    def fetch_all_hotels(self, city: Optional[str] = None) -> List[sqlite3.Row]:
        """读取全部酒店（CSV 导出用）。"""
        if city:
            cur = self.conn.execute(
                f"SELECT {','.join(HOTEL_COLUMNS)} FROM Hotel WHERE city=? ORDER BY currentPrice DESC",
                (city,),
            )
        else:
            cur = self.conn.execute(
                f"SELECT {','.join(HOTEL_COLUMNS)} FROM Hotel ORDER BY currentPrice DESC"
            )
        return cur.fetchall()

    def fetch_all_hotels_by_city(self, city: str, limit: int = 200) -> List[tuple]:
        """读取指定城市的酒店元组（用于详情页爬取）。返回 tuple 列表。"""
        cur = self.conn.execute(
            f"SELECT {','.join(HOTEL_COLUMNS)} FROM Hotel WHERE city=? ORDER BY crawlTime DESC LIMIT ?",
            (city, limit),
        )
        return [tuple(r) for r in cur.fetchall()]

    # ---------------- CrawlSession ----------------
    def create_session(
        self,
        city: str,
        target: int = 200,
        checkin_date: Optional[str] = None,
        checkout_date: Optional[str] = None,
    ) -> str:
        """创建爬取会话，返回 session_id。"""
        session_id = f"s_{uuid.uuid4().hex[:16]}"
        started_at = int(datetime.now().timestamp() * 1000)  # 毫秒时间戳
        sql = (
            "INSERT INTO CrawlSession "
            "(id, city, startedAt, endedAt, hotelCount, targetCount, status, errorMsg, checkinDate, checkoutDate) "
            "VALUES (?, ?, ?, NULL, 0, ?, 'running', NULL, ?, ?)"
        )
        try:
            self.conn.execute(sql, (session_id, city, started_at, target, checkin_date, checkout_date))
            self.conn.commit()
            logger.info(f"创建 session: id={session_id} city={city} target={target}")
            return session_id
        except sqlite3.Error as e:
            logger.error(f"create_session 失败: {e}")
            self.conn.rollback()
            raise

    def update_session(
        self,
        session_id: str,
        hotel_count: Optional[int] = None,
        status: Optional[str] = None,
        error_msg: Optional[str] = None,
        ended: bool = False,
    ) -> None:
        """更新 session 字段。ended=True 时同时写 endedAt。"""
        sets: List[str] = []
        params: List = []
        if hotel_count is not None:
            sets.append("hotelCount=?")
            params.append(hotel_count)
        if status is not None:
            sets.append("status=?")
            params.append(status)
        if error_msg is not None:
            sets.append("errorMsg=?")
            params.append(error_msg)
        if ended:
            sets.append("endedAt=?")
            params.append(int(datetime.now().timestamp() * 1000))  # 毫秒时间戳
            if status is None:
                sets.append("status=?")
                params.append("completed" if error_msg is None else "failed")
        if not sets:
            return
        params.append(session_id)
        sql = f"UPDATE CrawlSession SET {','.join(sets)} WHERE id=?"
        try:
            self.conn.execute(sql, params)
            self.conn.commit()
        except sqlite3.Error as e:
            logger.error(f"update_session 失败: {e}")
            self.conn.rollback()

    def get_session(self, session_id: str) -> Optional[sqlite3.Row]:
        cur = self.conn.execute("SELECT * FROM CrawlSession WHERE id=?", (session_id,))
        return cur.fetchone()

    # ---------------- CrawlAlert ----------------
    def add_alert(
        self,
        alert_type: str,
        message: str,
        city: Optional[str] = None,
    ) -> str:
        """新增风控告警记录。

        Args:
            alert_type: captcha / rate_limit / error / network
            message: 告警详情
            city: 关联城市（可选）
        Returns:
            alert_id
        """
        alert_id = f"a_{uuid.uuid4().hex[:16]}"
        created_at = int(datetime.now().timestamp() * 1000)  # 毫秒时间戳
        sql = (
            "INSERT INTO CrawlAlert (id, type, message, city, resolved, createdAt) "
            "VALUES (?, ?, ?, ?, 0, ?)"
        )
        try:
            self.conn.execute(sql, (alert_id, alert_type, message, city, created_at))
            self.conn.commit()
            logger.warning(f"[ALERT] type={alert_type} city={city} msg={message}")
            return alert_id
        except sqlite3.Error as e:
            logger.error(f"add_alert 失败: {e}")
            self.conn.rollback()
            raise

    def fetch_unresolved_alerts(self, city: Optional[str] = None) -> List[sqlite3.Row]:
        if city:
            cur = self.conn.execute(
                "SELECT * FROM CrawlAlert WHERE resolved=0 AND city=? ORDER BY createdAt DESC",
                (city,),
            )
        else:
            cur = self.conn.execute(
                "SELECT * FROM CrawlAlert WHERE resolved=0 ORDER BY createdAt DESC"
            )
        return cur.fetchall()

    # ---------------- Stats ----------------
    def stats(self) -> dict:
        """汇总统计（CLI status 用）。"""
        cur = self.conn.execute(
            "SELECT city, COUNT(*) AS n, AVG(currentPrice) AS avg_price, AVG(score) AS avg_score "
            "FROM Hotel GROUP BY city ORDER BY n DESC"
        )
        by_city = [dict(r) for r in cur.fetchall()]
        total = self.get_hotel_count()
        sess_cur = self.conn.execute(
            "SELECT status, COUNT(*) AS n FROM CrawlSession GROUP BY status"
        )
        sessions = {r["status"]: r["n"] for r in sess_cur.fetchall()}
        alert_cur = self.conn.execute(
            "SELECT COUNT(*) AS n FROM CrawlAlert WHERE resolved=0"
        )
        unresolved_alerts = int(alert_cur.fetchone()["n"])
        return {
            "total_hotels": total,
            "by_city": by_city,
            "sessions": sessions,
            "unresolved_alerts": unresolved_alerts,
        }

    def close(self) -> None:
        try:
            self.conn.close()
        except Exception:
            pass
