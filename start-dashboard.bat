@echo off
chcp 65001 >nul
REM ============================================================
REM Start Dashboard - Windows
REM Double-click this file to start the web dashboard
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================
echo   Starting Meituan Hotel Dashboard...
echo ============================================
echo.

REM Check if setup was done
if not exist "node_modules" (
    echo [FAIL] Project not initialized yet.
    echo Please run setup.bat first.
    pause
    exit /b 1
)

REM Create database if missing
if not exist "db\custom.db" (
    echo [INFO] Database not found, creating...
    call bun run db:push
)

echo [INFO] Dashboard starting...
echo [INFO] Wait for the server to start, then open:
echo        http://localhost:3000
echo [INFO] Press Ctrl+C in this window to stop.
echo.

call bun run dev

pause
