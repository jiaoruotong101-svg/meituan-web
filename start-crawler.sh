#!/usr/bin/env bash
# ============================================================
# Start Web Crawler - Mac / Linux
# Uses Playwright to crawl meituan hotel web version
# ============================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR/hotel_crawler"

echo ""
echo "============================================"
echo "  Meituan Hotel Web Crawler (Playwright)"
echo "============================================"
echo ""

if [ ! -d ".venv" ]; then
    echo "❌ Python environment not initialized. Run setup.sh first."
    exit 1
fi

source .venv/bin/activate

# Check playwright
if ! python -c "import playwright" 2>/dev/null; then
    echo "⚠️  Playwright not installed. Installing..."
    pip install playwright
fi

# Install browser if not exists
if [ ! -d "$HOME/.cache/ms-playwright" ] && [ ! -d "$HOME/Library/Caches/ms-playwright" ]; then
    echo "📦 Installing Chromium for Playwright..."
    python -m playwright install chromium
fi

echo ""
echo "============================================"
echo "  Available commands:"
echo "============================================"
echo ""
echo "  1. Login first (required for first time):"
echo "     python main.py login"
echo ""
echo "  2. Crawl one city:"
echo "     python main.py crawl-web --city Tianjin"
echo "     (or use Chinese: --city 天津)"
echo ""
echo "  3. Crawl with detail pages:"
echo "     python main.py crawl-web --city Tianjin --with-detail"
echo ""
echo "  4. Crawl all 15 cities:"
echo "     python main.py crawl-web"
echo ""
echo "  5. Crawl with custom dates:"
echo "     python main.py crawl-web --city Tianjin --checkin 2026-07-01 --checkout 2026-07-02"
echo ""
echo "  6. Check database stats:"
echo "     python main.py status"
echo ""
echo "  7. Export CSV:"
echo "     python main.py export --city Tianjin"
echo ""
echo "============================================"
echo ""

exec bash
