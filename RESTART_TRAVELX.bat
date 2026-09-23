@echo off
title Restart TravelX
cd /d "%~dp0"
echo Stopping old Node processes on ports 5001 / 5173...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5001,5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul
call START_TRAVELX.bat
