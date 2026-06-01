@echo off
title HaYTool Youtube Download v4.7.0
cd /d "%~dp0"
cls
color 0E

rem Port 3000 denetleme
set PORT_PID=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do set PORT_PID=%%a

if "%PORT_PID%"=="" goto :start_server

color 0C
echo   ====================================================
echo   [UYARI] Port 3000 su anda baska bir islem tarafindan kullaniliyor!
echo   Islem ID (PID): %PORT_PID%

set PNAME=Bilinmeyen
tasklist /nh /fi "PID eq %PORT_PID%" > "%~dp0temp_task.txt"
for /f "tokens=1" %%b in ('type "%~dp0temp_task.txt"') do set PNAME=%%b
del "%~dp0temp_task.txt"

echo   Uygulama Adi  : %PNAME%
echo   ====================================================
echo.
echo   [1] Islemi sonlandir ve sunucuyu baslat
echo   [2] Islemi sonlandirma ve cik
echo.
set /p CHOICE="  Seciminiz (1 veya 2): "

if "%CHOICE%"=="1" (
    echo.
    echo   [+] Portu kullanan islem (%PNAME% - PID: %PORT_PID%) sonlandiriliyor...
    taskkill /pid %PORT_PID% /f
    timeout /t 2 >nul
    cls
    color 0E
    goto :start_server
) else (
    echo.
    echo   [-] Port cakismasi giderilmedi. Uygulama baslatilamiyor.
    pause
    exit /b
)

:start_server
color 0E
echo   ====================================================
echo   _    _         __     __ _______  ___   ___   _      
echo  ^| ^|  ^| ^|  __ _  \ \   / /^|__   __^|/ _ \ / _ \ ^| ^|     
echo  ^| ^|__^| ^| / _` ^|  \ \_/ /    ^| ^|  ^| (_) ^| (_) ^|^| ^|     
echo  ^|  __  ^|^| (_^| ^|   \   /     ^| ^|   \___/ \___/ ^| ^|     
echo  ^| ^|  ^| ^| \__,_^|    ^| ^|      ^| ^|               ^| ^|____ 
echo  ^|_^|  ^|_^|           ^|_^|      ^|_^|               ^|______^|
echo.
echo              -- Premium Otomasyonu --
echo              Versiyon: v4.7.0
echo   ====================================================
echo.
echo   [+] Sunucu Port: 3000 denetleniyor...
echo   [+] Tarayici baglantisi hazirlaniyor...
echo   [+] Kapatmak icin bu pencereyi kapatabilirsiniz.
echo.
echo   ----------------------------------------------------
echo   [Sistem] Arayuz baslatiliyor...
echo.
color 0A
if exist HaYTool.exe (
    echo   [+] Sistem tepsisi uygulamasi baslatiliyor (HaYTool.exe)...
    start "" HaYTool.exe
    timeout /t 2 >nul
    exit
) else (
    call npm start
)
pause
