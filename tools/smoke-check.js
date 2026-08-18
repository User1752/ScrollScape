'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function collectJsFiles(rootDir, acc = []) {
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(fullPath, acc);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith('.js')) {
      acc.push(fullPath);
    }
  }
  return acc;
}

function runNodeCheck(filePath) {
  return spawnSync(process.execPath, ['--check', filePath], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function main() {
  const root = path.resolve(__dirname, '..');
  const targets = [
    path.join(root, 'server.js'),
    ...collectJsFiles(path.join(root, 'server')),
  ];

  let failures = 0;
  for (const target of targets) {
    const res = runNodeCheck(target);
    if (res.status !== 0) {
      failures += 1;
      console.error(`SMOKE FAIL: ${target}`);
      if (res.stderr) console.error(res.stderr.trim());
      if (res.stdout) console.error(res.stdout.trim());
    }
  }

  if (failures > 0) {
    console.error(`Smoke check failed on ${failures} file(s).`);
    process.exit(1);
  }

  console.log(`Smoke check passed (${targets.length} files).`);
}

main();
