@echo off
echo ==============================
echo   Freefy - Free Music Player
echo ==============================
echo.
cd /d "%~dp0"
echo Installing dependencies...
call npm install --silent
cd client
call npm install --silent
echo Building frontend...
call npx vite build
cd ..
echo.
echo Starting server at http://localhost:3456
echo Open your browser and visit http://localhost:3456
echo.
node server/index.js
pause
