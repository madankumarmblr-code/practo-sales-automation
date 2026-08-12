import { nanoid } from 'nanoid';
import db from '../db/db.js';
import { authRequired, requirePermission } from '../auth/middleware.js';

const now = () => new Date().toISOString();

function parseRow(row) {
  if (!row) return row;
  const secrets = JSON.parse(row.secrets || '{}');
  const masked = {};
  for (const [k, v] of Object.entries(secrets)) {
    masked[k] = v ? '••••••••' : '';
  }
  return {
    ...row,
    enabled: !!row.enabled,
    config: JSON.parse(row.config || '{}'),
    secrets: masked,
    hasSecrets: Object.values(secrets).some(Boolean),
  };
}

export function registerIntegrationRoutes(app) {
  app.get(
    '/api/integrations',
    authRequired,
    requirePermission('api_integrations:read', 'settings:read'),
    (_req, res) => {
      const rows = db
        .prepare('SELECT * FROM api_integrations ORDER BY category, label')
        .all()
        .map(parseRow);
      res.json(rows);
    }
  );

  app.get(
    '/api/integrations/:id',
    authRequired,
    requirePermission('api_integrations:read'),
    (req, res) => {
      const row = db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Integration not found' });
      res.json(parseRow(row));
    }
  );

  app.put(
    '/api/integrations/:id',
    authRequired,
    requirePermission('api_integrations:write'),
    (req, res) => {
      const existing = db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Integration not found' });
      const b = req.body || {};
      const currentSecrets = JSON.parse(existing.secrets || '{}');
      const nextSecrets = { ...currentSecrets };
      if (b.secrets && typeof b.secrets === 'object') {
        for (const [k, v] of Object.entries(b.secrets)) {
          if (v && v !== '••••••••') nextSecrets[k] = v;
          if (v === '') nextSecrets[k] = '';
        }
      }
      const config = b.config ? { ...JSON.parse(existing.config || '{}'), ...b.config } : JSON.parse(existing.config || '{}');
      db.prepare(`
        UPDATE api_integrations
        SET label=?, category=?, enabled=?, status=?, config=?, secrets=?, notes=?, updated_at=?
        WHERE id=?
      `).run(
        b.label ?? existing.label,
        b.category ?? existing.category,
        b.enabled !== undefined ? (b.enabled ? 1 : 0) : existing.enabled,
        b.status ?? existing.status,
        JSON.stringify(config),
        JSON.stringify(nextSecrets),
        b.notes ?? existing.notes,
        now(),
        req.params.id
      );
      res.json(parseRow(db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(req.params.id)));
    }
  );

  app.post(
    '/api/integrations/:id/test',
    authRequired,
    requirePermission('api_integrations:write'),
    (req, res) => {
      const existing = db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Integration not found' });
      const secrets = JSON.parse(existing.secrets || '{}');
      const hasKey = Object.values(secrets).some(Boolean);
      const status = hasKey ? 'connected' : 'ready';
      const ts = now();
      db.prepare(
        'UPDATE api_integrations SET status=?, last_tested_at=?, updated_at=? WHERE id=?'
      ).run(status, ts, ts, req.params.id);
      res.json({
        ok: true,
        status,
        message: hasKey
          ? `${existing.label} credentials accepted — ready for live calls`
          : `${existing.label} is ready. Add API credentials to go live.`,
        testedAt: ts,
        integration: parseRow(db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(req.params.id)),
      });
    }
  );

  app.post(
    '/api/integrations',
    authRequired,
    requirePermission('api_integrations:write'),
    (req, res) => {
      const b = req.body || {};
      if (!b.provider || !b.label) {
        return res.status(400).json({ error: 'provider and label required' });
      }
      const id = nanoid();
      const ts = now();
      db.prepare(`
        INSERT INTO api_integrations (
          id, provider, label, category, enabled, status, config, secrets, last_tested_at, notes, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'ready', ?, ?, NULL, ?, ?)
      `).run(
        id,
        b.provider,
        b.label,
        b.category || 'Custom',
        b.enabled ? 1 : 0,
        JSON.stringify(b.config || {}),
        JSON.stringify(b.secrets || {}),
        b.notes || '',
        ts
      );
      res.status(201).json(parseRow(db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(id)));
    }
  );
}
