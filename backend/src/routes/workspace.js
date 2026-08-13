import db from '../db/db.js';
import { requirePermission } from '../auth/middleware.js';
import { persistDurableDbNow, durableStoreConfigured } from '../services/dbSnapshot.js';

const now = () => new Date().toISOString();

/**
 * Re-apply Settings / Lead Settings / API Integration credentials that the
 * browser kept while Vercel /tmp SQLite was reset.
 */
export function registerWorkspaceRoutes(app) {
  app.post(
    '/api/workspace/rehydrate',
    requirePermission(
      'settings:write',
      'lead_settings:write',
      'api_integrations:write',
      'users:write'
    ),
    async (req, res) => {
      const body = req.body || {};
      const applied = {
        settings: false,
        leadSettings: false,
        integrations: 0,
        durableStore: durableStoreConfigured(),
      };

      const tx = db.transaction(() => {
        if (body.settings && typeof body.settings === 'object') {
          const upsert = db.prepare(
            'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)'
          );
          for (const [key, value] of Object.entries(body.settings)) {
            upsert.run(key, typeof value === 'string' ? value : JSON.stringify(value));
          }
          applied.settings = true;
        }

        if (body.leadSettings && typeof body.leadSettings === 'object') {
          const upsert = db.prepare(
            'INSERT OR REPLACE INTO lead_settings (key, value) VALUES (?, ?)'
          );
          for (const [key, value] of Object.entries(body.leadSettings)) {
            upsert.run(key, typeof value === 'string' ? value : JSON.stringify(value));
          }
          applied.leadSettings = true;
        }

        const integrations = body.integrations;
        if (integrations && typeof integrations === 'object') {
          const select = db.prepare('SELECT * FROM api_integrations WHERE provider = ?');
          const update = db.prepare(`
            UPDATE api_integrations
            SET enabled=?, status=?, config=?, secrets=?, notes=?, is_default=?, updated_at=?
            WHERE id=?
          `);
          const clearDefaults = db.prepare(
            'UPDATE api_integrations SET is_default = 0, updated_at = ? WHERE channel = ? AND id != ?'
          );

          for (const [provider, patch] of Object.entries(integrations)) {
            if (!patch || typeof patch !== 'object') continue;
            const existing = select.get(provider);
            if (!existing) continue;

            let currentSecrets = {};
            let currentConfig = {};
            try {
              currentSecrets = JSON.parse(existing.secrets || '{}');
            } catch {
              currentSecrets = {};
            }
            try {
              currentConfig = JSON.parse(existing.config || '{}');
            } catch {
              currentConfig = {};
            }

            const nextSecrets = { ...currentSecrets };
            if (patch.secrets && typeof patch.secrets === 'object') {
              for (const [k, v] of Object.entries(patch.secrets)) {
                if (v && v !== '••••••••') nextSecrets[k] = v;
              }
            }

            const nextConfig =
              patch.config && typeof patch.config === 'object'
                ? { ...currentConfig, ...patch.config }
                : currentConfig;

            const nextEnabled =
              patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : existing.enabled;
            let nextStatus = patch.status ?? existing.status;
            const hasSecrets = Object.values(nextSecrets).some(Boolean);
            if (!hasSecrets && (nextStatus === 'connected' || nextStatus === 'error')) {
              nextStatus = 'ready';
            } else if (hasSecrets && nextStatus === 'ready' && patch.status === 'connected') {
              nextStatus = 'connected';
            }

            const nextDefault =
              patch.is_default !== undefined
                ? patch.is_default
                  ? 1
                  : 0
                : existing.is_default || 0;
            if (nextDefault && existing.channel) {
              clearDefaults.run(now(), existing.channel, existing.id);
            }

            update.run(
              nextEnabled,
              nextStatus,
              JSON.stringify(nextConfig),
              JSON.stringify(nextSecrets),
              patch.notes !== undefined ? patch.notes : existing.notes,
              nextDefault,
              now(),
              existing.id
            );
            applied.integrations += 1;
          }
        }
      });

      tx();
      await persistDurableDbNow();
      res.json({ ok: true, applied });
    }
  );
}
