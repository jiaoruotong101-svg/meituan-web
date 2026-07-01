"""美团酒店详情页爬取 - 获取评论数、地址、设施等完整字段。"""
from __future__ import annotations

import json
import re
from datetime import datetime
from typing import Optional

from loguru import logger
from playwright.sync_api import Page

from parser.schema import Hotel
from storage.sqlite_db import Database


class DetailCrawler:
    """爬取单个酒店详情页。"""

    def __init__(self, page: Page, db: Database):
        self.page = page
        self.db = db

    def crawl(self, hotel: Hotel) -> bool:
        """爬取一个酒店的详情页，更新数据库。

        Args:
            hotel: 酒店对象（需要有 hotelId 和 name）

        Returns:
            是否成功
        """
        detail_url = f"https://i.meituan.com/awp/h5/hotel/detail/detail.html?poiId={hotel.hotelId}"
        logger.info(f"爬取详情: {hotel.name} -> {detail_url}")
        try:
            self.page.goto(detail_url, wait_until="domcontentloaded", timeout=20000)
        except Exception as e:
            logger.warning(f"访问详情页失败: {e}")
            return False

        # 检查是否跳登录
        if "passport.meituan.com" in self.page.url:
            logger.warning("详情页跳登录，跳过")
            return False

        # 等待页面加载
        self.page.wait_for_timeout(3000)

        # 提取详情字段
        try:
            detail_data = self.page.evaluate(
                """() => {
                    const text = document.body.innerText || '';
                    return { text: text, html: document.documentElement.outerHTML.slice(0, 5000) };
                }"""
            )
        except Exception as e:
            logger.warning(f"提取详情文本失败: {e}")
            return False

        text = detail_data.get("text", "")
        self._update_hotel_from_detail(hotel, text)
        # 写回数据库
        self.db.upsert_hotel(hotel.to_sqlite_tuple())
        return True

    def _update_hotel_from_detail(self, hotel: Hotel, text: str) -> None:
        """从详情页文本提取字段，更新 hotel 对象。"""
        # 地址
        m = re.search(r"地址[:：\s]*([\u4e00-\u9fa5\w\d号路街区市镇村]+)", text)
        if m:
            hotel.address = m.group(1).strip()

        # 开业年份
        m = re.search(r"(20\d{2})\s*年(?:开业|新开)", text)
        if m:
            hotel.openYear = m.group(1) + "年"

        # 装修年份
        m = re.search(r"(20\d{2})\s*年装修", text)
        if m:
            hotel.decorateYear = m.group(1) + "年"

        # 星级
        m = re.search(r"(五|四|三|二一)星级|(\d)\s*星", text)
        if m:
            hotel.starLevel = m.group(0)

        # 评论数
        m = re.search(r"(\d+)\s*条评论", text)
        if m:
            try:
                hotel.commentCount = int(m.group(1))
            except ValueError:
                pass

        # 图片数
        m = re.search(r"(\d+)\s*张图片", text)
        if m:
            try:
                hotel.imageCount = int(m.group(1))
            except ValueError:
                pass

        # 设施（粗略提取）
        facilities = []
        facility_keywords = [
            "24小时热水", "空调", "吹风机", "拖鞋", "洗衣服务",
            "商务中心", "会议室", "停车场", "免费停车", "WiFi",
            "免费wifi", "早餐", "健身房", "游泳池", "电梯",
            "前台寄存", "叫醒服务", "行李寄存", "叫车服务",
        ]
        for kw in facility_keywords:
            if kw in text:
                facilities.append(kw)
        if facilities:
            hotel.facilities = json.dumps(facilities, ensure_ascii=False)

        # 附近 POI
        nearby = []
        for m in re.finditer(r"距(?:离)?([\u4e00-\u9fa5\w]{2,15})\s*(?:约|大约)?\s*(\d+(?:\.\d+)?)\s*(km|米|m)", text):
            nearby.append(f"{m.group(1)} {m.group(2)}{m.group(3)}")
        if nearby:
            hotel.nearbyPois = json.dumps(nearby[:10], ensure_ascii=False)
