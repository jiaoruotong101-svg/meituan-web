"""美团酒店爬虫 - CLI 入口。

Usage:
    python main.py run --city 天津              # 爬指定城市
    python main.py run --city 天津 --dry-run    # 干跑（不连设备/不抓包）
    python main.py run --day 1                  # 按排期跑某天
    python main.py export [--city 天津]         # 只导出 CSV
    python main.py status                       # 数据库统计
    python main.py checkpoint                   # 查看断点续爬进度
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

from loguru import logger

# 把项目根目录加入 sys.path，确保所有相对包导入可用
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

LOG_DIR = PROJECT_ROOT / "logs"


def setup_logger(verbose: bool = False) -> None:
    """配置 loguru 日志（控制台 + 文件）。"""
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_file = LOG_DIR / f"crawl_{datetime.now().strftime('%Y%m%d')}.log"
    logger.remove()
    logger.add(sys.stderr, level="DEBUG" if verbose else "INFO",
               format="<green>{time:HH:mm:ss}</green> | <level>{level:<7}</level> | {message}")
    logger.add(log_file, level="DEBUG", rotation="20 MB", retention="14 days",
               format="{time:YYYY-MM-DD HH:mm:ss} | {level:<7} | {module}:{function}:{line} | {message}",
               encoding="utf-8")
    logger.info(f"日志写入: {log_file}")


# ---------------- 城市名归一化 ----------------
# 城市名别名映射（拼音 -> 中文）
CITY_ALIASES = {
    "beijing": "北京", "shanghai": "上海", "guangzhou": "广州", "shenzhen": "深圳",
    "chengdu": "成都", "chongqing": "重庆", "hangzhou": "杭州", "nanjing": "南京",
    "wuhan": "武汉", "xian": "西安", "tianjin": "天津", "suzhou": "苏州",
    "changsha": "长沙", "xiamen": "厦门", "qingdao": "青岛",
}


def normalize_city(name: str) -> str:
    """城市名归一化：支持中文、拼音（不区分大小写）。返回 yaml 里的中文名。"""
    if not name:
        return name
    # 直接是中文，原样返回
    if any('\u4e00' <= ch <= '\u9fff' for ch in name):
        return name
    # 拼音转中文
    lower = name.strip().lower()
    if lower in CITY_ALIASES:
        return CITY_ALIASES[lower]
    return name


def cmd_export(args: argparse.Namespace) -> int:
    from storage.csv_exporter import export_csv
    path = export_csv(city=args.city)
    logger.info(f"CSV 已导出: {path}")
    return 0


def cmd_status(args: argparse.Namespace) -> int:
    from storage.sqlite_db import Database
    db = Database()
    stats = db.stats()
    db.close()
    print("\n=== 数据库统计 ===")
    print(f"总酒店数: {stats['total_hotels']}")
    print(f"\n按城市分布:")
    for c in stats["by_city"]:
        avg_price = c.get("avg_price") or 0
        avg_score = c.get("avg_score") or 0
        print(f"  {c['city']:<6} {c['n']:>5} 家 | 均价 {avg_price:>7.1f} | 均分 {avg_score:>4.2f}")
    print(f"\nSession 状态: {stats['sessions']}")
    print(f"未解决告警: {stats['unresolved_alerts']}")
    return 0


def cmd_checkpoint(args: argparse.Namespace) -> int:
    from storage.checkpoint import Checkpoint
    cp = Checkpoint()
    progress = cp.all_progress()
    if not progress:
        print("尚无断点记录")
        return 0
    print("\n=== 断点续爬进度 ===")
    for key, info in progress.items():
        print(f"  {key}: {info}")
    return 0


# ---------------- 网页版爬取（Playwright） ----------------
def cmd_crawl_web(args: argparse.Namespace) -> int:
    """用 Playwright 爬取美团酒店网页版。"""
    from datetime import datetime, timedelta
    from pathlib import Path
    import yaml
    from crawler.browser import BrowserManager
    from crawler.auth import AuthManager
    from crawler.list_crawler import ListCrawler
    from crawler.detail_crawler import DetailCrawler
    from storage.sqlite_db import Database

    # 日期默认今天/明天
    today = datetime.now().date()
    checkin = args.checkin or today.strftime("%Y-%m-%d")
    checkout = args.checkout or (today + timedelta(days=1)).strftime("%Y-%m-%d")
    logger.info(f"入住: {checkin}, 离店: {checkout}")

    # 读城市配置
    cities_path = Path(__file__).resolve().parent / "config" / "cities.yaml"
    with open(cities_path, "r", encoding="utf-8") as f:
        cfg = yaml.safe_load(f) or {}
    cities = cfg.get("cities", [])

    # 筛选城市
    if args.city:
        city_name = normalize_city(args.city)
        cities = [c for c in cities if c["name"] == city_name]
        if not cities:
            logger.error(f"未找到城市: {args.city}")
            return 1

    # 启动浏览器
    bm = BrowserManager(headless=args.headless)
    if not bm.start():
        return 1

    db = Database()
    try:
        page = bm.page
        # 确保已登录
        auth = AuthManager(page)
        if not auth.ensure_logged_in():
            logger.error("登录失败，退出")
            return 1
        bm.save_auth_state()

        # 逐城市爬取
        for city_cfg in cities:
            city_name = city_cfg["name"]
            city_id = city_cfg.get("cityId")
            if not city_id:
                logger.warning(f"城市 {city_name} 缺少 cityId，跳过")
                continue
            target = city_cfg.get("target_count", args.target)
            logger.info(f"\n{'=' * 50}\n开始爬取: {city_name} (cityId={city_id}, target={target})\n{'=' * 50}")

            # 创建 session
            session_id = db.create_session(city_name, target=target,
                                           checkin_date=checkin, checkout_date=checkout)

            # 清空该城市旧数据，避免多次爬取累积导致导出行数 > 本次爬取数
            db.clear_city(city_name)

            # 爬列表
            list_crawler = ListCrawler(page, db, city_name, city_id)
            count = list_crawler.crawl(
                checkin=checkin, checkout=checkout, target=target,
                on_progress=lambda c, t: db.update_session(session_id, hotel_count=c),
            )
            db.update_session(session_id, hotel_count=count,
                              status="completed" if count >= target else "partial", ended=True)
            logger.info(f"城市 {city_name} 列表爬取完成: {count} 家")

            # 可选：爬详情
            if args.with_detail and count > 0:
                logger.info(f"开始爬取详情页（上限 {args.detail_limit}）")
                from parser.schema import Hotel
                # 取刚爬的酒店
                hotels_data = db.fetch_all_hotels_by_city(city_name, limit=args.detail_limit)
                detail_crawler = DetailCrawler(page, db)
                for i, h_tuple in enumerate(hotels_data, 1):
                    # 重建 Hotel 对象（简化）
                    h = Hotel.from_sqlite_tuple(h_tuple)
                    logger.info(f"[{i}/{len(hotels_data)}] 详情: {h.name}")
                    try:
                        detail_crawler.crawl(h)
                    except Exception as e:
                        logger.warning(f"详情爬取失败: {e}")
                    # 随机停顿 2-4 秒
                    import time
                    time.sleep(2 + (i % 3))

            # 导出 CSV
            try:
                from storage.csv_exporter import export_csv
                csv_path = export_csv(city=city_name, db=db)
                logger.info(f"CSV 已导出: {csv_path}")
            except Exception as e:
                logger.warning(f"CSV 导出失败: {e}")

    finally:
        bm.close()
        db.close()
    return 0


def cmd_login(args: argparse.Namespace) -> int:
    """单独登录美团账号。"""
    from crawler.browser import BrowserManager
    from crawler.auth import AuthManager

    bm = BrowserManager(headless=args.headless)
    if not bm.start():
        return 1
    try:
        auth = AuthManager(bm.page)
        if auth.ensure_logged_in():
            bm.save_auth_state()
            logger.info("登录状态已保存，之后爬取会自动使用")
            return 0
        else:
            logger.error("登录失败")
            return 1
    finally:
        bm.close()


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="hotel_crawler", description="美团酒店爬虫 CLI")
    sub = p.add_subparsers(dest="command", required=True)

    # crawl-web (新 - 推荐使用)
    p_cw = sub.add_parser("crawl-web", help="用 Playwright 爬取美团酒店网页版（推荐）")
    p_cw.add_argument("--city", help="指定城市名（中文如「天津」或拼音如「tianjin」），不指定则跑全部")
    p_cw.add_argument("--target", type=int, default=200, help="每个城市目标酒店数（默认 200）")
    p_cw.add_argument("--checkin", help="入住日期 YYYY-MM-DD（默认今天）")
    p_cw.add_argument("--checkout", help="离店日期 YYYY-MM-DD（默认明天）")
    p_cw.add_argument("--headless", action="store_true", help="无头模式（不显示浏览器窗口）")
    p_cw.add_argument("--with-detail", action="store_true", help="爬完列表后逐个爬详情页（慢但字段全）")
    p_cw.add_argument("--detail-limit", type=int, default=50, help="详情页爬取上限（默认 50，防止太慢）")
    p_cw.set_defaults(func=cmd_crawl_web)

    # login (新 - 单独触发登录)
    p_login = sub.add_parser("login", help="单独登录美团账号（保存登录状态）")
    p_login.add_argument("--headless", action="store_true", help="无头模式")
    p_login.set_defaults(func=cmd_login)

    # export
    p_exp = sub.add_parser("export", help="导出 CSV")
    p_exp.add_argument("--city", help="只导出指定城市")
    p_exp.set_defaults(func=cmd_export)

    # status
    p_st = sub.add_parser("status", help="显示数据库统计")
    p_st.set_defaults(func=cmd_status)

    return p


def main(argv: list = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    setup_logger(verbose=getattr(args, "dry_run", False))
    try:
        return args.func(args)
    except KeyboardInterrupt:
        logger.warning("用户中断")
        return 130
    except Exception as e:
        logger.exception(f"未捕获异常: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
