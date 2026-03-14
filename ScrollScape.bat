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

cd /d "%~dp0"

::  1. Splash 
call :banner

::  2. Check Docker is installed 
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    call :err "Docker not found" "Install Docker Desktop  https://docs.docker.com/get-docker/"
    pause & exit /b 1
)

::  3. Ensure Docker daemon is running 
docker info >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :boot

echo   !BYLW!  [!R! ! !BYLW!]!R!  Docker Desktop is not running -- launching it...
echo.
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
call :spin_docker
echo.
echo.

::  4. Build and launch 
:boot
cd /d "%~dp0docker"
echo   !BCYN!  [ .. ]!R!  Starting ScrollScape...
echo.
docker compose up -d --build
if ERRORLEVEL 1 (
    echo.
    call :err "Failed to start" "Is Docker Desktop running?"
    pause & exit /b 1
)
cd /d "%~dp0"
echo.
call :status_box
start "" "http://localhost:3000"

::  5. Interactive menu 
:menu
echo.
echo   !GRY!  +-----------------------------------------------+!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!R!R!  !WHT!Rebuild ^& refresh                        !GRY!^|!R!
echo   !GRY!  ^|!R!   !BOLD!!BPUR!Q!R!  !WHT!Quit                                     !GRY!^|!R!
echo   !GRY!  +-----------------------------------------------+!R!
echo.
for /f "delims=" %%k in ('powershell -noprofile -nologo -command "$k=$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown'); Write-Output $k.Character"') do set "_key=%%k"
if /i "!_key!"=="R" goto :do_rebuild
if /i "!_key!"=="Q" goto :do_quit
goto :menu

::  Rebuild 
:do_rebuild
cls
echo.
echo   !BCYN!  Rebuilding...!R!
echo.
cd /d "%~dp0docker"
docker compose up -d --build
cd /d "%~dp0"
echo.
echo   !BGRN!  Done!!R!
goto :menu

::  Quit 
:do_quit
echo.
echo   !BCYN!  Stopping...!R!
cd /d "%~dp0docker"
docker compose down >nul 2>&1
cd /d "%~dp0"
echo   !BGRN!  Goodbye!!R!
echo.
timeout /t 2 /nobreak >nul
exit /b 0

:: =============================================================================
:: SUBROUTINES
:: =============================================================================

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
echo   !GRY!  ^|!R!!DIM!Manga Reader  Docker  localhost:3000 !R!!GRY!^|!R!
echo   !GRY!  +=======================================================+!R!
echo.
goto :eof

::  Status box 
:status_box
echo   !GRY!  +-----------------------------------------------+!R!
echo   !GRY!  ^|!R!    !BGRN![ OK ]!R!  !BOLD!ScrollScape is running!R!                     !GRY!^|!R!
echo   !GRY!  ^|!R!                                                 !GRY!^|!R!
echo   !GRY!  ^|!R!       !BOLD!!WHT!http://localhost:3000!R!                   !GRY!^|!R!
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

::  Background build with animated progress bar 
:do_build
set "LOGF=%TEMP%\scrollscape_build.log"
set "DONEF=%TEMP%\scrollscape_build.done"
set "HLPF=%TEMP%\scrollscape_build_helper.bat"
2>nul del "!DONEF!" "!LOGF!" "!HLPF!"

:: Write helper script (runs in bg, writes result flag when done)
>>"%HLPF%" (
    echo @echo off
    echo docker compose up -d --build ^>"!LOGF!" 2^>^&1
    echo if errorlevel 1 ^(echo FAIL^>"!DONEF!"^) else ^(echo OK^>"!DONEF!"^)
)
start "" /b "!HLPF!"

:: Animated progress bar while docker runs in background
set "tick=0"
set "BAR=30"
:_bploop
if exist "!DONEF!" goto :_bpdone
set /a "tick+=1"
set /a "f=tick %% 8"
if !f!==0 set "SP=>"
if !f!==1 set "SP=>"
if !f!==2 set "SP=-"
if !f!==3 set "SP=-"
if !f!==4 set "SP=<"
if !f!==5 set "SP=<"
if !f!==6 set "SP=-"
if !f!==7 set "SP=-"
set /a "fill=tick %% (BAR+1)"
set "bar="
for /l %%i in (1,1,!fill!) do set "bar=!bar!#"
set /a "emp_cnt=BAR-fill"
set "emp="
for /l %%i in (1,1,!emp_cnt!) do set "emp=!emp!."
<nul set /p ="   !BCYN![!SP!]!R!  Building   !GRY![!BCYN!!bar!!GRY!!emp!]!R!  !DIM!!tick!s!R!!CR!"
timeout /t 1 /nobreak >nul
goto :_bploop

:_bpdone
set /p BUILD_RESULT=<"!DONEF!"
2>nul del "!DONEF!" "!HLPF!"
<nul set /p ="                                                                    !CR!"
set "BUILD_OK=0"
if "!BUILD_RESULT!"=="FAIL" set "BUILD_OK=1"
if !BUILD_OK! EQU 0 echo   !BGRN!  [ OK ]!R!  Build complete!
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

::  Quit animation 
:anim_quit
set "qi=0"
:_qloop
if !qi! GEQ 3 goto :_qdone
set /a "f=qi %% 4"
if !f!==0 (<nul set /p ="   !BCYN![ / ]!R!  Stopping ScrollScape...  !CR!")
if !f!==1 (<nul set /p ="   !BCYN![ - ]!R!  Stopping ScrollScape...  !CR!")
if !f!==2 (<nul set /p ="   !BCYN![ \ ]!R!  Stopping ScrollScape...  !CR!")
if !f!==3 (<nul set /p ="   !BCYN![ | ]!R!  Stopping ScrollScape...  !CR!")
timeout /t 1 /nobreak >nul
set /a qi+=1
goto :_qloop
:_qdone
docker compose down >nul 2>&1
<nul set /p ="                                        !CR!"
goto :eof
