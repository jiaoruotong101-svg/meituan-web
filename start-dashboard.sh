#!/usr/bin/env bash
# ============================================================
# 启动数据看板 - Mac / Linux
# 用法：bash start-dashboard.sh
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo ""
echo "============================================"
echo "  启动美团酒店爬虫看板..."
echo "============================================"
echo ""

# 检查是否初始化过
if [ ! -d "node_modules" ]; then
    echo "❌ 还没初始化！请先运行：bash setup.sh"
    exit 1
fi

# 检查数据库是否存在
if [ ! -f "db/custom.db" ]; then
    echo "⚠️  数据库不存在，正在创建..."
    bun run db:push
fi

echo "📊 看板启动中..."
echo "   启动后请在浏览器访问：http://localhost:3000"
echo "   按 Ctrl+C 关闭"
echo ""

# 启动开发服务器
exec bun run dev
