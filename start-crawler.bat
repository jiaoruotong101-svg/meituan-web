@echo off
chcp 65001 >nul
REM ============================================================
REM Start Web Crawler - Windows
REM Uses Playwright to crawl meituan hotel web version
REM ============================================================

cd /d "%~dp0hotel_crawler"

echo.
echo ============================================
echo   Meituan Hotel Web Crawler (Playwright)
echo ============================================
echo.

REM Check virtual environment
if not exist ".venv" (
    echo [FAIL] Python environment not initialized.
    echo Please run setup.bat in project root first.
    pause
    exit /b 1
)

call .venv\Scripts\activate

REM Check if playwright browsers installed
echo [INFO] Checking Playwright browser...
python -c "from playwright.sync_api import sync_playwright; print('Playwright OK')" 2>nul
if %errorlevel% neq 0 (
    echo [WARN] Playwright not installed. Installing...
    pip install playwright
)

REM Install browser if not exists
python -c "import os; os.path.exists(os.path.expanduser('~/.cache/ms-playwright')) or __import__('sys').exit(1)" 2>nul
if %errorlevel% neq 0 (
    echo [INFO] Installing Chromium browser for Playwright...
    python -m playwright install chromium
)

echo.
echo ============================================
echo   Available commands:
echo ============================================
echo.
echo   1. Login first (required for first time):
echo      python main.py login
echo.
echo   2. Crawl one city:
echo      python main.py crawl-web --city Tianjin
echo      (or use Chinese: --city 天津)
echo.
echo   3. Crawl with detail pages:
echo      python main.py crawl-web --city Tianjin --with-detail
echo.
echo   4. Crawl all 15 cities:
echo      python main.py crawl-web
echo.
echo   5. Crawl with custom dates:
echo      python main.py crawl-web --city Tianjin --checkin 2026-07-01 --checkout 2026-07-02
echo.
echo   6. Check database stats:
echo      python main.py status
echo.
echo   7. Export CSV:
echo      python main.py export --city Tianjin
echo.
echo ============================================
echo.
echo Type your command below (Python env activated).
echo.

cmd /k
