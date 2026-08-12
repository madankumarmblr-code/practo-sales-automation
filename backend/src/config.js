import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Persistent data directory (SQLite + sheet cache). Override with DATA_DIR for Docker volumes. */
export function getDataDir() {
  const fromEnv = process.env.DATA_DIR;
  if (fromEnv) {
    const resolved = path.resolve(fromEnv);
    if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }
  const fallback = path.join(__dirname, '../../data');
  if (!fs.existsSync(fallback)) fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

export function getFrontendDistDir() {
  if (process.env.FRONTEND_DIST) return path.resolve(process.env.FRONTEND_DIST);
  // backend/src → repo root → frontend/dist
  return path.join(__dirname, '../../frontend/dist');
}
