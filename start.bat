@echo off
title Travelx Special Fare Manager
echo ====================================================================
echo                   TRAVELX SPECIAL FARE MANAGER
echo         Smart Manual Input + Automatic Fare Comparison System
echo ====================================================================
echo.
echo [1/2] Initializing SQLite database engine...
echo [2/2] Launching server on http://localhost:5001 ...
echo.

cd /d "%~dp0"

:: Open default browser to application URL
start http://localhost:5001

:: Start Node.js application server
node server/index.js

pause
