import { nanoid } from 'nanoid';
import db from '../db/db.js';
import { discoverClinics, getDiscoveryMeta } from '../services/clinicDiscovery.js';

const now = () => new Date().toISOString();

export function registerLeadRoutes(app) {
  app.get('/api/lead-generator/meta', (_req, res) => {
    res.json(getDiscoveryMeta());
  });

  app.get('/api/leads', (req, res) => {
    const { stage, status, source, q, assigned_to } = req.query;
    let rows = db.prepare('SELECT * FROM leads ORDER BY score DESC, updated_at DESC').all();
    if (stage) rows = rows.filter((l) => l.stage === stage);
    if (status) rows = rows.filter((l) => l.status === status);
    if (source) rows = rows.filter((l) => l.source === source);
    if (assigned_to) rows = rows.filter((l) => l.assigned_to === assigned_to);
    if (q) {
      const needle = q.toString().toLowerCase();
      rows = rows.filter(
        (l) =>
          l.name.toLowerCase().includes(needle) ||
          (l.company || '').toLowerCase().includes(needle) ||
          (l.email || '').toLowerCase().includes(needle)
      );
    }
    res.json(rows);
  });

  app.get('/api/leads/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Lead not found' });
    const activities = db
      .prepare('SELECT * FROM activities WHERE lead_id = ? ORDER BY created_at DESC')
      .all(req.params.id);
    res.json({ ...row, activities });
  });

  app.post('/api/leads', (req, res) => {
    const body = req.body || {};
    if (!body.name) return res.status(400).json({ error: 'Name is required' });
    const id = nanoid();
    const ts = now();
    db.prepare(`
      INSERT INTO leads (
        id, name, email, phone, company, title, source, stage, score, value,
        status, assigned_to, last_contacted_at, next_action, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name,
      body.email || '',
      body.phone || '',
      body.company || '',
      body.title || '',
      body.source || 'manual',
      body.stage || 'new',
      body.score ?? 40,
      body.value ?? 0,
      body.status || 'open',
      body.assigned_to || 'Unassigned',
      body.last_contacted_at || null,
      body.next_action || '',
      body.notes || '',
      ts,
      ts
    );
    res.status(201).json(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
  });

  app.put('/api/leads/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Lead not found' });
    const b = req.body || {};
    const next = {
      name: b.name ?? existing.name,
      email: b.email ?? existing.email,
      phone: b.phone ?? existing.phone,
      company: b.company ?? existing.company,
      title: b.title ?? existing.title,
      source: b.source ?? existing.source,
      stage: b.stage ?? existing.stage,
      score: b.score ?? existing.score,
      value: b.value ?? existing.value,
      status: b.status ?? existing.status,
      assigned_to: b.assigned_to ?? existing.assigned_to,
      last_contacted_at: b.last_contacted_at ?? existing.last_contacted_at,
      next_action: b.next_action ?? existing.next_action,
      notes: b.notes ?? existing.notes,
    };
    db.prepare(`
      UPDATE leads SET
        name=?, email=?, phone=?, company=?, title=?, source=?, stage=?, score=?, value=?,
        status=?, assigned_to=?, last_contacted_at=?, next_action=?, notes=?, updated_at=?
      WHERE id=?
    `).run(
      next.name,
      next.email,
      next.phone,
      next.company,
      next.title,
      next.source,
      next.stage,
      next.score,
      next.value,
      next.status,
      next.assigned_to,
      next.last_contacted_at,
      next.next_action,
      next.notes,
      now(),
      req.params.id
    );

    if (b.stage && b.stage !== existing.stage) {
      db.prepare(`
        INSERT INTO activities (id, lead_id, contact_id, type, channel, title, detail, status, created_at)
        VALUES (?, ?, NULL, 'stage', 'system', ?, ?, 'completed', ?)
      `).run(
        nanoid(),
        req.params.id,
        `Moved to ${b.stage}`,
        `Stage changed from ${existing.stage} to ${b.stage}`,
        now()
      );
    }

    res.json(db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id));
  });

  app.delete('/api/leads/:id', (req, res) => {
    db.prepare('DELETE FROM activities WHERE lead_id = ?').run(req.params.id);
    const info = db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Lead not found' });
    res.json({ ok: true });
  });

  // Lead generator — multi-platform clinic discovery by city / zone / specialty
  app.post('/api/lead-generator/search', (req, res) => {
    const body = req.body || {};
    const city = body.city || body.location;
    const { zone = 'All', specialty, limit = null } = body;

    if (!city || !specialty) {
      return res.status(400).json({
        error: 'Select city and specialty to discover clinics (zone can be All)',
      });
    }

    // Default: pull entire inventory for the selection (no small sample limit)
    const discovery = discoverClinics({ city, zone, specialty, limit });
    if (discovery.error && !discovery.results?.length) {
      return res.status(400).json({ error: discovery.error });
    }
    res.json(discovery);
  });

  app.post('/api/lead-generator/import', (req, res) => {
    const { leads: incoming = [] } = req.body || {};
    if (!Array.isArray(incoming) || !incoming.length) {
      return res.status(400).json({ error: 'leads array required' });
    }
    const insert = db.prepare(`
      INSERT INTO leads (
        id, name, email, phone, company, title, source, stage, score, value,
        status, assigned_to, last_contacted_at, next_action, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'Unassigned', NULL, ?, ?, ?, ?)
    `);
    const created = [];
    const ts = now();
    const tx = db.transaction((items) => {
      for (const item of items) {
        const id = nanoid();
        const owner = item.owner || {};
        const marketing = item.marketingHead || null;
        const practo = item.practo || {};
        const platforms = item.platformNames || item.platforms?.map((p) => p.name) || [];
        const notes = [
          item.matchReason || 'Imported from multi-platform lead generator',
          `Clinic: ${item.clinicName || item.company || ''}`,
          `Specialty: ${item.specialty || ''}`,
          `Location: ${item.zone || ''}, ${item.city || item.location || ''}`,
          `Address: ${item.address || ''}`,
          `Owner: ${owner.name || item.name || ''} | ${owner.phone || item.phone || ''} | ${owner.email || item.email || ''}`,
          marketing
            ? `Marketing Head: ${marketing.name} | ${marketing.phone || ''} | ${marketing.email || ''}`
            : 'Marketing Head: Not listed',
          `Practo profile: ${practo.hasProfile ? 'Yes' : 'No'}${practo.url ? ` (${practo.url})` : ''}`,
          `Platforms: ${platforms.join(', ') || 'n/a'}`,
        ].join('\n');

        insert.run(
          id,
          owner.name || item.name,
          owner.email || item.email || '',
          owner.phone || item.phone || '',
          item.clinicName || item.company || '',
          owner.title || item.title || 'Clinic Owner',
          item.source || 'Multi-platform Discovery',
          'new',
          item.score ?? 50,
          item.estimatedValue ?? item.value ?? 0,
          `Engage via ${item.suggestedChannel || 'whatsapp'}`,
          notes,
          ts,
          ts
        );
        created.push(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
      }
    });
    tx(incoming);
    res.status(201).json({ imported: created.length, leads: created });
  });
}
