#!/usr/bin/env bash
echo "Running ScrollScape Validation Routine..."

echo ""
echo "[1/3] Running ESLint..."
./tools/node/node node_modules/eslint/bin/eslint.js server/modules/common/**/*.js server/modules/http/**/*.js tests/**/*.js tools/smoke-check.js
if [ $? -ne 0 ]; then
    echo "[ERROR] Linter failed. Please fix syntax and style errors."
    exit 1
fi

echo ""
echo "[2/3] Running Smoke Checks..."
./tools/node/node tools/smoke-check.js
if [ $? -ne 0 ]; then
    echo "[ERROR] Smoke checks failed. Some critical backend files have syntax errors."
    exit 1
fi

echo ""
echo "[3/3] Running Unit Tests..."
./tools/node/node --test tests
if [ $? -ne 0 ]; then
    echo "[ERROR] Unit tests failed."
    exit 1
fi

echo ""
echo "[SUCCESS] All validation checks passed! Ready for release."
exit 0
