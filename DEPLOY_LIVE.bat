@echo off
title Deploy TravelX fixes to rates.travelx.co.in
cd /d "%~dp0"

echo Building production frontend...
call npm run build:local
if errorlevel 1 (
  echo BUILD FAILED
  pause
  exit /b 1
)

echo.
echo ===================================================
echo  Ab fixes LOCAL folder mein ready hain.
echo  Live site (rates.travelx.co.in) par lane ke liye:
echo.
echo  1) Git commit + push karein (Render auto-deploy)
echo     YA Render dashboard - Manual Deploy
echo.
echo  2) Render par service RESTART karein
echo.
echo  3) Admin login - Excel save dubara try karein
echo ===================================================
echo.

git status -sb 2>nul
if errorlevel 1 (
  echo Note: Git repo nahi mila — Render par manually upload/deploy karein.
) else (
  echo Agar aap chahein to ab commit message:
  echo   fix: faster excel bulk save and 502 retries
)

pause
