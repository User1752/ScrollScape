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
:: Determine runtime – prefer Node.js, fall back to Docker
:: ============================================================================
set "NODE_EXE="
set "SS_PORT=3000"

:: --- Try Node.js first ------------------------------------------------------
echo   !BCYN!  [ .. ]!R!  Scanning for Node.js runtime environment...
node --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set "NODE_EXE=node"
    set "NPM_CMD=npm"
    for /f "tokens=*" %%V in ('node --version 2^>^&1') do set "NODEVER=%%V"
    echo   !BGRN!  [ OK ]!R!  System Node.js !NODEVER! detected.
    goto :run_node
)

if exist "%~dp0tools\node\node.exe" (
    set "NODE_EXE=%~dp0tools\node\node.exe"
    set "NPM_CMD=%~dp0tools\node\npm.cmd"
    for /f "tokens=*" %%V in ('"%~dp0tools\node\node.exe" --version 2^>^&1') do set "NODEVER=%%V"
    echo   !BGRN!  [ OK ]!R!  Local Node.js !NODEVER! detected in tools\node\.
    goto :run_node
)

:: --- Auto-download portable Node.js 20 LTS ---------------------------------
echo   !YLW!  [INFO]!R!  Node.js not found — downloading portable Node.js 20 LTS into tools\node\...
echo.
call :download_node
if defined NODE_EXE goto :run_node

:: --- Fall back to Docker ----------------------------------------------------
echo   !YLW!  [INFO]!R!  Download failed. Checking if Docker CLI is available...
where docker >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo   !BGRN!  [ OK ]!R!  Docker runtime located.
    goto :check_docker
)

call :err "Neither Node.js nor Docker found" "Install Node.js: https://nodejs.org  or Docker: https://docs.docker.com/get-docker/"
pause & exit /b 1

:: ============================================================================
:run_node
:: ============================================================================
:: Install dependencies if node_modules is missing or incomplete
if not exist "%~dp0node_modules\express\package.json" (
    echo   !BCYN!  [ .. ]!R!  Installing dependencies into project folder...
    if not "!NODE_EXE!"=="node" set "PATH=%~dp0tools\node;!PATH!"
    call \"!NPM_CMD!\" install --cache \"%~dp0tools\\npm-cache\" --prefer-offline 2>&1
    if %ERRORLEVEL% NEQ 0 (
        call :err "npm install failed" "Check your internet connection."
        pause & exit /b 1
    )
    echo   !BGRN!  [ OK ]!R!  Dependencies installed.
    echo.
)
echo.
echo   !BCYN!  [ .. ]!R!  Reserving localhost network port...
call :cleanup_scrollscape_port_3000
call :find_port
echo   !BGRN!  [ OK ]!R!  Port !SS_PORT! secured for server.
echo   !BCYN!  [ .. ]!R!  Booting Node.js backend daemon...
call :start_node
if not defined NODE_PID (
    echo.
    call :err "Failed to start server daemon" "See logs for details."
    pause & exit /b 1
)
call :wait_port !SS_PORT!
echo.
call :status_box
start "" "http://localhost:!SS_PORT!"

:node_menu
echo.
echo   !GRY!  +-------------------------------------------------------+!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!R!R!  !WHT!Restart ^& refresh                                !GRY!^|!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!Q!R!  !WHT!Quit                                             !GRY!^|!R!
echo   !GRY!  +-------------------------------------------------------+!R!
powershell -NoProfile -Command "while($true){$k=[Console]::ReadKey($true).KeyChar.ToString().ToUpper(); if($k -eq 'R'){exit 1}; if($k -eq 'Q'){exit 2}}"
if errorlevel 2 goto :node_quit
if errorlevel 1 goto :node_restart

:node_restart
cls
call :banner
echo   !BCYN!  [ .. ]!R!  Terminating old server process...
taskkill /pid !NODE_PID! /f >nul 2>&1
timeout /t 1 /nobreak >nul
echo   !BGRN!  [ OK ]!R!  Process terminated.
echo   !BCYN!  [ .. ]!R!  Reserving localhost network port...
call :cleanup_scrollscape_port_3000
call :find_port
echo   !BGRN!  [ OK ]!R!  Port !SS_PORT! secured for new instance.
echo   !BCYN!  [ .. ]!R!  Booting new Node.js daemon...
call :start_node
if not defined NODE_PID (
    echo.
    call :err "Failed to restart" ""
    goto :node_menu
)
call :wait_port !SS_PORT!
echo.
call :status_box
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
echo.
echo   !BCYN!  [ .. ]!R!  Spinning up Docker containers...
call :docker_spin "up -d --build"
if %ERRORLEVEL% NEQ 0 (
    echo.
    call :err "Docker Compose failed to start" "Run locally: docker compose up -d --build"
    pause & exit /b 1
)
cd /d "%~dp0"
echo.
call :status_box
start "" "http://localhost:!SS_PORT!"

:docker_menu
echo.
echo   !GRY!  +-------------------------------------------------------+!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!R!R!  !WHT!Rebuild ^& refresh                                !GRY!^|!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!Q!R!  !WHT!Quit                                             !GRY!^|!R!
echo   !GRY!  +-------------------------------------------------------+!R!
powershell -NoProfile -Command "while($true){$k=[Console]::ReadKey($true).KeyChar.ToString().ToUpper(); if($k -eq 'R'){exit 1}; if($k -eq 'Q'){exit 2}}"
if errorlevel 2 goto :docker_quit
if errorlevel 1 goto :docker_rebuild

:docker_rebuild
cls
call :banner
echo   !BCYN!  [ .. ]!R!  Rebuilding and restarting Docker containers...
echo.
call :docker_spin "up -d --build"
if %ERRORLEVEL% NEQ 0 (
    echo.
    call :err "Rebuild failed" "Run locally: docker compose up -d --build"
) else (
    echo.
    call :status_box
)
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
powershell -NoProfile -Command ^"$env:PORT='!SS_PORT!'; $serverPath=Join-Path '!_root!' 'server.js'; $p=Start-Process -FilePath '!NODE_EXE!' -ArgumentList $serverPath -WorkingDirectory '!_root!' -WindowStyle Hidden -PassThru; $p.Id ^| Out-File ($env:TEMP + '\ss_pid.txt') -Encoding ASCII^" >nul 2>&1
set /p NODE_PID=<"%TEMP%\ss_pid.txt"
del "%TEMP%\ss_pid.txt" >nul 2>&1
goto :eof

:: If port 3000 is held by an old ScrollScape node server, kill it so restart
:: always reuses the canonical URL and doesn't silently drift to 3001+.
:cleanup_scrollscape_port_3000
set "_cs_rc="
for /f %%R in ('powershell -NoProfile -Command "try { $c = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if(-not $c){ Write-Output 0; exit 0 }; $op = $c.OwningProcess; $p = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $op); if([string]$p.Name -ieq 'node.exe'){ Stop-Process -Id $op -Force -ErrorAction SilentlyContinue; Write-Output 1; exit 0 }; Write-Output 0; exit 0 } catch { Write-Output 0; exit 0 }"') do set "_cs_rc=%%R"
if "!_cs_rc!"=="1" (
    echo   !BYLW!  [INFO]!R!  Removed stale ScrollScape server on port 3000.
)
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

:download_node
if not exist "%~dp0tools" mkdir "%~dp0tools"
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "try{$r=(Invoke-WebRequest 'https://nodejs.org/dist/latest-v20.x/' -UseBasicParsing).Content;$m=[regex]::Match($r,'node-(v20\.[0-9]+\.[0-9]+)-win-x64\.zip');if($m.Success){Write-Output $m.Value}else{exit 1}}catch{exit 1}"`) do set "NODE_ZIP=%%F"
if not defined NODE_ZIP (
    echo   !BRED!  [ ERR ]!R!  Could not resolve Node.js 20 version from nodejs.org.
    goto :eof
)
set "NODE_URL=https://nodejs.org/dist/latest-v20.x/!NODE_ZIP!"
set "NODE_ZIPPATH=%~dp0tools\!NODE_ZIP!"
echo   !BCYN!  [ .. ]!R!  Downloading !BOLD!!NODE_ZIP!!R! ...
powershell -NoProfile -Command "try{Invoke-WebRequest '!NODE_URL!' -OutFile '!NODE_ZIPPATH!' -UseBasicParsing}catch{Write-Error $_.Exception.Message;exit 1}"
if %ERRORLEVEL% NEQ 0 (
    echo   !BRED!  [ ERR ]!R!  Download failed — check your internet connection.
    goto :eof
)
echo   !BGRN!  [ OK ]!R!  Download complete.
echo.
echo   !BCYN!  [ .. ]!R!  Extracting...
powershell -NoProfile -Command "Expand-Archive -Path '!NODE_ZIPPATH!' -DestinationPath '%~dp0tools\_noderaw' -Force"
if %ERRORLEVEL% NEQ 0 (
    echo   !BRED!  [ ERR ]!R!  Extraction failed.
    if exist "!NODE_ZIPPATH!" del /f /q "!NODE_ZIPPATH!"
    goto :eof
)
if exist "%~dp0tools\node" rd /s /q "%~dp0tools\node"
for /d %%D in ("%~dp0tools\_noderaw\node-v*") do move "%%D" "%~dp0tools\node" >nul
if exist "%~dp0tools\_noderaw" rd /s /q "%~dp0tools\_noderaw"
del /f /q "!NODE_ZIPPATH!" >nul 2>&1
if exist "%~dp0tools\node\node.exe" (
    set "NODE_EXE=%~dp0tools\node\node.exe"
    set "NPM_CMD=%~dp0tools\node\npm.cmd"
    for /f "tokens=*" %%V in ('"%~dp0tools\node\node.exe" --version 2^>^&1') do set "NODEVER=%%V"
    echo   !BGRN!  [ OK ]!R!  Node.js !NODEVER! installed to tools\node\
    echo.
) else (
    echo   !BRED!  [ ERR ]!R!  Extraction did not produce tools\node\node.exe.
)
goto :eof

::  Banner (big logo in box)
:banner
cls
echo.
echo   !GRY!  +=======================================================+!R!
echo   !GRY!  ^|!R!                                                       !GRY!^|!R!
echo   !GRY!  ^|!R!    !BOLD!!BPUR!_____  _____!R!                                       !GRY!^|!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!/ ____^|/ ____^|!R!      !BOLD!ScrollScape!R!                     !GRY!^|!R!
echo   !GRY!  ^|!R!  !BOLD!!PUR!^| (___ ^| (___!R!        !DIM!Manga Reader!R!                    !GRY!^|!R!
echo   !GRY!  ^|!R!   !BOLD!!PUR!\___ \ \___ \!R!                                       !GRY!^|!R!
echo   !GRY!  ^|!R!   !DIM!!PUR!____^) ^|____^) ^|!R!      !DIM!Node.js ^& Docker!R!                !GRY!^|!R!
echo   !GRY!  ^|!R!  !DIM!!PUR!^|_____/^|_____/!R!       !DIM!Localhost Server!R!                !GRY!^|!R!
echo   !GRY!  ^|!R!                                                       !GRY!^|!R!
echo   !GRY!  +=======================================================+!R!
echo.
goto :eof

::  Status box
:status_box
echo   !GRY!  +-------------------------------------------------------+!R!
echo   !GRY!  ^|!R!    !BGRN![ OK ]!R!  !BOLD!ScrollScape is running!R!                     !GRY!^|!R!
echo   !GRY!  ^|!R!                                                       !GRY!^|!R!
echo   !GRY!  ^|!R!       !BOLD!!WHT!http://localhost:!SS_PORT!!R!                           !GRY!^|!R!
echo   !GRY!  +-------------------------------------------------------+!R!
echo.
goto :eof

::  Error box
:err
echo   !GRY!  +-------------------------------------------------------+!R!
echo   !GRY!  ^|!R!    !BRED![ ERR ]!R!  !BOLD!%~1!R!
if not "%~2"=="" echo   !GRY!  ^|!R!    !DIM!          %~2!R!
echo   !GRY!  +-------------------------------------------------------+!R!
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
