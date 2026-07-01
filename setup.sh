#!/usr/bin/env bash
# ============================================================
# 首次初始化脚本 - Mac / Linux
# 用法：在项目根目录运行 bash setup.sh
# ============================================================
set -e

echo ""
echo "============================================"
echo "  美团酒店爬虫 - 首次初始化"
echo "============================================"
echo ""

# 获取项目根目录（脚本所在目录）
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# ---------- 检查环境 ----------
echo "📋 [1/6] 检查运行环境..."
check_cmd() {
    if command -v "$1" &> /dev/null; then
        echo "  ✅ $2 已安装: $(command -v "$1")"
    else
        echo "  ❌ $2 未安装，请先安装：$3"
        exit 1
    fi
}
check_cmd node "Node.js" "https://nodejs.org/"
check_cmd bun "Bun" "https://bun.sh/"
check_cmd python3 "Python 3" "https://www.python.org/"
echo ""

# ---------- 安装前端依赖 ----------
echo "📦 [2/6] 安装看板前端依赖（约 2 分钟）..."
bun install
echo "  ✅ 前端依赖安装完成"
echo ""

# ---------- 初始化数据库 ----------
echo "💾 [3/6] 创建数据库表结构..."
bun run db:push
echo "  ✅ 数据库表已创建"
echo ""

# ---------- 生成 Prisma 客户端 ----------
echo "🔧 [4/6] 生成 Prisma 客户端代码..."
bun run db:generate
echo "  ✅ Prisma 客户端已生成"
echo ""

# ---------- 灌入示例数据 ----------
echo "🌱 [5/6] 灌入示例数据（50 条酒店，方便先看效果）..."
bun run scripts/seed-hotels.ts
echo "  ✅ 示例数据已灌入"
echo ""

# ---------- Python 爬虫环境 ----------
echo "🐍 [6/6] 创建 Python 虚拟环境并安装爬虫依赖（约 3 分钟）..."
cd hotel_crawler
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
    echo "  ✅ 虚拟环境已创建"
else
    echo "  ℹ️  虚拟环境已存在，跳过创建"
fi

# 激活虚拟环境并安装依赖
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
echo "  ✅ 爬虫依赖安装完成"
cd "$PROJECT_DIR"
echo ""

# ---------- 完成 ----------
echo "============================================"
echo "  ✅ 初始化完成！"
echo "============================================"
echo ""
echo "下一步："
echo "  1. 启动看板：  bash start-dashboard.sh"
echo "  2. 启动爬虫：  bash start-crawler.sh"
echo "  3. 详细教程：  查看「启动指南.md」"
echo ""
