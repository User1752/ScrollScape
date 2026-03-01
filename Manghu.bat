@echo off
setlocal EnableDelayedExpansion
title Manghu
chcp 65001 >nul 2>&1
cls

::  ANSI colors (Windows 10+ virtual terminal) 
for /F "delims=#" %%E in ('"prompt #$E# & for %%e in (1) do rem"') do set "ESC=%%E"
set "R=!ESC![0m"
set "BOLD=!ESC![1m"
set "DIM=!ESC![2m"
set "PUR=!ESC![35m"
set "CYN=!ESC![36m"
set "GRN=!ESC![32m"
set "RED=!ESC![31m"
set "YLW=!ESC![33m"
set "WHT=!ESC![97m"

::  Carriage return for in-place spinner 
for /f %%a in ('copy /z "%~f0" nul') do set "CR=%%a"

cd /d "%~dp0"

::  1. Check Docker is installed 
where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    call :banner
    call :err "Docker not found" "Get it at https://www.docker.com/products/docker-desktop"
    pause & exit /b 1
)

::  2. Check Docker daemon 
docker info >nul 2>nul
if %ERRORLEVEL% EQU 0 goto :boot

call :banner
echo   !YLW![ ! ]!R!  Docker Desktop is not running -- launching it...
echo.
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
call :spin_docker
echo.

::  3. Start server 
:boot
cd docker
call :launch
goto :menu

:: 
:launch
cls
call :banner
echo   !CYN![ .. ]!R!  Building image and starting container...
echo.
docker compose up -d --build
if %ERRORLEVEL% NEQ 0 (
    echo.
    call :err "Failed to start" "Is Docker Desktop running?"
    pause & exit /b 1
)
echo.
call :status_box
start "" "http://localhost:3000"
goto :eof

:: 
:menu
call :menu_prompt
if %ERRORLEVEL% EQU 1 goto :refresh
if %ERRORLEVEL% EQU 2 goto :quit
goto :menu

:menu_prompt
echo   !DIM!  ------------------------------------------!R!
echo   !BOLD!!WHT!  [ R ]!R!  Rebuild ^& refresh
echo   !BOLD!!WHT!  [ Q ]!R!  Quit ^& stop server
echo.
choice /c RQ /n /m "  > "
goto :eof

:: 
:refresh
cls
call :banner
echo   !CYN![ .. ]!R!  Rebuilding...
echo.
docker compose up -d --build
if %ERRORLEVEL% NEQ 0 (
    echo.
    call :err "Rebuild failed" "Check the output above for details"
    goto :menu
)
echo.
echo   !GRN![ OK ]!R!  Refreshed -- http://localhost:3000
echo.
goto :menu

:: 
:quit
echo.
echo   !CYN![ .. ]!R!  Stopping Manghu...
docker compose down
echo.
echo   !GRN![ OK ]!R!  Server stopped. Goodbye!
echo.
timeout /t 2 /nobreak >nul
exit /b 0

:: 
:banner
cls
echo.
echo   !PUR!!BOLD!  M  A  N  G  H  U!R!
echo   !DIM!  ---------------------!R!
echo   !DIM!  Manga Reader  ^|  Docker  ^|  localhost:3000!R!
echo.
goto :eof

:: 
:status_box
echo   !GRN!  [ OK ]  Manghu is running!R!
echo.
echo         !WHT!http://localhost:3000!R!
echo.
goto :eof

:: 
:err
echo   !RED!  [ ERR ]!R!  %~1
if not "%~2"=="" echo   !DIM!           %~2!R!
echo.
goto :eof

:: 
:spin_docker
set "si=0"
:_sdloop
set /a "f=si%%4"
if !f!==0 (<nul set /p ="   !CYN![ / ]!R!  Waiting for Docker...!CR!")
if !f!==1 (<nul set /p ="   !CYN![ - ]!R!  Waiting for Docker...!CR!")
if !f!==2 (<nul set /p ="   !CYN![ \ ]!R!  Waiting for Docker...!CR!")
if !f!==3 (<nul set /p ="   !CYN![ | ]!R!  Waiting for Docker...!CR!")
set /a si+=1
timeout /t 1 /nobreak >nul
docker info >nul 2>nul
if %ERRORLEVEL% NEQ 0 goto :_sdloop
<nul set /p ="   !GRN![ OK ]!R!  Docker is ready.          "
goto :eof