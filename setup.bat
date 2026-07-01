@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM ============================================================
REM Setup Script - Windows
REM All output in English to avoid encoding issues
REM ============================================================

echo.
echo ============================================
echo   Meituan Hotel Crawler - First Time Setup
echo ============================================
echo.

cd /d "%~dp0"

REM ---------- Check environment ----------
echo [1/6] Checking environment...

where node >nul 2>nul
if %errorlevel%==0 (
    echo   [OK] Node.js installed
) else (
    echo   [FAIL] Node.js not found
    echo   Install from: https://nodejs.org/
    pause
    exit /b 1
)

where bun >nul 2>nul
if %errorlevel%==0 (
    echo   [OK] Bun installed
) else (
    echo   [FAIL] Bun not found
    echo   Install from: https://bun.sh/
    echo   Windows install: open PowerShell, run: irm bun.sh/install.ps1 ^| iex
    echo   Then RESTART your computer.
    pause
    exit /b 1
)

where python >nul 2>nul
if %errorlevel%==0 (
    echo   [OK] Python installed
) else (
    echo   [FAIL] Python not found
    echo   Install from: https://www.python.org/
    echo   IMPORTANT: check "Add Python to PATH" during install.
    pause
    exit /b 1
)

where adb >nul 2>nul
if %errorlevel%==0 (
    echo   [OK] ADB installed
) else (
    echo   [INFO] ADB not found. Only needed if crawling via phone emulator.
)
echo.

REM ---------- Install frontend dependencies ----------
echo [2/6] Installing frontend dependencies (about 2 min)...
call bun install
if %errorlevel% neq 0 (
    echo   [FAIL] bun install failed
    pause
    exit /b 1
)
echo   [OK] Frontend dependencies installed
echo.

REM ---------- Create database tables ----------
echo [3/6] Creating database tables...
call bun run db:push
if %errorlevel% neq 0 (
    echo   [FAIL] db push failed
    pause
    exit /b 1
)
echo   [OK] Database tables created
echo.

REM ---------- Generate Prisma client ----------
echo [4/6] Generating Prisma client...
call bun run db:generate
echo   [OK] Prisma client generated
echo.

REM ---------- Load sample data ----------
echo [5/6] Loading sample data (50 hotels for preview)...
call bun run scripts/seed-hotels.ts
echo   [OK] Sample data loaded
echo.

REM ---------- Python crawler environment ----------
echo [6/6] Setting up Python environment (about 3 min)...
cd hotel_crawler

if not exist ".venv" (
    python -m venv .venv
    if %errorlevel% neq 0 (
        echo   [FAIL] Cannot create virtual environment
        pause
        exit /b 1
    )
    echo   [OK] Virtual environment created
) else (
    echo   [INFO] Virtual environment already exists, skip
)

call .venv\Scripts\activate
python -m pip install --upgrade pip
if %errorlevel% neq 0 (
    echo   [WARN] pip upgrade failed, continue anyway
)

pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo   [FAIL] pip install failed
    echo   If network is slow, try China mirror:
    echo   pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
    pause
    exit /b 1
)
echo   [OK] Python dependencies installed

cd ..
echo.

REM ---------- Done ----------
echo ============================================
echo   Setup Complete!
echo ============================================
echo.
echo What was set up:
echo   - Frontend dependencies (node_modules)
echo   - Database tables (db\custom.db)
echo   - Sample data (50 hotels)
echo   - Python virtual environment (hotel_crawler\.venv)
echo.
echo Next steps:
echo   1. Start dashboard: double-click start-dashboard.bat
echo   2. Open browser to: http://localhost:3000
echo   3. For crawling: double-click start-crawler.bat
echo.
pause
