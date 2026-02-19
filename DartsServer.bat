@echo off
title Darts League Server

echo.
echo ========================================================
echo            DARTS LEAGUE SERVER
echo ========================================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo CHYBA: Node.js neni nainstalovan!
    echo.
    echo Pro spusteni serveru potrebujes Node.js.
    echo Stahni ho z: https://nodejs.org/
    echo.
    echo Po instalaci spust tento soubor znovu.
    echo.
    pause
    exit /b 1
)

echo Node.js nalezen: 
node --version
echo.

:: Check if node_modules exists
if not exist "node_modules" (
    echo Instaluji zavislosti...
    call npm install
    if %errorlevel% neq 0 (
        echo CHYBA: Nelze nainstalovat zavislosti!
        pause
        exit /b 1
    )
    echo Zavislosti nainstalovany.
    echo.
)

:: Start the server
echo Spoustim server...
echo.
node server.js

pause
