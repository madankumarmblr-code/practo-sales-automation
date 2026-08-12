#!/usr/bin/env node
/**
 * Guard + deploy helper for Cloudflare Workers Builds.
 * Ensures frontend/dist exists, then runs `wrangler deploy`.
 * Safe to use as the dashboard Deploy command: `npm run deploy`
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'frontend', 'dist', 'index.html');

if (!existsSync(dist)) {
  console.error(
    '[cf-deploy] frontend/dist is missing. Set Build command to: npm run build'
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync('npx', ['wrangler', 'deploy', ...args], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: false,
});

process.exit(result.status ?? 1);
