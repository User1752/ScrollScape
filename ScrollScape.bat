@echo off
:: Re-launch with delayed expansion enabled if not already active
if not "!!"=="" (
    cmd /v:on /c "%~f0" %*
    exit /b
)
setlocal EnableDelayedExpansion
:: Enable ANSI/VT in this console window
reg add HKCU\Console /v VirtualTerminalLevel /t REG_DWORD /d 1 /f >nul 2>&1
title ScrollScape
chcp 65001 >nul 2>&1
cls

::  ANSI colour palette 
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
set "YLW=!ESC![33m"
set "BYLW=!ESC![93m"
set "WHT=!ESC![97m"
set "GRY=!ESC![90m"

::  Carriage-return trick for in-place animation 
for /f %%a in ('copy /z "%~f0" nul') do set "CR=%%a"

set "_root=%~dp0"
cd /d "%~dp0"

::  1. Splash
call :banner

:: ============================================================================
:: Determine runtime – prefer Docker, fall back to Node.js
:: ============================================================================
set "NODE_EXE="
set "SS_PORT=3000"

:: --- Try Docker first -------------------------------------------------------
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 goto :check_docker

echo   !YLW!  [INFO]!R!  Docker not found -- trying Node.js.
echo.

:: --- Fall back to Node.js ---------------------------------------------------
node --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "NODE_EXE=node"
    for /f "tokens=*" %%V in ('node --version 2^>^&1') do set "NODEVER=%%V"
    echo   !BGRN!  [ OK ]!R!  Node.js !NODEVER! found.
    echo.
    goto :run_node
)

if exist "%~dp0tools\node\node.exe" (
    set "NODE_EXE=%~dp0tools\node\node.exe"
    for /f "tokens=*" %%V in ('"%~dp0tools\node\node.exe" --version 2^>^&1') do set "NODEVER=%%V"
    echo   !BGRN!  [ OK ]!R!  Local Node.js !NODEVER! found.
    echo.
    goto :run_node
)

call :err "Neither Docker nor Node.js found" "Install Docker: https://docs.docker.com/get-docker/  or Node.js: https://nodejs.org"
pause & exit /b 1

:: ============================================================================
:run_node
:: ============================================================================
call :find_port
call :start_node
if not defined NODE_PID (
    call :err "Failed to start server" "See above for errors."
    pause & exit /b 1
)
call :wait_port !SS_PORT!
echo.
call :status_box
start "" "http://localhost:!SS_PORT!"

:node_menu
echo.
echo   !GRY!  +-----------------------------------------------+!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!R!R!  !WHT!Restart ^& refresh                        !GRY!^|!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!Q!R!  !WHT!Quit                                     !GRY!^|!R!
echo   !GRY!  +-----------------------------------------------+!R!
choice /c RQ /n >nul
if errorlevel 2 goto :node_quit
if errorlevel 1 goto :node_restart

:node_restart
cls
echo.
echo   !BCYN!  Restarting...!R!
echo.
taskkill /pid !NODE_PID! /f >nul 2>&1
timeout /t 1 /nobreak >nul
call :find_port
call :start_node
if not defined NODE_PID (
    call :err "Failed to restart" ""
    goto :node_menu
)
call :wait_port !SS_PORT!
echo.
echo   !BGRN!  Done!!R!
goto :node_menu

:node_quit
taskkill /pid !NODE_PID! /f >nul 2>&1
exit /b 0

:: ============================================================================
:check_docker
:: ============================================================================
docker info >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :run_docker

echo   !BYLW!  [!R! ! !BYLW!]!R!  Docker Desktop is not running -- launching it...
echo.
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
call :spin_docker
echo.
echo.

:run_docker
cd /d "%~dp0docker"
call :docker_spin "up -d --build"
if %ERRORLEVEL% NEQ 0 (
    call :err "Failed to start" "Run:  docker compose up -d --build  to see full output."
    pause & exit /b 1
)
cd /d "%~dp0"
echo.
call :status_box
start "" "http://localhost:!SS_PORT!"

:docker_menu
echo.
echo   !GRY!  +-----------------------------------------------+!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!R!R!  !WHT!Rebuild ^& refresh                        !GRY!^|!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!Q!R!  !WHT!Quit                                     !GRY!^|!R!
echo   !GRY!  +-----------------------------------------------+!R!
choice /c RQ /n >nul
if errorlevel 2 goto :docker_quit
if errorlevel 1 goto :docker_rebuild

:docker_rebuild
cls
echo.
call :docker_spin "up -d --build"
if %ERRORLEVEL% NEQ 0 (
    call :err "Rebuild failed" "Run:  docker compose up -d --build  to see full output."
)
echo.
echo   !BGRN!  Done!!R!
goto :docker_menu

:docker_quit
cd /d "%~dp0docker"
docker compose down >nul 2>&1
cd /d "%~dp0"
exit /b 0

:: =============================================================================
:: SUBROUTINES
:: =============================================================================

:: Find first free port starting from 3000
:find_port
set "SS_PORT=3000"
:_fp_loop
powershell -NoProfile -Command "try{$t=New-Object Net.Sockets.TcpClient('127.0.0.1',!SS_PORT!);$t.Close();exit 1}catch{exit 0}" >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    set /a SS_PORT+=1
    if !SS_PORT! GTR 3020 (
        call :err "No free port found in range 3000-3020" ""
        exit /b 1
    )
    goto :_fp_loop
)
goto :eof

:: Start node server in background, capture PID into NODE_PID
:start_node
set "NODE_PID="
powershell -NoProfile -Command ^"$env:PORT='!SS_PORT!'; $p=Start-Process -FilePath '!NODE_EXE!' -ArgumentList 'server.js' -WorkingDirectory '!_root!' -WindowStyle Hidden -PassThru; $p.Id ^| Out-File ($env:TEMP + '\ss_pid.txt') -Encoding ASCII^" >nul 2>&1
set /p NODE_PID=<"%TEMP%\ss_pid.txt"
del "%TEMP%\ss_pid.txt" >nul 2>&1
goto :eof

:: Run docker compose <args> with a spinner, suppress all output.
:: Returns errorlevel from docker compose.
:docker_spin
set "_ds_args=%~1"
set "_ds_done=%TEMP%\ss_docker.done"
2>nul del "!_ds_done!"
set "_ds_label=Building"
if "!_ds_args!"=="down" set "_ds_label=Stopping"

:: Launch docker compose in background helper
set "_ds_hlp=%TEMP%\ss_docker_hlp.bat"
>>"!_ds_hlp!" (
    echo @echo off
    echo docker compose !_ds_args! ^>nul 2^>^&1
    echo echo !ERRORLEVEL!^>"!_ds_done!"
)
start "" /b cmd /c "!_ds_hlp!"

set "_ds_i=0"
set "_ds_chars=/ - \ |"
:_ds_loop
if exist "!_ds_done!" goto :_ds_done
set /a "_ds_f=_ds_i %% 4"
set "_ds_c=/"
if !_ds_f!==1 set "_ds_c=-"
if !_ds_f!==2 set "_ds_c=^\"
if !_ds_f!==3 set "_ds_c=|"
<nul set /p ="   !BCYN![ !_ds_c! ]!R!  !_ds_label!...  !CR!"
timeout /t 1 /nobreak >nul
set /a _ds_i+=1
goto :_ds_loop

:_ds_done
set /p _ds_rc=<"!_ds_done!"
2>nul del "!_ds_done!" "!_ds_hlp!"
<nul set /p ="                               !CR!"
if "!_ds_rc!"=="0" (
    echo   !BGRN!  [ OK ]!R!  Done.
    exit /b 0
) else (
    exit /b 1
)


:wait_port
set "_wp_try=0"
echo   !BCYN!  [ .. ]!R!  Waiting for server on port %~1...
:_wploop
if !_wp_try! GEQ 20 (
    echo   !BRED!  [WARN]!R!  Server did not respond in time.
    goto :eof
)
powershell -NoProfile -Command "try{$t=New-Object Net.Sockets.TcpClient('127.0.0.1',%~1);$t.Close();exit 0}catch{exit 1}" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   !BGRN!  [ OK ]!R!  Server ready!
    goto :eof
)
timeout /t 1 /nobreak >nul
set /a _wp_try+=1
goto :_wploop

::  Banner (big logo in box)
:banner
cls
echo.
echo   !GRY!  +=======================================================+!R!
echo   !GRY!  ^|!R!                                             !GRY!^|!R!
echo   !GRY!  ^|!R!    !BOLD!!BPUR!           ___ !R!           !GRY!^|!R!
echo   !GRY!  ^|!R!    !BOLD!!BPUR!          / __^|   / __^| !R!!GRY!^|!R!
echo   !GRY!  ^|!R!    !BOLD!!PUR!          \__ \  ^| (__!R!    !GRY!^|!R!
echo   !GRY!  ^|!R!    !DIM!!PUR!          ^|___/   \___^| !R!  !GRY!^|!R!
echo   !GRY!  ^|!R!                                             !GRY!^|!R!
echo   !GRY!  ^|!R!!DIM! Manga Reader . Node.js / Docker . localhost:3000 !R!!GRY!^|!R!
echo   !GRY!  +=======================================================+!R!
echo.
goto :eof

::  Status box
:status_box
echo   !GRY!  +-----------------------------------------------+!R!
echo   !GRY!  ^|!R!    !BGRN![ OK ]!R!  !BOLD!ScrollScape is running!R!              !GRY!^|!R!
echo   !GRY!  ^|!R!                                                 !GRY!^|!R!
echo   !GRY!  ^|!R!       !BOLD!!WHT!http://localhost:!SS_PORT!!R!                   !GRY!^|!R!
echo   !GRY!  +-----------------------------------------------+!R!
echo.
goto :eof

::  Error box
:err
echo   !GRY!  +-----------------------------------------------+!R!
echo   !GRY!  ^|!R!    !BRED![ ERR ]!R!  !BOLD!%~1!R!
if not "%~2"=="" echo   !GRY!  ^|!R!    !DIM!          %~2!R!
echo   !GRY!  +-----------------------------------------------+!R!
echo.
goto :eof

::  Docker daemon spinner
:spin_docker
set "sdi=0"
:_sdloop
set /a "f=sdi %% 4"
if !f!==0 (<nul set /p ="   !BCYN![ / ]!R!  Waiting for Docker daemon...  !CR!")
if !f!==1 (<nul set /p ="   !BCYN![ - ]!R!  Waiting for Docker daemon...  !CR!")
if !f!==2 (<nul set /p ="   !BCYN![ \ ]!R!  Waiting for Docker daemon...  !CR!")
if !f!==3 (<nul set /p ="   !BCYN![ | ]!R!  Waiting for Docker daemon...  !CR!")
set /a sdi+=1
timeout /t 1 /nobreak >nul
docker info >nul 2>nul
if %ERRORLEVEL% NEQ 0 goto :_sdloop
<nul set /p ="   !BGRN![ OK ]!R!  Docker is ready.                  "
echo.
goto :eof
