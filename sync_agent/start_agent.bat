@echo off
title FiberCore Enterprise - Google Earth Sync Agent
echo =======================================================
echo   FiberCore Enterprise - Google Earth Pro Sync Agent
echo =======================================================
echo.

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python tidak terdeteksi di komputer Anda!
    echo Silakan install Python terlebih dahulu dari https://www.python.org/downloads/
    echo dan pastikan centang "Add Python to PATH".
    echo.
    pause
    exit /b
)

python "%~dp0fibercore_sync_agent.py"
pause
