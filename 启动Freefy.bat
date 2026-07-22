@echo off
title Freefy
cd /d "%~dp0"

:: Check if server is running
curl -sk -o nul -w "%%{http_code}" https://localhost:3443 2>nul | find "200" >nul
if %errorlevel% neq 0 (
    echo Starting Freefy server...
    start /B node server\index.js > nul 2>&1
    timeout /t 3 /nobreak > nul
)

:: Open Edge in app mode (no address bar, no warnings, looks like native app)
start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=https://localhost:3443 --ignore-certificate-errors
