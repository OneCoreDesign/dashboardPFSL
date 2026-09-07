@echo off
title CRM Reporting - Production Server
echo ============================================
echo  CRM Reporting Server Starting...
echo ============================================
echo.
for /f "tokens=5" %%a in ('netstat -aon | findstr ":5001 " 2>nul') do taskkill /PID %%a /F >nul 2>&1
timeout /t 1 /nobreak >nul
echo Your server IP:
ipconfig | findstr /i "IPv4"
echo.
echo Open: http://YOUR_IP:5001
echo ============================================
start "CRM Server [PROD]" cmd /k "cd /d %~dp0backend ^&^& set NODE_ENV=production ^&^& node src/app.js"
timeout /t 3 /nobreak >nul
pause
