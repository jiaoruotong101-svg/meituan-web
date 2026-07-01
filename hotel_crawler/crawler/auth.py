"""美团登录管理 - 首次手动登录，保存状态供后续使用。"""
from __future__ import annotations

from loguru import logger
from playwright.sync_api import Page

# 美团登录页 URL
LOGIN_URL = "https://passport.meituan.com/useraccount/ilogin"
# 登录后跳转的酒店列表页（用于验证登录是否成功）
VERIFY_URL = "https://i.meituan.com/awp/h5/hotel/search/search.html"


class AuthManager:
    """管理美团登录流程。"""

    def __init__(self, page: Page):
        self.page = page

    def is_logged_in(self) -> bool:
        """检查当前是否已登录。访问搜索页，如果跳到登录页说明未登录。"""
        try:
            self.page.goto(VERIFY_URL, wait_until="domcontentloaded", timeout=15000)
            self.page.wait_for_timeout(3000)
            current_url = self.page.url
            # 如果 URL 含 passport.meituan.com 说明被跳到登录页
            if "passport.meituan.com" in current_url:
                return False
            # 如果标题是"美团酒店"说明已登录
            title = self.page.title()
            if "美团酒店" in title or "酒店" in title:
                return True
            return False
        except Exception as e:
            logger.warning(f"检查登录状态异常: {e}")
            return False

    def manual_login(self) -> bool:
        """引导用户手动登录（手机号+验证码）。

        流程：
        1. 打开登录页
        2. 等待用户手动输入手机号、收验证码、登录
        3. 检测到登录成功后返回
        """
        logger.info("=" * 50)
        logger.info("需要登录美团账号")
        logger.info("=" * 50)
        logger.info("请在弹出的浏览器窗口中手动操作：")
        logger.info("1. 输入手机号")
        logger.info("2. 点「获取验证码」")
        logger.info("3. 输入收到的短信验证码")
        logger.info("4. 点「登录」")
        logger.info("5. 登录成功后，本程序会自动继续")
        logger.info("=" * 50)

        try:
            self.page.goto(LOGIN_URL, wait_until="domcontentloaded", timeout=15000)
            logger.info("已打开登录页，等待用户操作...")
        except Exception as e:
            logger.error(f"打开登录页失败: {e}")
            return False

        # 等待用户登录成功，最多等 5 分钟
        # 登录成功的标志：URL 离开 passport.meituan.com
        max_wait_ms = 5 * 60 * 1000  # 5 分钟
        poll_interval = 2000  # 每 2 秒检查一次
        waited = 0
        while waited < max_wait_ms:
            self.page.wait_for_timeout(poll_interval)
            waited += poll_interval
            try:
                current_url = self.page.url
                if "passport.meituan.com" not in current_url:
                    logger.info(f"检测到离开登录页，当前 URL: {current_url}")
                    # 再等一下让页面稳定
                    self.page.wait_for_timeout(3000)
                    if self.is_logged_in():
                        logger.info("登录成功！")
                        return True
                    # 可能跳到了其他页面，但没真正登录成功，继续等
            except Exception:
                pass
            if waited % 30000 == 0:
                logger.info(f"仍在等待登录... 已等 {waited // 1000} 秒")

        logger.error("等待登录超时（5 分钟），请重新运行")
        return False

    def ensure_logged_in(self) -> bool:
        """确保已登录，没登录则引导手动登录。返回是否已登录。"""
        if self.is_logged_in():
            logger.info("已登录（状态有效）")
            return True
        logger.warning("未登录或登录状态已失效，需要重新登录")
        return self.manual_login()
