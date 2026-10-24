@echo off
setlocal
pushd "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo SHOP needs Node.js 24.20.0 before setup can begin.
  echo Install the pinned Node version, reopen this file, and try again.
  echo Full instructions: docs\INSTALL.md
  pause
  popd
  exit /b 1
)
node scripts\bootstrap.mjs
set "SHOP_SETUP_EXIT=%ERRORLEVEL%"
echo.
if not "%SHOP_SETUP_EXIT%"=="0" echo Setup stopped. Read the message above and docs\INSTALL.md before retrying.
pause
popd
exit /b %SHOP_SETUP_EXIT%
