import { nanoid } from 'nanoid';
import db from '../db/db.js';

const now = () => new Date().toISOString();

export function registerLeadRoutes(app) {
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

  // Lead generator — invents / discovers leads from criteria
  app.post('/api/lead-generator/search', (req, res) => {
    const {
      industry = 'healthcare',
      location = 'Bangalore',
      role = 'Clinic Owner',
      channel = 'mixed',
      limit = 8,
    } = req.body || {};

    const samples = [
      { name: 'Dr. Kavitha Rao', company: 'Harmony Family Clinic', title: 'Owner', email: 'kavitha@harmony.clinic', phone: '+91 98001 11223' },
      { name: 'Sanjay Pillai', company: 'Orbit Eye Care', title: 'Practice Manager', email: 'sanjay@orbit.eye', phone: '+91 98002 22334' },
      { name: 'Dr. Fatima Sheikh', company: 'GreenLeaf Wellness', title: 'Medical Lead', email: 'fatima@greenleaf.care', phone: '+91 98003 33445' },
      { name: 'Rohan Gupta', company: 'QuickLab Diagnostics', title: 'BD Manager', email: 'rohan@quicklab.in', phone: '+91 98004 44556' },
      { name: 'Anita Bose', company: 'Little Steps Pediatrics', title: 'Admin Head', email: 'anita@littlesteps.clinic', phone: '+91 98005 55667' },
      { name: 'Dr. Imran Ali', company: 'Summit Ortho', title: 'Partner', email: 'imran@summitortho.in', phone: '+91 98006 66778' },
      { name: 'Lakshmi Krishnan', company: 'Aura Skin Studio', title: 'Founder', email: 'lakshmi@auraskin.com', phone: '+91 98007 77889' },
      { name: 'Deepak Jain', company: 'CityCare Multi-Specialty', title: 'COO', email: 'deepak@citycare.in', phone: '+91 98008 88990' },
      { name: 'Dr. Neha Joshi', company: 'Riverdale Dental', title: 'Principal Dentist', email: 'neha@riverdale.dental', phone: '+91 98009 99001' },
      { name: 'Manish Aggarwal', company: 'VitalPath Labs', title: 'Growth Manager', email: 'manish@vitalpath.co', phone: '+91 98010 00112' },
    ];

    const sourceMap = {
      whatsapp: 'WhatsApp Campaign',
      gmail: 'Gmail Outreach',
      calls: 'Cold Call',
      mixed: 'Clinic Directory',
    };

    const shuffled = [...samples].sort(() => Math.random() - 0.5).slice(0, Math.min(limit, samples.length));
    const results = shuffled.map((s, i) => ({
      id: `gen-${nanoid(8)}`,
      ...s,
      industry,
      location,
      role,
      source: sourceMap[channel] || 'Clinic Directory',
      score: 45 + Math.floor(Math.random() * 40),
      estimatedValue: 40000 + Math.floor(Math.random() * 200000),
      matchReason: `Matches ${role} in ${location} ${industry} — strong fit for Autopilot ${channel === 'mixed' ? 'multi-channel' : channel} outreach.`,
      suggestedChannel: channel === 'mixed' ? ['whatsapp', 'gmail', 'calls'][i % 3] : channel,
    }));

    res.json({
      query: { industry, location, role, channel, limit },
      count: results.length,
      results,
    });
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
        insert.run(
          id,
          item.name,
          item.email || '',
          item.phone || '',
          item.company || '',
          item.title || '',
          item.source || 'Lead Generator',
          'new',
          item.score ?? 50,
          item.estimatedValue ?? item.value ?? 0,
          `Engage via ${item.suggestedChannel || 'gmail'}`,
          item.matchReason || 'Imported from lead generator',
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
