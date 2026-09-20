@echo off
title TravelX Special Fare Manager
echo ===================================================
echo        TRAVELX SPECIAL FARE MANAGER
echo ===================================================
echo Starting Backend Server (Port 5001)...
start /b cmd /c "node server/index.js"

echo Starting Frontend Web App (Port 5173)...
start /b cmd /c "npm.cmd --prefix client run dev"

echo Waiting for services to initialize...
timeout /t 3 /nobreak >nul

echo Opening TravelX in your Default Browser...
start http://localhost:5173

echo ===================================================
echo TravelX is running!
echo Link: http://localhost:5173
echo.
echo NOTE: Is black CMD window ko band (X) mat karein.
echo Agar band kar denge toh server ruk jayega.
echo Bas is window ko MINIMIZE (-) karke rakhein!
echo ===================================================
pause
