@echo off
echo Running ScrollScape Validation Routine...

echo.
echo [1/3] Running ESLint...
call tools\node\node.exe node_modules\eslint\bin\eslint.js server/modules/common/**/*.js server/modules/http/**/*.js tests/**/*.js tools/smoke-check.js
if %errorlevel% neq 0 (
    echo [ERROR] Linter failed. Please fix syntax and style errors.
    exit /b %errorlevel%
)

echo.
echo [2/3] Running Smoke Checks...
call tools\node\node.exe tools/smoke-check.js
if %errorlevel% neq 0 (
    echo [ERROR] Smoke checks failed. Some critical backend files have syntax errors.
    exit /b %errorlevel%
)

echo.
echo [3/3] Running Unit Tests...
call tools\node\node.exe --test tests
if %errorlevel% neq 0 (
    echo [ERROR] Unit tests failed.
    exit /b %errorlevel%
)

echo.
echo [SUCCESS] All validation checks passed! Ready for release.
exit /b 0
