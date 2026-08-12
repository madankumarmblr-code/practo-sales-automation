import { nanoid } from 'nanoid';
import db from '../db/db.js';

const now = () => new Date().toISOString();

function parseTags(row) {
  if (!row) return row;
  return { ...row, tags: JSON.parse(row.tags || '[]') };
}

export function registerContactRoutes(app) {
  app.get('/api/contacts', (_req, res) => {
    const q = (_req.query.q || '').toString().toLowerCase();
    let rows = db.prepare('SELECT * FROM contacts ORDER BY updated_at DESC').all().map(parseTags);
    if (q) {
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.company || '').toLowerCase().includes(q) ||
          (c.phone || '').includes(q)
      );
    }
    res.json(rows);
  });

  app.get('/api/contacts/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Contact not found' });
    res.json(parseTags(row));
  });

  app.post('/api/contacts', (req, res) => {
    const { name, email, phone, company, title, tags = [], notes = '' } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = nanoid();
    const ts = now();
    db.prepare(`
      INSERT INTO contacts (id, name, email, phone, company, title, tags, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, email || '', phone || '', company || '', title || '', JSON.stringify(tags), notes, ts, ts);
    res.status(201).json(parseTags(db.prepare('SELECT * FROM contacts WHERE id = ?').get(id)));
  });

  app.put('/api/contacts/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Contact not found' });
    const {
      name = existing.name,
      email = existing.email,
      phone = existing.phone,
      company = existing.company,
      title = existing.title,
      tags = JSON.parse(existing.tags || '[]'),
      notes = existing.notes,
    } = req.body || {};
    db.prepare(`
      UPDATE contacts SET name=?, email=?, phone=?, company=?, title=?, tags=?, notes=?, updated_at=?
      WHERE id=?
    `).run(name, email, phone, company, title, JSON.stringify(tags), notes, now(), req.params.id);
    res.json(parseTags(db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id)));
  });

  app.delete('/api/contacts/:id', (req, res) => {
    const info = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Contact not found' });
    res.json({ ok: true });
  });
}
