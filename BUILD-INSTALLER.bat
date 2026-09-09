@echo off
setlocal
cd /d "%~dp0"
title SmartScan X - Build Installer

echo ============================================
echo       SmartScan X - Build Windows App
echo ============================================
echo.

where node >nul 2>nul || (echo Node.js is required.&pause&exit /b 1)
if not exist "node_modules\electron-builder\package.json" (
  echo Installing dependencies...
  call npm install --no-audit --no-fund
  if errorlevel 1 (echo npm install failed.&pause&exit /b 1)
)

call npm run dist
if errorlevel 1 (
  echo.
  echo Build failed. See the error above.
  pause
  exit /b 1
)

echo.
echo Installer build complete. Check the dist folder.
pause
endlocal
