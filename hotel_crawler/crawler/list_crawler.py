"""美团酒店列表页爬取 - 滑动加载 + 解析酒店卡片。"""
from __future__ import annotations

import json
import random
import re
from datetime import datetime
from typing import List, Optional
from urllib.parse import quote

from loguru import logger
from playwright.sync_api import Page, ElementHandle

from parser.schema import Hotel
from storage.sqlite_db import Database


# 列表页 URL 模板
# 用 search.html 入口，会先显示城市选择页面，再进入列表
# cityId: 城市ID
# checkIn/checkOut: YYYY-MM-DD
# lat/lng: 城市中心坐标（可选，影响"距离"排序）
LIST_URL_TEMPLATE = (
    "https://i.meituan.com/awp/h5/hotel/search/search.html?"
    "cityId={city_id}"
    "&checkIn={checkin}&checkOut={checkout}"
    "&accommodationType=1&sort=smart"
)


class ListCrawler:
    """爬取酒店列表页。"""

    def __init__(self, page: Page, db: Database, city: str, city_id: int):
        self.page = page
        self.db = db
        self.city = city
        self.city_id = city_id

    def build_url(self, checkin: str, checkout: str) -> str:
        return LIST_URL_TEMPLATE.format(
            city_id=self.city_id,
            checkin=checkin,
            checkout=checkout,
        )

    def crawl(
        self,
        checkin: str,
        checkout: str,
        target: int = 200,
        on_progress=None,
    ) -> int:
        """爬取列表页，返回新增酒店数。

        Args:
            checkin: 入住日期 YYYY-MM-DD
            checkout: 离店日期 YYYY-MM-DD
            target: 目标酒店数
            on_progress: 回调函数 (current, total) -> None
        """
        url = self.build_url(checkin, checkout)
        logger.info(f"访问列表页: {url}")
        try:
            self.page.goto(url, wait_until="domcontentloaded", timeout=30000)
        except Exception as e:
            logger.error(f"访问列表页失败: {e}")
            return 0

        # 检查是否被跳到登录页
        if "passport.meituan.com" in self.page.url:
            logger.error("被跳转到登录页，登录状态失效")
            self._save_debug_screenshot("login_redirect")
            return 0

        # 等待页面稳定（search.html 可能需要点"查找酒店"按钮）
        self.page.wait_for_timeout(3000)
        logger.info(f"当前 URL: {self.page.url}")
        logger.info(f"页面标题: {self.page.title()}")

        # 如果是搜索入口页，尝试点"查找酒店"按钮
        self._try_click_search_button()

        # 等待酒店卡片加载
        cards_found = self._wait_for_hotel_cards(timeout=15000)
        if not cards_found:
            logger.error("等待酒店卡片超时，页面可能未正常加载")
        # 调试信息：只在没找到卡片时输出，避免长页面崩溃
        if not cards_found:
            try:
                body_text = self.page.evaluate("() => document.body.innerText.slice(0, 1000)")
                logger.info(f"页面文本预览:\n{body_text}")
            except Exception:
                pass

        if not cards_found:
            return 0

        collected = 0
        seen_ids = set()
        no_new_count = 0
        max_no_new = 10  # 连续 10 次没新酒店就停止

        while collected < target and no_new_count < max_no_new:
            # 解析当前页面所有酒店卡片
            new_hotels = self._parse_hotel_cards(seen_ids, checkin, checkout)
            if new_hotels:
                for h in new_hotels:
                    seen_ids.add(h.hotelId)
                    self.db.upsert_hotel(h.to_sqlite_tuple())
                    collected += 1
                    if on_progress:
                        on_progress(collected, target)
                    logger.info(f"[{collected}/{target}] {h.name} ¥{h.currentPrice}")
                no_new_count = 0
            else:
                no_new_count += 1
                logger.debug(f"本次无新酒店（{no_new_count}/{max_no_new}）")

            if collected >= target:
                break

            # 滑动加载下一页
            self._swipe_to_load_more()
            # 随机停顿 1-3 秒
            self.page.wait_for_timeout(random.randint(1000, 3000))

        logger.info(f"列表页爬取完成，共 {collected} 家酒店")
        return collected

    def _try_click_search_button(self) -> None:
        """搜索入口页可能有「查找酒店」按钮，尝试点击进入列表。"""
        try:
            # 找"查找酒店"按钮
            btn = self.page.get_by_text("查找酒店", exact=False).first
            if btn:
                btn.click(timeout=3000)
                logger.info("已点击「查找酒店」按钮")
                self.page.wait_for_timeout(3000)
                return
        except Exception:
            pass
        # 兜底：找带"搜索"文字的按钮
        try:
            btn = self.page.get_by_role("button", name="搜索").first
            if btn:
                btn.click(timeout=3000)
                logger.info("已点击「搜索」按钮")
                self.page.wait_for_timeout(3000)
        except Exception:
            pass

    def _save_debug_screenshot(self, tag: str = "debug") -> None:
        """保存调试截图到 output/ 目录（只截可视区域，避免长页面崩溃）。"""
        from pathlib import Path
        from datetime import datetime
        out_dir = Path(__file__).resolve().parents[1] / "output"
        out_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = out_dir / f"debug_{tag}_{ts}.png"
        try:
            # 只截可视区域，不要 full_page（长页面会撑爆内存导致浏览器崩溃）
            self.page.screenshot(path=str(path), full_page=False)
            logger.info(f"调试截图已保存: {path}")
        except Exception as e:
            logger.warning(f"截图失败: {e}")

    def _save_debug_html(self, tag: str = "debug") -> None:
        """保存调试 HTML 到 output/ 目录。"""
        from pathlib import Path
        from datetime import datetime
        out_dir = Path(__file__).resolve().parents[1] / "output"
        out_dir.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = out_dir / f"debug_{tag}_{ts}.html"
        try:
            html = self.page.content()
            path.write_text(html, encoding="utf-8")
            logger.info(f"调试 HTML 已保存: {path}")
        except Exception as e:
            logger.warning(f"保存 HTML 失败: {e}")

    def _wait_for_hotel_cards(self, timeout: int = 15000) -> bool:
        """等待页面加载出酒店内容。

        新策略：不再依赖 DOM 选择器（美团用 React + 动态 class），
        而是等页面 innerText 里出现「¥XX起」这种价格关键字，
        说明酒店数据已渲染完成。
        """
        import time
        deadline = time.time() + timeout / 1000
        while time.time() < deadline:
            try:
                text = self.page.evaluate("() => document.body.innerText") or ""
                # 价格关键字出现说明酒店列表已加载
                if "¥" in text and "起" in text:
                    logger.info("检测到酒店价格关键字，页面已加载")
                    return True
                # 也可能页面在 loading
                if "加载中" in text or "loading" in text.lower():
                    pass
            except Exception:
                pass
            self.page.wait_for_timeout(1500)
        # 最后再检查一次
        try:
            text = self.page.evaluate("() => document.body.innerText") or ""
            if "¥" in text and "起" in text:
                return True
        except Exception:
            pass
        return False

    def _parse_hotel_cards(
        self, seen_ids: set, checkin: str, checkout: str
    ) -> List[Hotel]:
        """解析当前可视区域的所有酒店卡片。

        策略：美团 H5 是 React 渲染，class 是动态 hash，querySelector 找不到稳定选择器。
        改用整页 innerText，按「¥XX起」分隔符切分成酒店块，每块单独正则解析。
        这是目前最稳的方案。
        """
        hotels = []
        try:
            full_text = self.page.evaluate("() => document.body.innerText") or ""
        except Exception as e:
            logger.warning(f"获取页面文本失败: {e}")
            return hotels

        if not full_text:
            return hotels

        # 用正则把整页文本切成酒店块
        # 每个酒店块以「酒店名」开头，以「¥XX起」+ 可能的后续行结尾
        # 实测分隔符：价格行「¥123起」后通常跟「X分钟前有人预订」「订XXX」等
        import re as _re
        # 按 ¥XX起 分割，每个酒店块 = 上一段（从酒店名到 ¥XX起）
        # 用正则找到所有酒店块：从酒店名（含括号店名）到 ¥XX起 之间的内容
        # 美团酒店名特征：常含「酒店」「公寓」「民宿」「客栈」「宾馆」「旅舍」「快捷」「精品」等
        pattern = _re.compile(
            r'([^\n]{4,50}(?:酒店|公寓|民宿|客栈|宾馆|旅舍|快捷|精品|公馆|假日|住宿|旅馆|套房|别墅|Inn|Hotel)[^\n]{0,40})'
            r'(.*?)(¥\s*\d+\s*起)',
            _re.DOTALL
        )
        matches = pattern.findall(full_text)
        logger.info(f"文本切分：找到 {len(matches)} 个酒店块")

        for i, (name, middle, price_str) in enumerate(matches):
            # 酒店名清理
            name = name.strip()
            # 生成 hotelId：用酒店名 hash（滑动加载后同名酒店 id 一致，自动去重）
            hotel_id = 'mt_' + str(abs(hash(name)) % (10 ** 12))
            if hotel_id in seen_ids:
                continue

            # middle 包含：评分、消费量、位置、预订状态等
            block = name + "\n" + middle + "\n" + price_str
            hotel = self._parse_card_text(hotel_id, block, checkin, checkout)
            if hotel:
                hotels.append(hotel)
        return hotels

    def _parse_card_text(
        self, hotel_id: str, text: str, checkin: str, checkout: str
    ) -> Optional[Hotel]:
        """从卡片文本内容解析酒店信息。

        实测美团 H5 列表页格式：
            聚贤海棠·民宿公寓(天津滨江道五大道店)
            4.9分 很好
            5000+消费
            距市中心直线3.4公里 · 近营口道地铁站a出口 · 滨江道/小白楼/五大道周边
            ¥123起
            3小时前有人预订
            订近地铁严选好店
        """
        lines = [l.strip() for l in text.split("\n") if l.strip()]
        if not lines:
            return None

        # 酒店名：第一行
        name = lines[0]
        if len(name) < 3:
            return None

        full = text

        # 评分：4.9分 很好 / 4.5分 开窗就能看到天津站对面的海河
        score = None
        score_label = None
        m = re.search(r"(\d\.\d)分\s*(超棒|棒|不错|很好|一般)?", full)
        if m:
            try:
                score = float(m.group(1))
                score_label = m.group(2)
            except ValueError:
                pass

        # 现价：¥123起 / ¥126起
        current_price = None
        m = re.search(r"¥\s*(\d+)\s*起", full)
        if m:
            try:
                current_price = float(m.group(1))
            except ValueError:
                pass

        # 原价（划线价，列表页少见，但保留）
        original_price = None
        m = re.search(r"¥\s*(\d+)\s*¥\s*(\d+)\s*起", full)
        if m:
            try:
                original_price = float(m.group(1))
                current_price = float(m.group(2))
            except ValueError:
                pass

        # 消费量：5000+消费 / 3万+消费 / 1万+消费
        consumption_count = None
        m = re.search(r"(\d+(?:\.\d+)?[万千]?\+消费)", full)
        if m:
            consumption_count = m.group(1)

        # 位置：距市中心直线3.4公里 · 近营口道地铁站a出口 · 滨江道/小白楼/五大道周边
        location_desc = None
        m = re.search(r"(距[^\n]{2,80})", full)
        if m:
            location_desc = m.group(1).strip()
            # 截断到第一个 · 之后太多
            if "·" in location_desc:
                parts = location_desc.split("·")
                location_desc = parts[0].strip() + " · " + (parts[1].strip() if len(parts) > 1 else "")

        # 预订状态：3小时前有人预订 / 34分钟前有人预订 / 5分钟前有人预订
        booking_status = None
        m = re.search(r"(\d+(?:分钟|小时)前有人预订)", full)
        if m:
            booking_status = m.group(1)

        # 标签：订近地铁严选好店 / 订行李寄存近地铁 / 讴叫醒服务洗衣房
        tags = []
        for line in lines:
            if line.startswith("订") and len(line) < 30:
                # 去掉"订"前缀，按 2-4 字一组切（美团标签通常 2-4 字）
                tag_text = line[1:]
                # 简单切分：常见标签词
                known_tags = ["近地铁", "严选好店", "行李寄存", "叫醒服务", "洗衣房",
                              "免费停车场", "停车场", "影音房", "影音酒店", "外宾适用",
                              "黄金会员", "神券商家", "即时确认", "千兆网络", "钟点房"]
                for kt in known_tags:
                    if kt in tag_text:
                        tags.append(kt)
                # 如果没匹配到已知标签，整个 tag_text 作为一个标签
                if not tags and tag_text:
                    tags.append(tag_text[:8])

        # 评论数（列表页一般没有，详情页才有）
        comment_count = 0
        m = re.search(r"(\d+)\s*条评论", full)
        if m:
            try:
                comment_count = int(m.group(1))
            except ValueError:
                pass

        # 构造 Hotel 对象
        import json as _json
        from datetime import datetime as _dt
        return Hotel(
            hotelId=str(hotel_id),
            crawlTime=int(_dt.now().timestamp() * 1000),  # 毫秒时间戳
            city=self.city,
            searchKeyword=None,
            checkinDate=checkin,
            checkoutDate=checkout,
            name=name,
            hotelType=_json.dumps([], ensure_ascii=False),
            score=score,
            scoreLabel=score_label,
            reviewQuote=None,
            locationDesc=location_desc,
            tags=_json.dumps(tags, ensure_ascii=False),
            lowStockAlert=None,
            originalPrice=original_price,
            currentPrice=current_price if current_price else 0,
            consumptionCount=consumption_count,
            bookingStatus=booking_status,
            promotions=_json.dumps([], ensure_ascii=False),
            address=None,
            openYear=None,
            decorateYear=None,
            starLevel=None,
            facilities=_json.dumps([], ensure_ascii=False),
            nearbyPois=_json.dumps([], ensure_ascii=False),
            commentCount=comment_count,
            imageCount=0,
        )

    def _swipe_to_load_more(self) -> None:
        """滑动到底部加载更多酒店。"""
        try:
            # 方案 1：滚动 window
            self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            self.page.wait_for_timeout(1500)
            # 方案 2：模拟触摸滑动（移动端）
            self.page.evaluate(
                """() => {
                    const el = document.elementFromPoint(200, 600);
                    if (el) {
                        const evt = new TouchEvent('touchstart', {bubbles: true});
                        el.dispatchEvent(evt);
                    }
                    window.scrollBy(0, -800);
                }"""
            )
            self.page.wait_for_timeout(500)
            # 再滑到底
            self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        except Exception as e:
            logger.debug(f"滑动异常（通常无碍）: {e}")
