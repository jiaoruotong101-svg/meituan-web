"""Hotel 数据模型 (Pydantic)，对齐 Prisma schema。

字段顺序与 storage.sqlite_db 的 INSERT 语句列顺序一致，
通过 `to_sqlite_tuple()` 返回元组供参数化插入。

重要：Prisma SQLite 的 DateTime 字段存的是**毫秒时间戳（整数）**，
不是 ISO 字符串。所有时间字段必须转成 int 毫秒。
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator


def _now_ms() -> int:
    """当前时间转毫秒时间戳（Prisma SQLite DateTime 格式）。"""
    return int(datetime.now().timestamp() * 1000)


def _to_json_str(value: Any) -> str:
    """将 list/dict 转为 JSON 字符串，None 视作空列表。"""
    if value is None:
        return "[]"
    if isinstance(value, str):
        # 已经是字符串，做一次校验
        try:
            json.loads(value)
            return value
        except Exception:
            return json.dumps([value], ensure_ascii=False)
    return json.dumps(value, ensure_ascii=False)


class Hotel(BaseModel):
    """Hotel 实体，对应 SQLite 表 Hotel（驼峰列名）。"""

    hotelId: str
    crawlTime: int = Field(default_factory=_now_ms)  # 毫秒时间戳
    city: str
    searchKeyword: Optional[str] = None
    checkinDate: Optional[str] = None
    checkoutDate: Optional[str] = None
    name: str
    hotelType: Any = "[]"
    score: Optional[float] = None
    scoreLabel: Optional[str] = None
    reviewQuote: Optional[str] = None
    locationDesc: Optional[str] = None
    tags: Any = "[]"
    lowStockAlert: Optional[str] = None
    originalPrice: Optional[float] = None
    currentPrice: float = 0.0
    consumptionCount: Optional[str] = None
    bookingStatus: Optional[str] = None
    promotions: Any = "[]"
    address: Optional[str] = None
    openYear: Optional[str] = None
    decorateYear: Optional[str] = None
    starLevel: Optional[str] = None
    facilities: Any = "[]"
    nearbyPois: Any = "[]"
    commentCount: int = 0
    imageCount: int = 0

    # ---- 校验器：把 list/dict 字段统一序列化为 JSON 字符串 ----
    @field_validator("hotelType", "tags", "promotions", "facilities", "nearbyPois", mode="before")
    @classmethod
    def _normalize_json_field(cls, v: Any) -> str:
        return _to_json_str(v)

    def to_sqlite_tuple(self) -> tuple:
        """按 INSERT 列顺序返回元组（27 个字段）。"""
        return (
            self.hotelId,
            self.crawlTime,
            self.city,
            self.searchKeyword,
            self.checkinDate,
            self.checkoutDate,
            self.name,
            self.hotelType,
            self.score,
            self.scoreLabel,
            self.reviewQuote,
            self.locationDesc,
            self.tags,
            self.lowStockAlert,
            self.originalPrice,
            self.currentPrice,
            self.consumptionCount,
            self.bookingStatus,
            self.promotions,
            self.address,
            self.openYear,
            self.decorateYear,
            self.starLevel,
            self.facilities,
            self.nearbyPois,
            self.commentCount,
            self.imageCount,
        )

    @staticmethod
    def column_list() -> List[str]:
        """返回与 to_sqlite_tuple 顺序对齐的列名列表。"""
        return [
            "hotelId", "crawlTime", "city", "searchKeyword", "checkinDate", "checkoutDate",
            "name", "hotelType", "score", "scoreLabel", "reviewQuote", "locationDesc",
            "tags", "lowStockAlert", "originalPrice", "currentPrice", "consumptionCount",
            "bookingStatus", "promotions", "address", "openYear", "decorateYear", "starLevel",
            "facilities", "nearbyPois", "commentCount", "imageCount",
        ]

    @classmethod
    def from_sqlite_tuple(cls, row: tuple) -> "Hotel":
        """从 SQLite 查询结果元组重建 Hotel 对象。顺序同 column_list。"""
        cols = cls.column_list()
        data = dict(zip(cols, row))
        # 处理 None
        for k, v in data.items():
            if v is None and k in ("hotelType", "tags", "promotions", "facilities", "nearbyPois"):
                data[k] = "[]"
        return cls(**data)


class CrawlSessionInfo(BaseModel):
    """CrawlSession 表对应模型（仅用于类型提示，实际入库走 Database 类）。"""

    id: str
    city: str
    startedAt: int = Field(default_factory=_now_ms)  # 毫秒时间戳
    endedAt: Optional[int] = None
    hotelCount: int = 0
    targetCount: int = 200
    status: str = "pending"
    errorMsg: Optional[str] = None
    checkinDate: Optional[str] = None
    checkoutDate: Optional[str] = None


class CrawlAlertInfo(BaseModel):
    """CrawlAlert 表对应模型。"""

    id: str
    type: str  # captcha / rate_limit / error / network
    message: str
    city: Optional[str] = None
    resolved: int = 0
    createdAt: int = Field(default_factory=_now_ms)  # 毫秒时间戳
