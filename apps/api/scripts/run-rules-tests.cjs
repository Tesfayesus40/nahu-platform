/**
 * Cross-platform runner for all *.rules.test.mjs under src/.
 * Uses tsx so tests can import sibling *.ts rule modules (PR-C3).
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, out);
    else if (name.name.endsWith('.rules.test.mjs')) out.push(full);
  }
  return out;
}

const root = path.join(__dirname, '..', 'src');
const files = walk(root).sort();
if (files.length === 0) {
  console.error('No *.rules.test.mjs files found under src/');
  process.exit(1);
}

// Node --import requires a file:// URL on Windows (not raw C:\ paths).
const tsxLoader = pathToFileURL(require.resolve('tsx/esm')).href;
const result = spawnSync(
  process.execPath,
  ['--import', tsxLoader, '--test', ...files],
  { stdio: 'inherit', cwd: path.join(__dirname, '..') },
);
process.exit(result.status ?? 1);
