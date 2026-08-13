import db from '../db/db.js';
import { nanoid } from 'nanoid';
import { persistDurableDbNow } from '../services/dbSnapshot.js';

function parseMap(rows) {
  const out = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

async function respondAfterPersist(res, payload) {
  await persistDurableDbNow();
  res.json(payload);
}

export function registerSettingsRoutes(app) {
  app.get('/api/dashboard', (_req, res) => {
    const leads = db.prepare('SELECT * FROM leads').all();
    const open = leads.filter((l) => l.status === 'open');
    const won = leads.filter((l) => l.stage === 'won');
    const pipelineValue = open.reduce((s, l) => s + (l.value || 0), 0);
    const wonValue = won.reduce((s, l) => s + (l.value || 0), 0);
    const avgScore = leads.length
      ? Math.round(leads.reduce((s, l) => s + l.score, 0) / leads.length)
      : 0;

    const byStage = {};
    for (const l of leads) {
      byStage[l.stage] = (byStage[l.stage] || 0) + 1;
    }

    const stages = db.prepare('SELECT * FROM pipeline_stages ORDER BY position').all();
    const activities = db
      .prepare('SELECT * FROM activities ORDER BY created_at DESC LIMIT 10')
      .all();
    const contacts = db.prepare('SELECT COUNT(*) as c FROM contacts').get().c;
    const campaigns = db
      .prepare("SELECT COUNT(*) as c FROM autopilot_campaigns WHERE status = 'active'")
      .get().c;

    const hotLeads = db
      .prepare("SELECT * FROM leads WHERE status = 'open' ORDER BY score DESC LIMIT 5")
      .all();

    res.json({
      kpis: {
        openLeads: open.length,
        pipelineValue,
        wonValue,
        avgScore,
        contacts,
        activeCampaigns: campaigns,
        conversionRate: leads.length ? Math.round((won.length / leads.length) * 100) : 0,
      },
      byStage,
      stages,
      activities,
      hotLeads,
    });
  });

  app.get('/api/activities', (_req, res) => {
    res.json(db.prepare('SELECT * FROM activities ORDER BY created_at DESC LIMIT 50').all());
  });

  app.post('/api/activities', (req, res) => {
    const body = req.body || {};
    if (!body.title || !body.type) {
      return res.status(400).json({ error: 'title and type required' });
    }
    const id = nanoid();
    const ts = new Date().toISOString();
    db.prepare(`
      INSERT INTO activities (id, lead_id, contact_id, type, channel, title, detail, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.lead_id || null,
      body.contact_id || null,
      body.type,
      body.channel || 'system',
      body.title,
      body.detail || '',
      body.status || 'completed',
      ts
    );
    res.status(201).json(db.prepare('SELECT * FROM activities WHERE id = ?').get(id));
  });

  app.get('/api/lead-settings', (_req, res) => {
    const settings = parseMap(db.prepare('SELECT * FROM lead_settings').all());
    const sources = db.prepare('SELECT * FROM lead_sources ORDER BY weight DESC').all();
    const stages = db.prepare('SELECT * FROM pipeline_stages ORDER BY position').all();
    res.json({ settings, sources, stages });
  });

  app.put('/api/lead-settings', async (req, res) => {
    const body = req.body || {};
    const upsert = db.prepare('INSERT OR REPLACE INTO lead_settings (key, value) VALUES (?, ?)');
    const tx = db.transaction((payload) => {
      for (const [key, value] of Object.entries(payload)) {
        upsert.run(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    });
    tx(body);
    await respondAfterPersist(res, parseMap(db.prepare('SELECT * FROM lead_settings').all()));
  });

  app.put('/api/lead-settings/sources/:id', async (req, res) => {
    const existing = db.prepare('SELECT * FROM lead_sources WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Source not found' });
    const b = req.body || {};
    db.prepare('UPDATE lead_sources SET name=?, enabled=?, weight=? WHERE id=?').run(
      b.name ?? existing.name,
      b.enabled !== undefined ? (b.enabled ? 1 : 0) : existing.enabled,
      b.weight ?? existing.weight,
      req.params.id
    );
    await respondAfterPersist(
      res,
      db.prepare('SELECT * FROM lead_sources WHERE id = ?').get(req.params.id)
    );
  });

  app.get('/api/settings', (_req, res) => {
    res.json(parseMap(db.prepare('SELECT * FROM app_settings').all()));
  });

  app.put('/api/settings', async (req, res) => {
    const body = req.body || {};
    const upsert = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)');
    const tx = db.transaction((payload) => {
      for (const [key, value] of Object.entries(payload)) {
        upsert.run(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    });
    tx(body);
    await respondAfterPersist(res, parseMap(db.prepare('SELECT * FROM app_settings').all()));
  });

  app.get('/api/pipeline/stages', (_req, res) => {
    res.json(db.prepare('SELECT * FROM pipeline_stages ORDER BY position').all());
  });
}
