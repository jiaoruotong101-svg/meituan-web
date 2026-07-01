"""CSV 导出器 - 从 SQLite 读取所有酒店，导出为 CSV。

输出路径: output/hotel_YYYYMMDD.csv (UTF-8 BOM，Excel 友好)
"""
from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import List, Optional

from loguru import logger

from storage.sqlite_db import Database, HOTEL_COLUMNS


OUTPUT_DIR = Path(__file__).resolve().parent.parent / "output"


def export_csv(city: Optional[str] = None, db: Optional[Database] = None) -> Path:
    """导出酒店数据为 CSV。

    Args:
        city: 指定城市，None 表示全部
        db: 复用已有 Database 连接，None 时新建
    Returns:
        生成的 CSV 文件路径
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    own_db = db is None
    if db is None:
        db = Database()

    try:
        rows = db.fetch_all_hotels(city=city)
        today = datetime.now().strftime("%Y%m%d")
        suffix = f"_{city}" if city else ""
        out_path = OUTPUT_DIR / f"hotel{suffix}_{today}.csv"

        # 用 pandas 导出（utf-8-sig 解决 Excel 中文乱码）
        try:
            import pandas as pd
            data = [dict(r) for r in rows]
            df = pd.DataFrame(data, columns=HOTEL_COLUMNS)
            df.to_csv(out_path, index=False, encoding="utf-8-sig")
        except ImportError:
            # pandas 不可用时降级到 csv 模块
            import csv
            with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.writer(f)
                writer.writerow(HOTEL_COLUMNS)
                for r in rows:
                    writer.writerow([r[c] for c in HOTEL_COLUMNS])
        logger.info(f"CSV 导出完成: {out_path} ({len(rows)} 行)")
        return out_path
    finally:
        if own_db:
            db.close()
