@echo off
setlocal EnableExtensions EnableDelayedExpansion
set "BROWSER_OPENED="
goto :main

:banner
echo.
echo   +=======================================================+
echo   ^|                                                       ^|
echo   ^|    _____  _____                                       ^|
echo   ^|   / ____^|/ ____^|      ScrollScape                     ^|
echo   ^|  ^| (___ ^| (___        Windows Launcher                ^|
echo   ^|   \___ \ \___ \                                       ^|
echo   ^|   ____^) ^|____^) ^|      Current server.js flow          ^|
echo   ^|  ^|_____/^|_____/       Foreground logs ^& easy debug    ^|
echo   ^|                                                       ^|
echo   +=======================================================+
echo.
goto :eof

:err
echo   +-------------------------------------------------------+
echo   ^|    [ ERR ]  %~1
if not "%~2"=="" echo   ^|              %~2
echo   +-------------------------------------------------------+
echo.
goto :eof

:main
title ScrollScape Launcher

set "ROOT=%~dp0"
cd /d "%ROOT%"
set "PORT=4000"
set "KILLED="

call :banner

echo   [ .. ]  Scanning for Node.js runtime environment...
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
echo   [ OK ]  Using Node.js !NODE_VER!
echo   [ .. ]  Clearing stale node listener on port !PORT! if present...
for /f %%P in ('powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort !PORT! -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){ $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $c.OwningProcess); if([string]$p.Name -ieq 'node.exe'){ Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Output 1 } } } catch {}"') do set "KILLED=%%P"
if "!KILLED!"=="1" (
    echo   [ OK ]  Removed stale node process on port !PORT!.
) else (
    echo   [ OK ]  Port !PORT! was already free.
)

if not exist "%ROOT%node_modules\" (
    echo.
    echo   [ .. ]  First run detected! Installing dependencies...
    call npm install
    if errorlevel 1 (
        call :err "Failed to install dependencies" "Make sure npm is installed and in PATH."
        pause
        exit /b 1
    )
    echo   [ OK ]  Dependencies installed.
)

set "SCROLLSCAPE_LAUNCHER=1"
set "NODE_PID="

echo   [ .. ]  Starting server daemon...

set "FLARESOLVERR_EXE=%ROOT%tools\flaresolverr\flaresolverr.exe"
set "FS_PID="
if not exist "!FLARESOLVERR_EXE!" (
    echo.
    echo   [ .. ]  FlareSolverr is missing. Downloading portable version...
    "!NODE_EXE!" "!ROOT!install_flaresolverr.js"
)

if exist "!FLARESOLVERR_EXE!" (
    echo   [ .. ]  Starting portable FlareSolverr proxy...
    powershell -NoProfile -Command "$env:PORT='8191'; $p=Start-Process -FilePath '!FLARESOLVERR_EXE!' -WindowStyle Hidden -PassThru; $p.Id | Out-File ($env:TEMP + '\fs_pid.txt') -Encoding ASCII" >nul 2>&1
    if exist "%TEMP%\fs_pid.txt" (
        set /p FS_PID=<"%TEMP%\fs_pid.txt"
        del "%TEMP%\fs_pid.txt" >nul 2>&1
    )
)

call :start_node
if not defined NODE_PID (
    call :err "Failed to start server" "Could not launch server.js in background."
    pause
    exit /b 1
)

call :wait_port !PORT!

echo.
echo   +-------------------------------------------------------+
echo   ^|    [ OK ]  Ready to launch ScrollScape                 ^|
echo   ^|                                                       ^|
echo   ^|       http://localhost:!PORT!                          ^|
echo   +-------------------------------------------------------+

if not defined BROWSER_OPENED (
    call :open_app_window
    set "BROWSER_OPENED=1"
)

goto :node_menu

:node_menu
echo.
echo   +-------------------------------------------------------+
echo   ^|   R  Restart ^& refresh                                ^|
echo   ^|   Q  Quit                                             ^|
echo   +-------------------------------------------------------+
powershell -NoProfile -Command "while($true){$k=[Console]::ReadKey($true).KeyChar.ToString().ToUpper(); if($k -eq 'R'){exit 1}; if($k -eq 'Q'){exit 2}}"
if errorlevel 2 goto :node_quit
if errorlevel 1 goto :node_restart
goto :node_menu

:node_restart
echo   [ .. ]  Restarting server...
taskkill /pid !NODE_PID! /f >nul 2>&1
if defined FS_PID taskkill /pid !FS_PID! /f >nul 2>&1
call :cleanup_port
REM "goto :main" is what used to be here to loop back — cmd.exe can lose
REM track of a label after enough nested "call"s to powershell.exe further
REM down in a long-running session (a known cmd.exe flakiness, not specific
REM to this script) and fail with "cannot find the batch label specified".
REM Re-launching this same file as a brand new process sidesteps that
REM entirely: it re-reads the file fresh from disk instead of seeking back
REM into the current one. This also means restart always reopens the app
REM window, which is a reasonable default (fixes the case of the window
REM having been closed by accident) — the initial launch still only opens
REM one window per run either way.
call "%~f0"
exit /b 0

:node_quit
echo.
echo   [ .. ]  Stopping ScrollScape...
taskkill /pid !NODE_PID! /f >nul 2>&1
if defined FS_PID taskkill /pid !FS_PID! /f >nul 2>&1
exit /b 0

:cleanup_port
for /f %%P in ('powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort !PORT! -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if($c){ $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $c.OwningProcess); if([string]$p.Name -ieq 'node.exe'){ Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue } } } catch {}"') do rem
goto :eof

:start_node
set "NODE_PID="
powershell -NoProfile -Command "$env:PORT='!PORT!'; $p=Start-Process -FilePath '!NODE_EXE!' -ArgumentList 'server.js' -WorkingDirectory '!ROOT!' -WindowStyle Hidden -PassThru; $p.Id | Out-File ($env:TEMP + '\ss_pid.txt') -Encoding ASCII" >nul 2>&1
if exist "%TEMP%\ss_pid.txt" (
    set /p NODE_PID=<"%TEMP%\ss_pid.txt"
    del "%TEMP%\ss_pid.txt" >nul 2>&1
)
goto :eof

:wait_port
powershell -NoProfile -Command "$port=%~1; for($i=0; $i -lt 20; $i++){ try{ $t=New-Object Net.Sockets.TcpClient('127.0.0.1', $port); $t.Close(); exit 0 }catch{ Start-Sleep -Seconds 1 } }; exit 1" >nul 2>&1
goto :eof

:open_app_window
REM Launches ScrollScape in a Chromium "app mode" window (no address bar or
REM tabs) instead of a normal browser tab, so it feels like a desktop app.
REM Falls back to the system default browser if neither Chrome nor Edge
REM can be found.
echo   [ .. ]  Opening ScrollScape window...
set "APP_BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe"        set "APP_BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined APP_BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "APP_BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined APP_BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe"       set "APP_BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined APP_BROWSER if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "APP_BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined APP_BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"      set "APP_BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"

if defined APP_BROWSER (
    start "" "!APP_BROWSER!" --app=http://localhost:!PORT! --window-size=1280,832
    echo   [ OK ]  Opened in app window.
) else (
    start "" "http://localhost:!PORT!"
    echo   [ OK ]  No Chrome/Edge found - opened in your default browser instead.
)
goto :eof
