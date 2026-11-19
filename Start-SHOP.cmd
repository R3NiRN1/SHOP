@echo off
setlocal
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo SHOP needs Node.js 24.20.0. Run Setup-SHOP.cmd first.
  pause
  popd
  exit /b 1
)
node scripts\bootstrap.mjs --start
set "SHOP_START_EXIT=%ERRORLEVEL%"
if not "%SHOP_START_EXIT%"=="0" (
  echo.
  echo If setup was interrupted, run Setup-SHOP.cmd and choose Resume.
  pause
)
popd
exit /b %SHOP_START_EXIT%
