@echo off
title Stop TravelX Special Fare Manager
echo Stopping TravelX servers on port 5001 and 5173...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5001 ^| findstr LISTENING') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /f /pid %%a 2>nul

echo.
echo TravelX Special Fare Manager has been stopped.
timeout /t 2 >nul
