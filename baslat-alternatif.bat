@echo off
chcp 65001 > nul
cd /d "%~dp0"

set PORT=4141

if exist configwin.ini (
    for /f "tokens=2 delims==" %%A in ('findstr /i "^port" configwin.ini') do set "PORT=%%A"
)

set PORT=%PORT: =%

echo ====================================================
echo  HaYTool YouTube Downloader - Alternatif Masaustu Modu
echo  Port: %PORT%
echo ====================================================
echo.

start /b node server.js

timeout /t 2 /nobreak > nul

start msedge --app=http://localhost:%PORT%
