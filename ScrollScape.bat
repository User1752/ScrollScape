@echo off
setlocal EnableExtensions EnableDelayedExpansion
goto :main

cls
:banner
echo.
echo   !GRY!  +=======================================================+!R!
echo   !GRY!  ^|!R!                                                       !GRY!^|!R!
echo   !GRY!  ^|!R!    !BOLD!!BPUR!_____  _____!R!                                       !GRY!^|!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!/ ____^|/ ____^|!R!      !BOLD!ScrollScape!R!                     !GRY!^|!R!
echo   !GRY!  ^|!R!  !BOLD!!PUR!^| (___ ^| (___!R!        !DIM!Windows Launcher!R!                !GRY!^|!R!
echo   !GRY!  ^|!R!   !BOLD!!PUR!\___ \ \___ \!R!                                       !GRY!^|!R!
echo   !GRY!  ^|!R!   !DIM!!PUR!____^) ^|____^) ^|!R!      !DIM!Current server.js flow!R!          !GRY!^|!R!
echo   !GRY!  ^|!R!  !DIM!!PUR!^|_____/^|_____/!R!       !DIM!Foreground logs ^& easy debug!R!    !GRY!^|!R!
echo   !GRY!  ^|!R!                                                       !GRY!^|!R!
echo   !GRY!  +=======================================================+!R!
echo.
goto :eof

:status_box
echo   !GRY!  +-------------------------------------------------------+!R!
echo   !GRY!  ^|!R!    !BGRN![ OK ]!R!  !BOLD!Ready to launch ScrollScape!R!                !GRY!^|!R!
echo   !GRY!  ^|!R!                                                       !GRY!^|!R!
echo   !GRY!  ^|!R!       !BOLD!!WHT!http://localhost:!PORT!!R!                           !GRY!^|!R!
echo   !GRY!  +-------------------------------------------------------+!R!
echo.
goto :eof

:err
echo   !GRY!  +-------------------------------------------------------+!R!
echo   !GRY!  ^|!R!    !BRED![ ERR ]!R!  !BOLD!%~1!R!
if not "%~2"=="" echo   !GRY!  ^|!R!    !DIM!          %~2!R!
echo   !GRY!  +-------------------------------------------------------+!R!
echo.
goto :eof

:main
reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1
title ScrollScape Launcher
chcp 65001 >nul 2>&1

for /F "delims=#" %%E in ('"prompt #$E# & for %%e in (1) do rem"') do set "ESC=%%E"
set "R=!ESC![0m"
set "BOLD=!ESC![1m"
set "DIM=!ESC![2m"
set "PUR=!ESC![35m"
set "BPUR=!ESC![95m"
set "CYN=!ESC![36m"
set "BCYN=!ESC![96m"
set "GRN=!ESC![32m"
set "BGRN=!ESC![92m"
set "RED=!ESC![31m"
set "BRED=!ESC![91m"
set "WHT=!ESC![97m"
set "GRY=!ESC![90m"

set "ROOT=%~dp0"
cd /d "%ROOT%"
set "PORT=3000"
set "KILLED="

call :banner

echo   !BCYN![ .. ]!R!  Scanning for Node.js runtime environment...
set "NODE_EXE="
if exist "%ROOT%tools\node\node.exe" (
    set "NODE_EXE=%ROOT%tools\node\node.exe"
) else (
    where node >nul 2>&1
    if not errorlevel 1 set "NODE_EXE=node"
)

if not defined NODE_EXE (
    echo.
    call :err "Node.js was not found" "Expected tools\node\node.exe or a system node in PATH."
    pause
    exit /b 1
)

for /f "delims=" %%V in ('"%NODE_EXE%" --version 2^>^&1') do set "NODE_VER=%%V"
echo   !BGRN![ OK ]!R!  Using Node.js !NODE_VER!
echo   !BCYN![ .. ]!R!  Clearing stale node listener on port !PORT! if present...
for /f %%P in ('powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort !PORT! -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){ $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $c.OwningProcess); if([string]$p.Name -ieq 'node.exe'){ Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Output 1 } } } catch {}"') do set "KILLED=%%P"
if "!KILLED!"=="1" (
    echo   !BGRN![ OK ]!R!  Removed stale node process on port !PORT!.
) else (
    echo   !BGRN![ OK ]!R!  Port !PORT! was already free.
)

echo.
call :status_box

set "SCROLLSCAPE_LAUNCHER=1"
set "NODE_PID="

echo   !BCYN![ .. ]!R!  Starting server daemon...
call :start_node
if not defined NODE_PID (
    call :err "Failed to start server" "Could not launch server.js in background."
    pause
    exit /b 1
)

call :wait_port !PORT!
goto :node_menu

:node_menu
echo.
echo   !GRY!  +-------------------------------------------------------+!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!R!R!  !WHT!Restart ^& refresh                                !GRY!^|!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!Q!R!  !WHT!Quit                                             !GRY!^|!R!
echo   !GRY!  +-------------------------------------------------------+!R!
powershell -NoProfile -Command "while($true){$k=[Console]::ReadKey($true).KeyChar.ToString().ToUpper(); if($k -eq 'R'){exit 1}; if($k -eq 'Q'){exit 2}}"
if errorlevel 2 goto :node_quit
if errorlevel 1 goto :node_restart
goto :node_menu

:node_restart
cls
echo   !BCYN![ .. ]!R!  Restarting server...
taskkill /pid !NODE_PID! /f >nul 2>&1
call :cleanup_port
goto :main

:node_quit
echo.
echo   !BCYN![ .. ]!R!  Stopping ScrollScape...
taskkill /pid !NODE_PID! /f >nul 2>&1
exit /b 0

:cleanup_port
for /f %%P in ('powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort !PORT! -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){ $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $c.OwningProcess); if([string]$p.Name -ieq 'node.exe'){ Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } } } catch {}"') do rem
goto :eof

:start_node
set "NODE_PID="
powershell -NoProfile -Command "$env:PORT='!PORT!'; $serverPath=Join-Path '!ROOT!' 'server.js'; $p=Start-Process -FilePath '!NODE_EXE!' -ArgumentList $serverPath -WorkingDirectory '!ROOT!' -WindowStyle Hidden -PassThru; $p.Id | Out-File ($env:TEMP + '\ss_pid.txt') -Encoding ASCII" >nul 2>&1
if exist "%TEMP%\ss_pid.txt" (
    set /p NODE_PID=<"%TEMP%\ss_pid.txt"
    del "%TEMP%\ss_pid.txt" >nul 2>&1
)
goto :eof

:wait_port
set "_wp_try=0"
:_wploop
if !_wp_try! GEQ 20 goto :eof
powershell -NoProfile -Command "try{$t=New-Object Net.Sockets.TcpClient('127.0.0.1',%~1);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :eof
timeout /t 1 /nobreak >nul
set /a _wp_try+=1
goto :_wploop
