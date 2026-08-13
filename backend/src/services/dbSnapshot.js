/**
 * Durable SQLite snapshots for ephemeral hosts (Vercel /tmp).
 *
 * Without this, Settings / API Integrations / CRM writes succeed on one
 * serverless instance then vanish when the next request hits a fresh /tmp.
 *
 * Requires BLOB_READ_WRITE_TOKEN (Vercel Blob store). No-ops elsewhere.
 */
import fs from 'fs';
import path from 'path';
import { getDataDir } from '../config.js';

const SNAPSHOT_PATHNAME = (process.env.DB_SNAPSHOT_BLOB_PATH || 'practo-sales/sales.db').replace(
  /^\/+/,
  ''
);

let persistChain = Promise.resolve();
let restoredThisProcess = false;

export function durableStoreConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function dbFilePath() {
  return path.join(getDataDir(), 'sales.db');
}

function walSidecars(dbPath) {
  return [`${dbPath}-wal`, `${dbPath}-shm`];
}

function clearLocalDbFiles(dbPath) {
  for (const p of [dbPath, ...walSidecars(dbPath)]) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      /* ignore */
    }
  }
}

async function blobClient() {
  if (!durableStoreConfigured()) return null;
  return import('@vercel/blob');
}

/**
 * Download the latest durable snapshot into DATA_DIR before opening SQLite.
 * Runs once per process. Overwrites any leftover /tmp DB so cold starts see
 * the newest Settings / Integrations snapshot.
 */
export async function restoreDurableDb() {
  if (restoredThisProcess) return { restored: false, reason: 'already_restored' };
  restoredThisProcess = true;

  if (!durableStoreConfigured()) {
    return { restored: false, reason: 'no_blob_token' };
  }

  const dbPath = dbFilePath();
  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  try {
    const blob = await blobClient();
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    let downloadUrl = null;
    let pathname = SNAPSHOT_PATHNAME;

    try {
      const meta = await blob.head(SNAPSHOT_PATHNAME, { token });
      downloadUrl = meta?.url || null;
      pathname = meta?.pathname || SNAPSHOT_PATHNAME;
    } catch {
      const listed = await blob.list({
        prefix: SNAPSHOT_PATHNAME,
        limit: 20,
        token,
      });
      const match =
        (listed.blobs || []).find((b) => b.pathname === SNAPSHOT_PATHNAME) ||
        (listed.blobs || [])[0];
      downloadUrl = match?.url || null;
      pathname = match?.pathname || SNAPSHOT_PATHNAME;
    }

    if (!downloadUrl) {
      console.log('Durable DB snapshot not found yet — starting fresh');
      return { restored: false, reason: 'no_snapshot' };
    }

    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      throw new Error(`Blob download failed (${res.status})`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) {
      return { restored: false, reason: 'empty_snapshot' };
    }

    clearLocalDbFiles(dbPath);
    fs.writeFileSync(dbPath, buf);
    console.log(
      `Restored durable SQLite snapshot (${buf.length} bytes) from ${pathname}`
    );
    return { restored: true, bytes: buf.length, pathname };
  } catch (err) {
    console.warn('Durable DB restore failed:', err.message || err);
    return { restored: false, reason: 'error', error: err.message || String(err) };
  }
}

async function checkpointWal() {
  try {
    const { default: db } = await import('../db/db.js');
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    console.warn('WAL checkpoint before snapshot failed:', err.message || err);
  }
}

/**
 * Upload the current sales.db to Vercel Blob. Serialized so concurrent
 * mutations cannot race two uploads.
 */
export function persistDurableDb({ force = false } = {}) {
  if (!durableStoreConfigured()) {
    return Promise.resolve({ persisted: false, reason: 'no_blob_token' });
  }

  persistChain = persistChain
    .catch(() => {})
    .then(async () => {
      const dbPath = dbFilePath();
      if (!fs.existsSync(dbPath)) {
        return { persisted: false, reason: 'missing_db' };
      }
      await checkpointWal();
      const buf = fs.readFileSync(dbPath);
      if (!buf.length) {
        return { persisted: false, reason: 'empty_db' };
      }

      const blob = await blobClient();
      const result = await blob.put(SNAPSHOT_PATHNAME, buf, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/x-sqlite3',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });

      if (force || process.env.DB_SNAPSHOT_DEBUG === '1') {
        console.log(`Persisted durable SQLite snapshot (${buf.length} bytes) → ${result.pathname}`);
      }
      return { persisted: true, bytes: buf.length, url: result.url, pathname: result.pathname };
    })
    .catch((err) => {
      console.warn('Durable DB persist failed:', err.message || err);
      return { persisted: false, reason: 'error', error: err.message || String(err) };
    });

  return persistChain;
}

/**
 * Express middleware: after successful mutating API calls, snapshot the DB.
 * Uses waitUntil on Vercel so the upload can finish after the response.
 */
export function durablePersistMiddleware(req, res, next) {
  if (!durableStoreConfigured()) return next();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

  // Skip noisy / non-stateful endpoints
  const p = req.path || '';
  if (p === '/auth/login' || p === '/auth/logout' || p.endsWith('/test') || p.endsWith('/self-test')) {
    return next();
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) return;
    const job = persistDurableDb();
    import('@vercel/functions')
      .then((mod) => {
        if (typeof mod.waitUntil === 'function') mod.waitUntil(job);
      })
      .catch(() => {
        /* local / non-Vercel — fire and forget */
      });
  });
  next();
}

/** Awaited persist for critical settings/integration saves (stronger guarantee). */
export async function persistDurableDbNow() {
  return persistDurableDb({ force: true });
}
