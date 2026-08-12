import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logEvent } from './logger.js';
import { getDataDir } from '../config.js';

const DATA_DIR = getDataDir();
const CACHE_PATH = path.join(DATA_DIR, 'locations-sheet.csv');
const META_PATH = path.join(DATA_DIR, 'locations-sheet.meta.json');

/** Live Google Sheet (published CSV) — inventory + location mappings */
export const SHEET_CSV_URL =
  process.env.SHEET_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQTl9Yrc0MVODAlLUTrHvOCJZxrm7bpEMV3xAX1d3UYiXQIeGySyOe8t1Jk8evBTQg2rSeC8akfGfxr/pub?gid=305008958&single=true&output=csv';

const SYNC_INTERVAL_MS = Number(process.env.SHEET_SYNC_MINUTES || 15) * 60 * 1000;

let syncTimer = null;
let lastSync = null;
let lastError = null;
let syncing = false;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function getSheetSyncStatus() {
  const exists = fs.existsSync(CACHE_PATH);
  let meta = {};
  if (fs.existsSync(META_PATH)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    } catch {
      meta = {};
    }
  }
  return {
    sourceUrl: SHEET_CSV_URL,
    cachePath: CACHE_PATH,
    cached: exists,
    syncing,
    lastSync: lastSync || meta.lastSync || null,
    lastError: lastError || meta.lastError || null,
    bytes: exists ? fs.statSync(CACHE_PATH).size : 0,
    rows: meta.rows || 0,
    autoSyncMinutes: SYNC_INTERVAL_MS / 60000,
  };
}

export function readCachedSheetCsv() {
  if (!fs.existsSync(CACHE_PATH)) return null;
  return fs.readFileSync(CACHE_PATH, 'utf8');
}

/**
 * Fetch published Google Sheet CSV and cache locally.
 * No manual CSV upload — this is the only inventory source.
 */
export async function syncSheetFromGoogle({ force = false } = {}) {
  if (syncing) {
    return { ok: false, message: 'Sync already in progress', ...getSheetSyncStatus() };
  }
  syncing = true;
  lastError = null;
  try {
    ensureDataDir();
    const res = await fetch(SHEET_CSV_URL, {
      headers: { Accept: 'text/csv,text/plain,*/*' },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`Google Sheet fetch failed: HTTP ${res.status}`);
    }
    const text = await res.text();
    if (!text || !text.includes(',')) {
      throw new Error('Google Sheet returned empty or invalid CSV');
    }
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      throw new Error('Google Sheet CSV has no data rows');
    }

    fs.writeFileSync(CACHE_PATH, text.replace(/^\uFEFF/, ''), 'utf8');
    lastSync = new Date().toISOString();
    const meta = {
      lastSync,
      rows: lines.length - 1,
      bytes: Buffer.byteLength(text),
      sourceUrl: SHEET_CSV_URL,
      lastError: null,
    };
    fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));

    // Invalidate location index so next read rebuilds from fresh cache
    try {
      const { reloadLocationsIndex } = await import('./locations.js');
      reloadLocationsIndex();
    } catch {
      /* locations module may not be ready during first boot */
    }

    logEvent({
      type: 'info',
      category: 'sheet',
      message: 'Google Sheet auto-synced',
      detail: `${meta.rows} rows cached`,
      meta,
    });

    return { ok: true, message: 'Synced from Google Sheet', ...getSheetSyncStatus() };
  } catch (err) {
    lastError = err.message;
    ensureDataDir();
    const meta = {
      ...(fs.existsSync(META_PATH)
        ? JSON.parse(fs.readFileSync(META_PATH, 'utf8'))
        : {}),
      lastError,
      lastAttempt: new Date().toISOString(),
    };
    fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
    logEvent({
      type: 'error',
      category: 'sheet',
      message: 'Google Sheet sync failed',
      detail: err.message,
    });
    return { ok: false, message: err.message, ...getSheetSyncStatus() };
  } finally {
    syncing = false;
  }
}

export function startSheetAutoSync() {
  if (syncTimer) return;
  // Initial sync (non-blocking)
  syncSheetFromGoogle().catch(() => {});
  syncTimer = setInterval(() => {
    syncSheetFromGoogle().catch(() => {});
  }, SYNC_INTERVAL_MS);
  if (typeof syncTimer.unref === 'function') syncTimer.unref();
}

export function getCachedCsvPath() {
  return CACHE_PATH;
}

export function getSheetSyncMeta() {
  return getSheetSyncStatus();
}
