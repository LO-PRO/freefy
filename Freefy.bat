@echo off
title Freefy
cd /d "%~dp0"
echo Starting Freefy server...
start /B node server\http-server.js > nul 2>&1
timeout /t 3 /nobreak > nul
start https://localhost:3443
echo Freefy is running! Keep this window open.
echo Visit https://localhost:3443 if browser doesn't open.
pause > nul
