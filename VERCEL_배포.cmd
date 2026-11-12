@echo off
cd /d "%~dp0"
where npx >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js and run this file again.
  pause
  exit /b 1
)
call npx vercel --prod
pause
