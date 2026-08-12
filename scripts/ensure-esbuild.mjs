import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const candidates = [
  'node_modules/esbuild/install.js',
  'frontend/node_modules/esbuild/install.js',
  'node_modules/esbuild/bin/esbuild',
];

function tryVersion() {
  const bins = [
    'node_modules/esbuild/bin/esbuild',
    'frontend/node_modules/esbuild/bin/esbuild',
  ];
  for (const bin of bins) {
    if (!existsSync(bin)) continue;
    const r = spawnSync(process.execPath, [bin, '--version'], { encoding: 'utf8' });
    if (r.status === 0) return true;
  }
  return false;
}

if (tryVersion()) process.exit(0);

for (const file of candidates) {
  if (!file.endsWith('install.js') || !existsSync(file)) continue;
  console.log('[ensure-esbuild] running', file);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (r.status === 0 && tryVersion()) process.exit(0);
}

// Not fatal — Vite may still resolve esbuild another way
console.warn('[ensure-esbuild] could not verify esbuild binary; continuing');
process.exit(0);
