"""断点续爬 - 记录每个 (city, keyword) 的最后抓取位置。

存储格式 (output/checkpoint.json):
    {
      "天津_天津站": {"last_page": 3, "last_hotel_id": "abc123", "updated_at": "..."},
      ...
    }
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from loguru import logger


CHECKPOINT_PATH = Path(__file__).resolve().parent.parent / "output" / "checkpoint.json"


class Checkpoint:
    """断点续爬管理器。"""

    def __init__(self, path: Path = CHECKPOINT_PATH):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._data: Dict[str, Dict] = self._load()

    def _load(self) -> Dict[str, Dict]:
        if not self.path.exists():
            return {}
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"读取 checkpoint 失败: {e}，重新开始")
            return {}

    def _save(self) -> None:
        try:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"写入 checkpoint 失败: {e}")

    @staticmethod
    def _key(city: str, keyword: str) -> str:
        return f"{city}_{keyword}"

    def get(self, city: str, keyword: str) -> Dict:
        """返回该 (city, keyword) 的进度，不存在则返回空 dict。"""
        return self._data.get(self._key(city, keyword), {})

    def get_last_page(self, city: str, keyword: str) -> int:
        return int(self.get(city, keyword).get("last_page", 0))

    def update(
        self,
        city: str,
        keyword: str,
        last_page: Optional[int] = None,
        last_hotel_id: Optional[str] = None,
    ) -> None:
        key = self._key(city, keyword)
        entry = self._data.get(key, {})
        if last_page is not None:
            entry["last_page"] = last_page
        if last_hotel_id is not None:
            entry["last_hotel_id"] = last_hotel_id
        entry["updated_at"] = datetime.now().isoformat(timespec="seconds")
        self._data[key] = entry
        self._save()

    def reset(self, city: Optional[str] = None, keyword: Optional[str] = None) -> None:
        """清除断点。city/keyword 都为 None 时清空全部。"""
        if city is None and keyword is None:
            self._data = {}
        else:
            key = self._key(city or "", keyword or "")
            self._data.pop(key, None)
        self._save()

    def all_progress(self) -> Dict[str, Dict]:
        """返回全部进度（CLI 展示用）。"""
        return dict(self._data)
