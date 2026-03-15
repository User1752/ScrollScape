@echo off
setlocal EnableDelayedExpansion
title ScrollScape - EXE Builder
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

cd /d "%~dp0"
call :banner

:: --- Step 1: ensure dist\ exists ------------------------------------------
if not exist "dist" mkdir dist

:: ============================================================================
:: Determine Node.js  –  1) system  2) tools\node  3) auto-download  4) Docker
:: ============================================================================
set "NODE_EXE="
set "NPM_CMD="

echo   !BCYN!  [ .. ]!R!  Checking for Node.js...
node --version >nul 2>&1
if %errorlevel% equ 0 (
    set "NODE_EXE=node"
    set "NPM_CMD=npm"
    for /f "tokens=*" %%V in ('node --version 2^>^&1') do set "NODEVER=%%V"
    echo   !BGRN!  [ OK ]!R!  System Node.js !NODEVER! found.
    echo.
    goto :build_node
)

if exist "%~dp0tools\node\node.exe" (
    set "NODE_EXE=%~dp0tools\node\node.exe"
    set "NPM_CMD=%~dp0tools\node\npm.cmd"
    for /f "tokens=*" %%V in ('"%~dp0tools\node\node.exe" --version 2^>^&1') do set "NODEVER=%%V"
    echo   !BGRN!  [ OK ]!R!  Local Node.js !NODEVER! found in tools\node\.
    echo.
    goto :build_node
)

echo   !YLW!  [INFO]!R!  Node.js not found  ^-^-  downloading portable Node.js 20 LTS...
echo.
call :download_node
if defined NODE_EXE goto :build_node

echo   !YLW!  [SKIP]!R!  Download failed  ^-^-  falling back to Docker.
echo.
goto :build_docker

:: ============================================================================
:build_node
:: ============================================================================

:: If using a local node, add it to PATH so pkg.cmd can find node at compile time
if not "!NODE_EXE!"=="node" set "PATH=%~dp0tools\node;!PATH!"

:: Install / refresh dependencies (including devDeps for pkg)
echo   !BCYN!  [ .. ]!R!  Installing dependencies...
call "!NPM_CMD!" install 2>&1
if %errorlevel% neq 0 (
    call :err "npm install failed" "See output above."
    goto :end
)
echo   !BGRN!  [ OK ]!R!  Dependencies ready.
echo.

:: Compile via pkg
echo   !BCYN!  [ .. ]!R!  Compiling !BOLD!ScrollScape.exe!R! !DIM!(may take 1-3 min on first run)!R!...
echo.
call "!NPM_CMD!" run build:exe 2>&1
if %errorlevel% neq 0 (
    call :err "pkg compilation failed" "See output above."
    goto :end
)

:: pkg outputs to dist\ScrollScape-win.exe  (see package.json build:win)
:: Rename to the canonical ScrollScape.exe so the success check below is uniform
if exist "dist\ScrollScape-win.exe" (
    if exist "dist\ScrollScape.exe" del /f /q "dist\ScrollScape.exe"
    ren "dist\ScrollScape-win.exe" "ScrollScape.exe"
)
goto :verify

:: ============================================================================
:build_docker
:: ============================================================================

:: --- Build Docker image ----------------------------------------------------
echo   !BCYN!  [ .. ]!R!  Building Docker image !DIM!(first run may take a while)!R!...
echo.
docker build -f Dockerfile.build -t scrollscape-builder . 2>&1
if %errorlevel% neq 0 (
    echo.
    call :err "Docker image build failed" "Is Docker Desktop running?"
    goto :end
)
echo.
echo   !BGRN!  [ OK ]!R!  Docker image ready.
echo.

:: --- Run pkg inside Docker -------------------------------------------------
echo   !BCYN!  [ .. ]!R!  Compiling !BOLD!ScrollScape.exe!R! !DIM!(this takes 1-3 min)!R!...
echo.
docker run --rm -v "%cd%\dist:/out" scrollscape-builder 2>&1
if %errorlevel% neq 0 (
    echo.
    call :err "pkg compilation failed" "See output above."
    goto :end
)
goto :verify

:: ============================================================================
:verify
:: ============================================================================
if not exist "dist\ScrollScape.exe" (
    call :err "dist\ScrollScape.exe was not created" "See output above."
    goto :end
)

echo.
echo   !GRY!  +-----------------------------------------------+!R!
echo   !GRY!  ^|!R!    !BGRN![ OK ]!R!  !BOLD!dist\ScrollScape.exe is ready!!R!             !GRY!^|!R!
echo   !GRY!  ^|!R!                                                 !GRY!^|!R!
echo   !GRY!  ^|!R!    !WHT!Copy it anywhere and double-click it.!R!    !GRY!^|!R!
echo   !GRY!  ^|!R!    !DIM!No Docker or Node.js needed on the target.!R! !GRY!^|!R!
echo   !GRY!  +-----------------------------------------------+!R!
echo.
goto :end

:: =============================================================================
:: SUBROUTINES
:: =============================================================================

:download_node
if not exist "%~dp0tools" mkdir "%~dp0tools"

:: Query nodejs.org for the latest v20.x Windows x64 zip filename
for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "try{$r=(Invoke-WebRequest 'https://nodejs.org/dist/latest-v20.x/' -UseBasicParsing).Content;$m=[regex]::Match($r,'node-(v20\.[0-9]+\.[0-9]+)-win-x64\.zip');if($m.Success){Write-Output $m.Value}else{exit 1}}catch{exit 1}"`) do set "NODE_ZIP=%%F"

if not defined NODE_ZIP (
    echo   !BRED!  [ ERR ]!R!  Could not resolve latest Node.js 20 version from nodejs.org.
    goto :eof
)

set "NODE_URL=https://nodejs.org/dist/latest-v20.x/!NODE_ZIP!"
set "NODE_ZIPPATH=%~dp0tools\!NODE_ZIP!"

echo   !BCYN!  [ .. ]!R!  Downloading !BOLD!!NODE_ZIP!!R! ...
powershell -NoProfile -Command "try{Invoke-WebRequest '!NODE_URL!' -OutFile '!NODE_ZIPPATH!' -UseBasicParsing}catch{Write-Error $_.Exception.Message;exit 1}"
if %errorlevel% neq 0 (
    echo   !BRED!  [ ERR ]!R!  Download failed -- check your internet connection.
    goto :eof
)
echo   !BGRN!  [ OK ]!R!  Download complete.
echo.

echo   !BCYN!  [ .. ]!R!  Extracting...
powershell -NoProfile -Command "Expand-Archive -Path '!NODE_ZIPPATH!' -DestinationPath '%~dp0tools\_noderaw' -Force"
if %errorlevel% neq 0 (
    echo   !BRED!  [ ERR ]!R!  Extraction failed.
    if exist "!NODE_ZIPPATH!" del /f /q "!NODE_ZIPPATH!"
    goto :eof
)

:: Move extracted versioned folder to tools\node
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
    echo   !BRED!  [ ERR ]!R!  Extraction did not produce tools\node\node.exe -- unexpected zip layout.
)
goto :eof

:banner
cls
echo.
echo   !GRY!  +=======================================================+!R!
echo   !GRY!  ^|!R!                                                           !GRY!^|!R!
echo   !GRY!  ^|!R!    !BOLD!!BPUR! ^|V^|   /\   ^|\^|   (^~   ^|-^|   ^| ^|!R!             !GRY!^|!R!
echo   !GRY!  ^|!R!    !BOLD!!PUR! ^|  ^|  /--\  ^| \^|  (_    ^|_^|   ^| ^|!R!             !GRY!^|!R!
echo   !GRY!  ^|!R!    !DIM!!PUR! ^|  ^| /    \ ^|  \^|   _^)  ^| ^|  \__/!R!               !GRY!^|!R!
echo   !GRY!  ^|!R!                                                           !GRY!^|!R!
echo   !GRY!  ^|!R!    !DIM!EXE Builder  .  pkg  .  Docker!R!                      !GRY!^|!R!
echo   !GRY!  +=======================================================+!R!
echo.
goto :eof

:err
echo   !GRY!  +-----------------------------------------------+!R!
echo   !GRY!  ^|!R!    !BRED![ ERR ]!R!  !BOLD!%~1!R!
if not "%~2"=="" echo   !GRY!  ^|!R!             !DIM!%~2!R!
echo   !GRY!  +-----------------------------------------------+!R!
echo.
goto :eof

:end
pause >nul
endlocal
