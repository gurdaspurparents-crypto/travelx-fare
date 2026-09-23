@echo off
title TravelX Special Fare Manager
cd /d "%~dp0"

echo ===================================================
echo        TRAVELX SPECIAL FARE MANAGER
echo ===================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js install nahi mila. Pehle Node.js install karein.
  pause
  exit /b 1
)

echo [1/3] Starting Backend API on port 5001...
start "TravelX Backend" /MIN cmd /k "cd /d "%~dp0" && node server/index.js"

echo [2/3] Waiting for backend health check...
powershell -NoProfile -Command "$ok=$false; for($i=0; $i -lt 45; $i++){ try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:5001/api/health' -TimeoutSec 3; if($r.status -eq 'online'){ $ok=$true; break } } catch {}; Start-Sleep -Seconds 1 }; if(-not $ok){ Write-Host ''; Write-Host 'ERROR: Backend start nahi hua (port 5001). TravelX Backend window check karein.' -ForegroundColor Red; exit 1 } else { Write-Host 'Backend OK.' -ForegroundColor Green }"
if errorlevel 1 (
  echo.
  echo Fix: "TravelX Backend" minimized window kholo — error wahan dikhega.
  pause
  exit /b 1
)

echo [3/3] Starting Frontend on port 5173...
start "TravelX Frontend" /MIN cmd /k "cd /d "%~dp0" && npm.cmd --prefix client run dev"

timeout /t 4 /nobreak >nul

echo Opening browser...
start http://localhost:5173

echo.
echo ===================================================
echo TravelX is running!
echo   Portal:  http://localhost:5173
echo   Admin:   http://localhost:5173/admin
echo   API:     http://localhost:5001/api/health
echo.
echo IMPORTANT:
echo   - "TravelX Backend" aur "TravelX Frontend" windows band mat karo.
echo   - Excel save error aaye to pehle API health check karein.
echo   - Always-on: npm run pm2:start
echo ===================================================
pause
