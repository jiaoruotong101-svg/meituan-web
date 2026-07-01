"""Playwright 浏览器管理 - 启动、上下文、登录状态保存。"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from loguru import logger
from playwright.sync_api import sync_playwright, Browser, BrowserContext, Page

PROJECT_ROOT = Path(__file__).resolve().parents[1]
AUTH_STATE_DIR = PROJECT_ROOT / "config" / ".auth"
AUTH_STATE_FILE = AUTH_STATE_DIR / "meituan_state.json"


class BrowserManager:
    """管理 Playwright 浏览器生命周期和登录状态。"""

    def __init__(self, headless: bool = False, device: str = "iPhone 14"):
        self.headless = headless
        self.device = device
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._context: Optional[BrowserContext] = None
        self._page: Optional[Page] = None
        AUTH_STATE_DIR.mkdir(parents=True, exist_ok=True)

    def start(self) -> bool:
        """启动浏览器，加载已保存的登录状态。"""
        try:
            self._playwright = sync_playwright().start()
            self._browser = self._playwright.chromium.launch(
                headless=self.headless,
                args=["--disable-blink-features=AutomationControlled"],
            )
            # 用移动设备模拟，更像真实用户
            device = self._playwright.devices.get(self.device)
            context_kwargs = {
                "viewport": {"width": 390, "height": 844},
                "user_agent": (
                    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 "
                    "Mobile/15E148 Safari/604.1"
                ),
                "locale": "zh-CN",
                "timezone_id": "Asia/Shanghai",
            }
            if device:
                context_kwargs.update(device)

            # 加载已保存的登录状态
            if AUTH_STATE_FILE.exists():
                context_kwargs["storage_state"] = str(AUTH_STATE_FILE)
                logger.info(f"加载已保存的登录状态: {AUTH_STATE_FILE}")

            self._context = self._browser.new_context(**context_kwargs)
            self._page = self._context.new_page()
            logger.info("浏览器启动成功")
            return True
        except Exception as e:
            logger.exception(f"浏览器启动失败: {e}")
            return False

    @property
    def page(self) -> Optional[Page]:
        return self._page

    def save_auth_state(self) -> bool:
        """保存当前登录状态（cookie + localStorage）。"""
        if not self._context:
            return False
        try:
            self._context.storage_state(path=str(AUTH_STATE_FILE))
            logger.info(f"登录状态已保存: {AUTH_STATE_FILE}")
            return True
        except Exception as e:
            logger.error(f"保存登录状态失败: {e}")
            return False

    def has_auth_state(self) -> bool:
        """是否已有登录状态文件。"""
        return AUTH_STATE_FILE.exists()

    def close(self) -> None:
        """关闭浏览器。"""
        if self._context:
            self.save_auth_state()
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()
        self._page = None
        self._context = None
        self._browser = None
        self._playwright = None
        logger.info("浏览器已关闭")
