@echo off
title TravelX - Open Local Admin (Working Save)
cd /d "%~dp0"

echo Checking servers...
powershell -NoProfile -Command "try { $r=Invoke-RestMethod http://127.0.0.1:5001/api/health -TimeoutSec 3; if($r.status -ne 'online'){exit 1} } catch { exit 1 }"
if errorlevel 1 (
  echo Server band hai — restart kar raha hoon...
  call RESTART_TRAVELX.bat
  goto :eof
)

echo.
echo ============================================
echo  SAVE yahan chalega (502 nahi aayega):
echo  http://localhost:5173/admin
echo  PIN: 7788
echo ============================================
echo.
echo IMPORTANT: rates.travelx.co.in MAT kholo
echo (wahan purana code hai — 502 aata hai)
echo.
start http://localhost:5173/admin
pause
