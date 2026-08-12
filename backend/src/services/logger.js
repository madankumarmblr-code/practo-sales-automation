import { nanoid } from 'nanoid';
import db from '../db/db.js';

const now = () => new Date().toISOString();

export function logEvent({
  type = 'info',
  category = 'system',
  message,
  detail = '',
  userId = null,
  meta = null,
}) {
  try {
    db.prepare(`
      INSERT INTO system_events (id, type, category, message, detail, user_id, meta, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nanoid(),
      type,
      category,
      message,
      detail || '',
      userId,
      meta ? JSON.stringify(meta) : null,
      now()
    );
  } catch (err) {
    console.error('Failed to write system event', err.message);
  }
}

export function listEvents({ limit = 100, category, type } = {}) {
  let rows = db.prepare('SELECT * FROM system_events ORDER BY created_at DESC LIMIT ?').all(Math.min(limit, 500));
  if (category) rows = rows.filter((r) => r.category === category);
  if (type) rows = rows.filter((r) => r.type === type);
  return rows.map((r) => ({
    ...r,
    meta: r.meta ? JSON.parse(r.meta) : null,
  }));
}
