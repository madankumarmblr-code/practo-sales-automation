import db from '../db/db.js';
import { authRequired, requirePermission } from '../auth/middleware.js';

function toCsv(rows) {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const escape = (v) => {
    const s = v == null ? '' : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [keys.join(','), ...rows.map((r) => keys.map((k) => escape(r[k])).join(','))].join('\n');
}

export function registerExportRoutes(app) {
  app.get('/api/export/:resource', authRequired, requirePermission('export:read'), (req, res) => {
    const { resource } = req.params;
    const format = (req.query.format || 'json').toString().toLowerCase();

    let payload;
    let filename;

    switch (resource) {
      case 'leads':
        payload = db.prepare('SELECT * FROM leads ORDER BY updated_at DESC').all();
        filename = 'leads';
        break;
      case 'contacts':
        payload = db.prepare('SELECT * FROM contacts ORDER BY updated_at DESC').all();
        filename = 'contacts';
        break;
      case 'campaigns':
        payload = db.prepare('SELECT * FROM autopilot_campaigns ORDER BY updated_at DESC').all();
        filename = 'campaigns';
        break;
      case 'activities':
        payload = db.prepare('SELECT * FROM activities ORDER BY created_at DESC').all();
        filename = 'activities';
        break;
      case 'settings': {
        const app = db.prepare('SELECT * FROM app_settings').all();
        const lead = db.prepare('SELECT * FROM lead_settings').all();
        payload = { app_settings: app, lead_settings: lead };
        filename = 'settings';
        break;
      }
      case 'integrations': {
        const rows = db.prepare('SELECT * FROM api_integrations ORDER BY category, label').all();
        payload = rows.map((r) => ({
          provider: r.provider,
          label: r.label,
          category: r.category,
          enabled: !!r.enabled,
          status: r.status,
          config: JSON.parse(r.config || '{}'),
          notes: r.notes,
          updated_at: r.updated_at,
          // secrets intentionally omitted from export
        }));
        filename = 'api-integrations';
        break;
      }
      case 'full': {
        payload = {
          exportedAt: new Date().toISOString(),
          leads: db.prepare('SELECT * FROM leads').all(),
          contacts: db.prepare('SELECT * FROM contacts').all(),
          campaigns: db.prepare('SELECT * FROM autopilot_campaigns').all(),
          activities: db.prepare('SELECT * FROM activities').all(),
          pipeline_stages: db.prepare('SELECT * FROM pipeline_stages ORDER BY position').all(),
          lead_sources: db.prepare('SELECT * FROM lead_sources').all(),
          app_settings: db.prepare('SELECT * FROM app_settings').all(),
          lead_settings: db.prepare('SELECT * FROM lead_settings').all(),
          api_integrations: db
            .prepare('SELECT provider, label, category, enabled, status, config, notes, updated_at FROM api_integrations')
            .all(),
        };
        filename = 'practo-sales-export';
        break;
      }
      default:
        return res.status(400).json({
          error: 'Unknown export resource',
          allowed: ['leads', 'contacts', 'campaigns', 'activities', 'settings', 'integrations', 'full'],
        });
    }

    if (format === 'csv') {
      if (!Array.isArray(payload)) {
        return res.status(400).json({ error: 'CSV export only supports tabular resources (leads, contacts, campaigns, activities, integrations)' });
      }
      const flat = payload.map((row) => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
          out[k] = typeof v === 'object' ? JSON.stringify(v) : v;
        }
        return out;
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(toCsv(flat));
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
    res.json(payload);
  });
}
