import { nanoid } from 'nanoid';
import db from '../db/db.js';
import { authRequired, requirePermission } from '../auth/middleware.js';
import { parseCsv } from '../services/csvParse.js';
import { createOutreachRecord } from '../services/outreach.js';

const now = () => new Date().toISOString();

const TEMPLATES = {
  leads: {
    filename: 'leads-import-template.csv',
    headers: ['name', 'email', 'phone', 'company', 'title', 'source', 'stage', 'score', 'value', 'notes'],
    sample: [
      {
        name: 'Dr. Sample Owner',
        email: 'owner@clinic.example',
        phone: '+91 90000 00000',
        company: 'Sample Dental Care',
        title: 'Clinic Owner',
        source: 'manual',
        stage: 'new',
        score: '70',
        value: '50000',
        notes: 'Interested in Reach',
      },
    ],
  },
  campaigns: {
    filename: 'campaigns-import-template.csv',
    headers: [
      'name',
      'channel',
      'goal',
      'product_pitch',
      'dialogue_id',
      'subject',
      'message_template',
      'daily_limit',
      'status',
      'ai_personalize',
    ],
    sample: [
      {
        name: 'Bangalore Reach Push',
        channel: 'whatsapp',
        goal: 'Book Reach demo',
        product_pitch: 'reach',
        dialogue_id: 'wa_reach_offer',
        subject: '',
        message_template: 'Hi {{name}}, Reach slots for {{company}}…',
        daily_limit: '50',
        status: 'paused',
        ai_personalize: '1',
      },
    ],
  },
  outreach: {
    filename: 'outreach-import-template.csv',
    headers: [
      'channel',
      'record_type',
      'to_phone',
      'to_email',
      'product_pitch',
      'dialogue_id',
      'subject',
      'body',
      'lead_name',
      'company',
      'status',
    ],
    sample: [
      {
        channel: 'calls',
        record_type: 'call',
        to_phone: '+91 90000 00000',
        to_email: '',
        product_pitch: 'prime',
        dialogue_id: 'call_prime_qualify',
        subject: '',
        body: 'Call script notes…',
        lead_name: 'Dr. Sample',
        company: 'Sample Clinic',
        status: 'completed',
      },
    ],
  },
};

function toCsv(rows, headers) {
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const keys = headers || (rows[0] ? Object.keys(rows[0]) : []);
  return [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n');
}

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

export function registerImportRoutes(app) {
  app.get(
    '/api/import/templates/:resource',
    authRequired,
    requirePermission('export:read', 'leads:write', 'autopilot:write'),
    (req, res) => {
      const tpl = TEMPLATES[req.params.resource];
      if (!tpl) {
        return res.status(400).json({
          error: 'Unknown template',
          allowed: Object.keys(TEMPLATES),
        });
      }
      const csv = toCsv(tpl.sample, tpl.headers);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${tpl.filename}"`);
      res.send(csv);
    }
  );

  app.get(
    '/api/import/templates',
    authRequired,
    requirePermission('export:read', 'leads:read', 'autopilot:read'),
    (_req, res) => {
      res.json({
        templates: Object.entries(TEMPLATES).map(([id, t]) => ({
          id,
          filename: t.filename,
          headers: t.headers,
          download: `/api/import/templates/${id}`,
        })),
      });
    }
  );

  app.post(
    '/api/import/:resource',
    authRequired,
    requirePermission('leads:write', 'autopilot:write', 'export:read'),
    (req, res) => {
      const resource = req.params.resource;
      const body = req.body || {};
      let rows = Array.isArray(body.rows) ? body.rows : null;

      if (!rows && typeof body.csv === 'string') {
        rows = parseCsv(body.csv, { columns: true, skip_empty_lines: true, trim: true });
      }
      if (!rows?.length) {
        return res.status(400).json({ error: 'Provide rows[] or csv string' });
      }

      // normalize keys
      rows = rows.map((r) => {
        const out = {};
        for (const [k, v] of Object.entries(r)) out[normalizeHeader(k)] = v;
        return out;
      });

      const ts = now();
      let imported = 0;
      const created = [];

      if (resource === 'leads') {
        const insert = db.prepare(`
          INSERT INTO leads (
            id, name, email, phone, company, title, source, stage, score, value,
            status, assigned_to, last_contacted_at, next_action, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'Unassigned', NULL, '', ?, ?, ?)
        `);
        const tx = db.transaction(() => {
          for (const r of rows) {
            if (!r.name) continue;
            const id = nanoid();
            insert.run(
              id,
              r.name,
              r.email || '',
              r.phone || '',
              r.company || '',
              r.title || '',
              r.source || 'import',
              r.stage || 'new',
              Number(r.score) || 40,
              Number(r.value) || 0,
              r.notes || '',
              ts,
              ts
            );
            imported += 1;
            created.push(id);
          }
        });
        tx();
        return res.status(201).json({ imported, ids: created, resource: 'leads' });
      }

      if (resource === 'campaigns') {
        const insert = db.prepare(`
          INSERT INTO autopilot_campaigns (
            id, name, channel, status, goal, message_template, daily_limit, sent_today, success_rate,
            integration_id, subject, channel_config, ai_personalize, run_mode, last_run_day,
            product_pitch, dialogue_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, NULL, ?, '{}', ?, 'live', NULL, ?, ?, ?, ?)
        `);
        const tx = db.transaction(() => {
          for (const r of rows) {
            if (!r.name || !r.channel) continue;
            const id = nanoid();
            insert.run(
              id,
              r.name,
              r.channel,
              r.status || 'paused',
              r.goal || '',
              r.message_template || '',
              Number(r.daily_limit) || 50,
              r.subject || '',
              r.ai_personalize === '1' || r.ai_personalize === true || r.ai_personalize === 'true' ? 1 : 0,
              r.product_pitch || '',
              r.dialogue_id || '',
              ts,
              ts
            );
            imported += 1;
            created.push(id);
          }
        });
        tx();
        return res.status(201).json({ imported, ids: created, resource: 'campaigns' });
      }

      if (resource === 'outreach') {
        for (const r of rows) {
          if (!r.channel) continue;
          const rec = createOutreachRecord({
            channel: r.channel,
            record_type: r.record_type || (r.channel === 'calls' ? 'call' : r.channel === 'gmail' ? 'email' : 'message'),
            to_phone: r.to_phone || '',
            to_email: r.to_email || '',
            product_pitch: r.product_pitch || '',
            dialogue_id: r.dialogue_id || '',
            subject: r.subject || '',
            body: r.body || '',
            lead_name: r.lead_name || '',
            company: r.company || '',
            status: r.status || 'imported',
            direction: 'import',
            detail: 'Imported outreach row',
          });
          imported += 1;
          created.push(rec.id);
        }
        return res.status(201).json({ imported, ids: created, resource: 'outreach' });
      }

      return res.status(400).json({
        error: 'Unknown import resource',
        allowed: ['leads', 'campaigns', 'outreach'],
      });
    }
  );
}
