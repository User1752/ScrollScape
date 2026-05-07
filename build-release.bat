@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  ScrollScape — Release Archive Builder
::  Creates dist\ScrollScape-v<version>.zip with only the
::  files needed to run the app (no dev/test artefacts).
:: ============================================================

:: Read version from package.json
for /f "tokens=2 delims=:," %%V in ('findstr /C:"\"version\"" "%~dp0package.json"') do (
    set "RAW=%%V"
    set "RAW=!RAW: =!"
    set "RAW=!RAW:"=!"
    set VERSION=!RAW!
    goto :got_version
)
:got_version
set "OUTDIR=%~dp0dist"
set "ZIPNAME=ScrollScape-v%VERSION%.zip"
set "ZIPPATH=%OUTDIR%\%ZIPNAME%"
set "STAGEDIR=%OUTDIR%\staging"

echo.
echo  Building release archive: %ZIPNAME%
echo.

:: Clean staging
if exist "%STAGEDIR%" rmdir /s /q "%STAGEDIR%"
mkdir "%STAGEDIR%"
if not exist "%OUTDIR%" mkdir "%OUTDIR%"

:: ── Essential files ──────────────────────────────────────────
xcopy /e /i /q "%~dp0public"          "%STAGEDIR%\public"   >nul
xcopy /e /i /q "%~dp0server"          "%STAGEDIR%\server"   >nul
xcopy /e /i /q "%~dp0docker"          "%STAGEDIR%\docker"   >nul

:: data — only non-personal files
mkdir "%STAGEDIR%\data\sources"
mkdir "%STAGEDIR%\data\cache"
mkdir "%STAGEDIR%\data\local"
mkdir "%STAGEDIR%\data\tmp"
copy /y "%~dp0data\achievements.json"    "%STAGEDIR%\data\" >nul
copy /y "%~dp0data\icon-mapping.json"    "%STAGEDIR%\data\" >nul
copy /y "%~dp0data\store.json.example"   "%STAGEDIR%\data\" >nul
xcopy /e /i /q "%~dp0data\sources"      "%STAGEDIR%\data\sources" >nul

:: Root files
copy /y "%~dp0server.js"        "%STAGEDIR%\" >nul
copy /y "%~dp0package.json"     "%STAGEDIR%\" >nul
copy /y "%~dp0package-lock.json" "%STAGEDIR%\" >nul
copy /y "%~dp0ScrollScape.bat"  "%STAGEDIR%\" >nul
copy /y "%~dp0scrollscape.sh"   "%STAGEDIR%\" >nul
copy /y "%~dp0README.md"        "%STAGEDIR%\" >nul
copy /y "%~dp0.gitignore"       "%STAGEDIR%\" >nul

:: ── Remove GIF wallpapers from public (personal files) ──────
del /q "%STAGEDIR%\public\*.gif"  2>nul
del /q "%STAGEDIR%\public\*.webp" 2>nul

:: ── Create ZIP using PowerShell ─────────────────────────────
if exist "%ZIPPATH%" del /f /q "%ZIPPATH%"
powershell -NoProfile -Command "Compress-Archive -Path '%STAGEDIR%\*' -DestinationPath '%ZIPPATH%' -Force"

:: Clean up staging
rmdir /s /q "%STAGEDIR%"

if exist "%ZIPPATH%" (
    echo  [OK]  dist\%ZIPNAME% created successfully.
    echo.
    for %%F in ("%ZIPPATH%") do echo        Size: %%~zF bytes
) else (
    echo  [ERR] Failed to create archive.
    exit /b 1
)

echo.
echo  Attach dist\%ZIPNAME% to the GitHub release at:
echo  https://github.com/User1752/ScrollScape/releases
echo.
pause
