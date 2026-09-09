@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title SmartScan X
color 0A

echo ============================================
echo          SmartScan X - Easy Launcher
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed.
  echo Install Node.js LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js LTS.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json was not found.
  echo Please run this file from the extracted SmartScan X folder.
  pause
  exit /b 1
)

if not exist "node_modules\electron\package.json" (
  echo First run: installing SmartScan X packages...
  echo This may take a few minutes.
  echo.
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo.
    echo [ERROR] Package installation failed.
    echo Please check your internet connection and run this launcher again.
    pause
    exit /b 1
  )
)

echo.
echo Starting SmartScan X...
echo Port 5173 is checked automatically; another free port is used if needed.
echo.
node start-dev.cjs

if errorlevel 1 (
  echo.
  echo SmartScan X closed because the launcher reported an error.
  pause
)
endlocal
