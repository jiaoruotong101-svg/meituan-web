"""数据库修复脚本 - 把所有 ISO 字符串时间戳转成整数毫秒时间戳。

问题：旧版爬虫写入的 crawlTime/startedAt/endedAt/createdAt 是 ISO 字符串，
Prisma 期望整数毫秒时间戳，导致看板 API 报 P2023 错误。

用法：python fix_timestamps.py
"""
from __future__ import annotations

import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# 数据库路径（与 sqlite_db.py 一致）
DB_PATH = Path(__file__).resolve().parents[1] / "db" / "custom.db"


def is_iso_string(value) -> bool:
    """判断值是否是 ISO 字符串格式（如 2026-06-28T19:04:23.730353）。"""
    if not isinstance(value, str):
        return False
    return "T" in value and ("-" in value or ":" in value)


def iso_to_ms(iso_str: str) -> int:
    """ISO 字符串转毫秒时间戳。"""
    try:
        # 处理各种 ISO 格式
        s = iso_str.strip()
        # 去掉时区后缀（如果有）
        if s.endswith("Z"):
            s = s[:-1]
        dt = datetime.fromisoformat(s)
        return int(dt.timestamp() * 1000)
    except Exception:
        return 0


def fix_table(conn, table: str, id_col: str, time_cols: list) -> int:
    """修复指定表的时间字段。返回修复的行数。"""
    fixed = 0
    for col in time_cols:
        cur = conn.execute(f"SELECT {id_col}, {col} FROM {table} WHERE {col} IS NOT NULL")
        rows = cur.fetchall()
        for row_id, val in rows:
            if is_iso_string(val):
                ms = iso_to_ms(val)
                if ms > 0:
                    conn.execute(
                        f"UPDATE {table} SET {col}=? WHERE {id_col}=?",
                        (ms, row_id),
                    )
                    fixed += 1
                    print(f"  修复 {table}.{col}: {val} -> {ms}")
    return fixed


def main():
    if not DB_PATH.exists():
        print(f"❌ 数据库不存在: {DB_PATH}")
        sys.exit(1)

    print(f"🔧 修复数据库: {DB_PATH}")
    conn = sqlite3.connect(str(DB_PATH))

    total_fixed = 0
    print("\n📋 修复 Hotel.crawlTime ...")
    total_fixed += fix_table(conn, "Hotel", "hotelId", ["crawlTime"])

    print("\n📋 修复 CrawlSession.startedAt / endedAt ...")
    total_fixed += fix_table(conn, "CrawlSession", "id", ["startedAt", "endedAt"])

    print("\n📋 修复 CrawlAlert.createdAt ...")
    total_fixed += fix_table(conn, "CrawlAlert", "id", ["createdAt"])

    conn.commit()

    # 验证
    print("\n✅ 修复完成，验证结果：")
    cur = conn.execute("SELECT COUNT(*) FROM Hotel")
    print(f"  Hotel 总数: {cur.fetchone()[0]}")
    cur = conn.execute("SELECT city, COUNT(*) FROM Hotel GROUP BY city")
    for city, n in cur.fetchall():
        print(f"    {city}: {n} 家")
    # 检查是否还有 ISO 字符串
    cur = conn.execute(
        "SELECT COUNT(*) FROM Hotel WHERE typeof(crawlTime)='text' AND crawlTime LIKE '%T%'"
    )
    remaining = cur.fetchone()[0]
    print(f"  剩余 ISO 字符串记录: {remaining}")

    conn.close()
    print(f"\n🎉 共修复 {total_fixed} 条记录")
    if remaining > 0:
        print(f"⚠️  还有 {remaining} 条未修复，请重跑此脚本")
    else:
        print("✅ 所有时间字段已转为整数毫秒时间戳，看板应该能正常显示了")


if __name__ == "__main__":
    main()
