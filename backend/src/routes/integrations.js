import { nanoid } from 'nanoid';
import db from '../db/db.js';
import { authRequired, requirePermission } from '../auth/middleware.js';
import { selfTestIntegration } from '../services/outreach.js';
import { verifyIntegration } from '../services/integrationVerify.js';
import { dialoguesFor, PRODUCTS } from '../services/channels/dialogues.js';
import { catalogByProvider, INTEGRATION_CATALOG } from '../services/channels/catalog.js';
import { persistDurableDbNow } from '../services/dbSnapshot.js';

const now = () => new Date().toISOString();

function connectivityOf(row, { hasSecrets, availability, readyToRun }) {
  const tested = Boolean(row.last_tested_at);
  const testOk = row.last_test_ok == null ? null : !!row.last_test_ok;
  const message = row.last_test_message || '';

  // No credentials yet — prefer amber over a stale failed check
  if (!hasSecrets && availability === 'needs_key') {
    return {
      code: 'needs_key',
      label: 'Needs key',
      symbol: '●',
      tone: 'amber',
      hint: message || 'Add API credentials, then run Test',
    };
  }

  if (row.status === 'error' || testOk === false) {
    return {
      code: 'error',
      label: 'Failed',
      symbol: '●',
      tone: 'coral',
      hint: message || 'Last connectivity check failed',
    };
  }
  if (row.status === 'connected' || testOk === true) {
    return {
      code: 'live',
      label: 'Connected',
      symbol: '●',
      tone: 'green',
      hint: message || 'API connectivity verified',
    };
  }
  if (availability === 'ready_free' || readyToRun) {
    return {
      code: 'ready',
      label: tested ? 'Ready' : 'Ready to test',
      symbol: '●',
      tone: 'teal',
      hint:
        message ||
        (availability === 'ready_free' ? 'Free connector — no key required' : 'Credentials present'),
    };
  }
  return {
    code: 'idle',
    label: tested ? 'Idle' : 'Untested',
    symbol: '○',
    tone: 'gray',
    hint: message || 'Run Test to verify connectivity',
  };
}

function parseRow(row) {
  if (!row) return row;
  const secrets = JSON.parse(row.secrets || '{}');
  const masked = {};
  for (const [k, v] of Object.entries(secrets)) {
    masked[k] = v ? '••••••••' : '';
  }
  const config = JSON.parse(row.config || '{}');
  const catalog = catalogByProvider(row.provider);
  const pricing = config.pricing || catalog?.pricing || 'paid';
  const availability =
    catalog?.availability ||
    (Object.keys(catalog?.secrets || secrets).length === 0 ? 'ready_free' : 'needs_key');
  const hasSecrets = Object.values(secrets).some(Boolean);
  const readyToRun =
    availability === 'ready_free' ||
    (availability === 'needs_key' && hasSecrets && !!row.enabled && row.status !== 'error');
  const connectivity = connectivityOf(row, { hasSecrets, availability, readyToRun });
  return {
    ...row,
    enabled: !!row.enabled,
    is_default: !!row.is_default,
    channel: row.channel || '',
    config,
    secrets: masked,
    hasSecrets,
    pricing,
    availability,
    readyToRun,
    last_test_ok: row.last_test_ok == null ? null : !!row.last_test_ok,
    last_test_message: row.last_test_message || '',
    connectivity,
  };
}

function saveProbeResult(id, probe) {
  const ts = probe.testedAt || now();
  const status = probe.status === 'needs_credentials' ? 'ready' : probe.status;
  const ok =
    probe.ok === true ? 1 : probe.status === 'needs_credentials' ? null : 0;
  db.prepare(
    `UPDATE api_integrations
     SET status=?, last_tested_at=?, last_test_message=?, last_test_ok=?, updated_at=?
     WHERE id=?`
  ).run(status, ts, probe.message || '', ok, ts, id);
  return ts;
}

export function registerIntegrationRoutes(app) {
  app.get(
    '/api/integrations/catalog',
    authRequired,
    requirePermission('api_integrations:read', 'settings:read'),
    (_req, res) => {
      res.json({
        items: INTEGRATION_CATALOG.map((p) => ({
          provider: p.provider,
          label: p.label,
          category: p.category,
          channel: p.channel,
          pricing: p.pricing,
          availability: p.availability,
          notes: p.notes,
          is_default: !!p.is_default,
          freeToRun: p.availability === 'ready_free',
        })),
        free: INTEGRATION_CATALOG.filter((p) => p.pricing === 'free'),
        freemium: INTEGRATION_CATALOG.filter((p) => p.pricing === 'freemium'),
        paid: INTEGRATION_CATALOG.filter((p) => p.pricing === 'paid'),
        readyNow: INTEGRATION_CATALOG.filter((p) => p.availability === 'ready_free'),
      });
    }
  );

  app.get(
    '/api/integrations',
    authRequired,
    requirePermission('api_integrations:read', 'settings:read'),
    (req, res) => {
      const channel = (req.query.channel || '').toString();
      const pricing = (req.query.pricing || '').toString();
      let rows = db.prepare('SELECT * FROM api_integrations ORDER BY category, is_default DESC, label').all();
      if (channel) rows = rows.filter((r) => r.channel === channel);
      let parsed = rows.map(parseRow);
      if (pricing) parsed = parsed.filter((r) => r.pricing === pricing);
      res.json(parsed);
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
    async (req, res) => {
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
      const hasSecrets = Object.values(nextSecrets).some(Boolean);
      let nextStatus = b.status ?? existing.status;
      // If credentials were cleared, don't leave a stale "connected"/"error" badge
      if (!hasSecrets && (nextStatus === 'connected' || nextStatus === 'error')) {
        nextStatus = 'ready';
      }
      const nextEnabled =
        b.enabled !== undefined ? (b.enabled ? 1 : 0) : existing.enabled;
      const nextDefault =
        b.is_default !== undefined ? (b.is_default ? 1 : 0) : existing.is_default || 0;
      if (nextDefault && existing.channel) {
        db.prepare(
          'UPDATE api_integrations SET is_default = 0, updated_at = ? WHERE channel = ? AND id != ?'
        ).run(now(), existing.channel, req.params.id);
      }
      db.prepare(`
        UPDATE api_integrations
        SET label=?, category=?, enabled=?, status=?, config=?, secrets=?, notes=?, is_default=?, updated_at=?
        WHERE id=?
      `).run(
        b.label ?? existing.label,
        b.category ?? existing.category,
        nextEnabled,
        nextStatus,
        JSON.stringify(config),
        JSON.stringify(nextSecrets),
        b.notes ?? existing.notes,
        nextDefault,
        now(),
        req.params.id
      );
      await persistDurableDbNow();
      res.json(parseRow(db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(req.params.id)));
    }
  );

  app.post(
    '/api/integrations/:id/test',
    authRequired,
    requirePermission('api_integrations:write'),
    async (req, res) => {
      const existing = db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Integration not found' });
      try {
        const probe = await verifyIntegration(existing);
        const ts = saveProbeResult(req.params.id, probe);
        res.json({
          ok: probe.ok,
          status: probe.status,
          message: probe.message,
          detail: probe.detail || null,
          httpStatus: probe.httpStatus || null,
          testedAt: ts,
          integration: parseRow(db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(req.params.id)),
        });
      } catch (err) {
        const ts = saveProbeResult(req.params.id, {
          ok: false,
          status: 'error',
          message: err.message || 'Integration test failed',
          testedAt: now(),
        });
        res.status(500).json({
          ok: false,
          status: 'error',
          message: err.message || 'Integration test failed',
          testedAt: ts,
        });
      }
    }
  );

  /** Run connectivity checks for every integration (one-by-one sequential). */
  app.post(
    '/api/integrations/test-all',
    authRequired,
    requirePermission('api_integrations:write'),
    async (_req, res) => {
      const rows = db
        .prepare('SELECT * FROM api_integrations ORDER BY category, is_default DESC, label')
        .all();
      const results = [];
      for (const row of rows) {
        try {
          const probe = await verifyIntegration(row);
          saveProbeResult(row.id, probe);
          results.push({
            id: row.id,
            provider: row.provider,
            label: row.label,
            category: row.category,
            ok: probe.ok,
            status: probe.status,
            message: probe.message,
            detail: probe.detail || null,
            connectivity: parseRow(
              db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(row.id)
            ).connectivity,
          });
        } catch (err) {
          saveProbeResult(row.id, {
            ok: false,
            status: 'error',
            message: err.message || 'Test failed',
            testedAt: now(),
          });
          results.push({
            id: row.id,
            provider: row.provider,
            label: row.label,
            category: row.category,
            ok: false,
            status: 'error',
            message: err.message || 'Test failed',
            detail: null,
          });
        }
      }
      res.json({
        ok: results.every((r) => r.ok || r.status === 'needs_credentials'),
        tested: results.length,
        passed: results.filter((r) => r.ok).length,
        needsCredentials: results.filter((r) => r.status === 'needs_credentials').length,
        failed: results.filter((r) => !r.ok && r.status !== 'needs_credentials').length,
        results,
      });
    }
  );

  /** Send a self-test to the user's own phone or email */
  app.post(
    '/api/integrations/:id/self-test',
    authRequired,
    requirePermission('api_integrations:write'),
    (req, res) => {
      const existing = db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(req.params.id);
      if (!existing) return res.status(404).json({ error: 'Integration not found' });
      try {
        const result = selfTestIntegration(existing, {
          phone: req.body?.phone,
          email: req.body?.email,
          product: req.body?.product || 'prime',
          dialogue_id: req.body?.dialogue_id,
          user: req.user,
        });
        res.json({
          ...result,
          integration: parseRow(db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(req.params.id)),
          products: PRODUCTS,
          suggestedDialogues: dialoguesFor(existing.channel, req.body?.product || 'prime'),
        });
      } catch (err) {
        res.status(err.status || 500).json({ error: err.message || 'Self-test failed' });
      }
    }
  );

  app.post(
    '/api/integrations',
    authRequired,
    requirePermission('api_integrations:write'),
    async (req, res) => {
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
      await persistDurableDbNow();
      res.status(201).json(parseRow(db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(id)));
    }
  );
}
