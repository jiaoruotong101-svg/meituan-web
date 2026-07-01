# 美团酒店数据爬虫（Playwright 网页版）

> 学术研究用途。用 Playwright 自动化浏览器抓取美团酒店网页版数据，写入 SQLite，供 Next.js 看板读取。


#############################
# 1. 启动看板（终端1，保持运行）
cd E:\一些···\travel\meituan-web
bun run dev

# 2. 爬城市（终端2）
cd E:\一些···\travel\meituan-web\hotel_crawler
.venv\Scripts\activate
python main.py crawl-web --city 北京

# 3. 刷新看板看数据（浏览器 F5）
#############################



## 项目结构

```
hotel_crawler/
├── main.py                      # CLI 入口
├── requirements.txt             # Python 依赖
├── README.md                    # 本文件
├── config/
│   └── cities.yaml              # 15 个城市配置（含 cityId）
├── crawler/                     # Playwright 爬虫核心
│   ├── browser.py               # 浏览器管理 + 登录状态保存
│   ├── auth.py                  # 美团登录流程
│   ├── list_crawler.py          # 列表页爬取
│   └── detail_crawler.py        # 详情页爬取
├── parser/
│   └── schema.py                # Hotel Pydantic 模型
├── storage/
│   ├── sqlite_db.py             # SQLite 读写
│   ├── csv_exporter.py          # CSV 导出
│   └── checkpoint.py            # 断点续爬
├── output/                      # CSV 输出目录
└── logs/                        # 日志目录
```

## 环境准备

### 1. Python 环境
- Python 3.10+
- 推荐用 venv 隔离

```bash
cd hotel_crawler
python -m venv .venv
source .venv/bin/activate    # Mac/Linux
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. 安装 Playwright 浏览器
```bash
python -m playwright install chromium
```
首次会下载 Chromium（约 150MB），等 2-3 分钟。

### 3. 数据库
SQLite 文件位于项目根目录的 `db/custom.db`，**已由 Next.js 项目通过 Prisma 创建好表结构**。爬虫直接用 `sqlite3` 模块插入，不要建表。

## 运行命令

### 首次使用：登录美团
```bash
python main.py login
```
会弹出浏览器窗口，手动操作：
1. 输入手机号
2. 点「获取验证码」
3. 输入收到的短信验证码
4. 点「登录」

登录成功后，状态自动保存到 `config/.auth/meituan_state.json`，之后爬取会自动加载，不用反复登录（状态一般保持 1-2 周）。

### 爬取酒店
```bash
# 爬一个城市（列表页）
python main.py crawl-web --city Tianjin
python main.py crawl-web --city 天津

# 爬一个城市（列表 + 详情页，字段更全但慢）
python main.py crawl-web --city Tianjin --with-detail

# 爬全部 15 个城市
python main.py crawl-web

# 自定义日期
python main.py crawl-web --city Tianjin --checkin 2026-07-01 --checkout 2026-07-02

# 无头模式（不显示浏览器窗口）
python main.py crawl-web --city Tianjin --headless
```

### 其他命令
```bash
# 查看数据库统计
python main.py status

# 导出 CSV（全部）
python main.py export

# 导出指定城市 CSV
python main.py export --city 天津
```

## 字段说明

`Hotel` 表字段对齐 Prisma schema（驼峰命名）。完整字段见 [`parser/schema.py`](parser/schema.py)。

JSON 数组类字段（`hotelType` / `tags` / `promotions` / `facilities` / `nearbyPois`）存为 JSON 字符串，例如 `'["经济型","青年旅舍"]'`。

日期字段（`crawlTime` / `startedAt` / `endedAt` / `createdAt`）存为 ISO8601 字符串。

## 反爬策略

1. **真实浏览器**：用 Playwright 驱动 Chromium，行为接近真人
2. **登录态复用**：一次登录长期使用，减少登录请求
3. **随机停顿**：滑动间隔 1-3 秒随机
4. **详情页限速**：每家详情页之间停 2-4 秒
5. **移动端 UA**：伪装为 iPhone Safari

## 调试

### 验证语法
```bash
cd hotel_crawler
python -m py_compile main.py crawler/*.py parser/*.py storage/*.py
```

### 手动验证 SQLite 写入
```python
from storage.sqlite_db import Database
from parser.schema import Hotel
db = Database()
h = Hotel(hotelId="smoke001", city="测试", name="冒烟酒店", currentPrice=99.9)
db.upsert_hotel(h.to_sqlite_tuple())
print(db.get_hotel_count())
db.close()
```

### 登录状态失效
如果爬取时提示「被跳转到登录页」，说明登录状态过期，重新跑：
```bash
python main.py login
```

## 字段映射调整（重要）

美团网页版的 DOM 结构可能随版本变化。如果爬取时发现：
- 数量为 0（解析不到酒店卡片）
- 字段错位（价格跑到评分位置）

需要调整 `crawler/list_crawler.py` 里的：
- `_wait_for_hotel_cards()` 的选择器列表
- `_parse_hotel_cards()` 的 evaluate JS 代码
- `_parse_card_text()` 的正则表达式

把爬取时的终端日志 + 页面截图发给我，我帮你调。

## 合规声明

⚠️ **本项目仅用于学术研究目的，使用者需自行承担法律责任。**

1. 抓取行为遵守目标网站的 robots.txt 与服务条款
2. 不得用于商业用途、倒卖数据、骚扰商户
3. 不得绕过付费墙、盗取个人隐私数据
4. 抓取速率遵循"善意爬虫"原则（限速 + 休息）
5. 数据采集后用于学术分析，发表时需脱敏
6. 若收到平台停止通知，立即停止抓取
