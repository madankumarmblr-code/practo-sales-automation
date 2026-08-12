import { nanoid } from 'nanoid';
import db from '../db/db.js';
import { requirePermission } from '../auth/middleware.js';
import { CHANNELS, channelMeta } from '../services/channels/catalog.js';
import {
  listCampaigns,
  runCampaign,
  getAutopilotStats,
  getPlaybooks,
  resetDailyCountersIfNeeded,
} from '../services/autopilotEngine.js';

const now = () => new Date().toISOString();

function parseCampaign(row) {
  if (!row) return row;
  let channel_config = {};
  try {
    channel_config = JSON.parse(row.channel_config || '{}');
  } catch {
    channel_config = {};
  }
  return { ...row, channel_config, ai_personalize: !!row.ai_personalize };
}

export function registerAutopilotRoutes(app) {
  app.get('/api/autopilot/playbooks', requirePermission('autopilot:read'), (_req, res) => {
    res.json({ channels: getPlaybooks(), catalog: CHANNELS });
  });

  app.get('/api/autopilot/campaigns', requirePermission('autopilot:read'), (req, res) => {
    resetDailyCountersIfNeeded();
    const channel = (req.query.channel || '').toString();
    res.json(listCampaigns(channel ? { channel } : {}));
  });

  app.post('/api/autopilot/campaigns', requirePermission('autopilot:write'), (req, res) => {
    const body = req.body || {};
    if (!body.name || !body.channel) {
      return res.status(400).json({ error: 'name and channel are required' });
    }
    if (!CHANNELS[body.channel]) {
      return res.status(400).json({ error: 'channel must be whatsapp, gmail, or calls' });
    }
    const meta = channelMeta(body.channel);
    const id = nanoid();
    const ts = now();
    db.prepare(`
      INSERT INTO autopilot_campaigns (
        id, name, channel, status, goal, message_template, daily_limit, sent_today, success_rate,
        integration_id, subject, channel_config, ai_personalize, run_mode, last_run_day,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(
      id,
      body.name,
      body.channel,
      body.status || 'paused',
      body.goal || meta.defaultGoal,
      body.message_template || meta.defaultTemplate,
      body.daily_limit ?? meta.defaultDailyLimit,
      body.integration_id || null,
      body.subject || meta.defaultSubject,
      JSON.stringify(body.channel_config || {}),
      body.ai_personalize ? 1 : 0,
      body.run_mode || 'live',
      ts,
      ts
    );
    res.status(201).json(parseCampaign(db.prepare('SELECT * FROM autopilot_campaigns WHERE id = ?').get(id)));
  });

  app.put('/api/autopilot/campaigns/:id', requirePermission('autopilot:write'), (req, res) => {
    const existing = db.prepare('SELECT * FROM autopilot_campaigns WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });
    const b = req.body || {};
    db.prepare(`
      UPDATE autopilot_campaigns SET
        name=?, channel=?, status=?, goal=?, message_template=?, daily_limit=?,
        sent_today=?, success_rate=?, integration_id=?, subject=?, channel_config=?,
        ai_personalize=?, run_mode=?, updated_at=?
      WHERE id=?
    `).run(
      b.name ?? existing.name,
      b.channel ?? existing.channel,
      b.status ?? existing.status,
      b.goal ?? existing.goal,
      b.message_template ?? existing.message_template,
      b.daily_limit ?? existing.daily_limit,
      b.sent_today ?? existing.sent_today,
      b.success_rate ?? existing.success_rate,
      b.integration_id !== undefined ? b.integration_id : existing.integration_id,
      b.subject ?? existing.subject,
      b.channel_config ? JSON.stringify(b.channel_config) : existing.channel_config || '{}',
      b.ai_personalize !== undefined ? (b.ai_personalize ? 1 : 0) : existing.ai_personalize || 0,
      b.run_mode ?? existing.run_mode ?? 'live',
      now(),
      req.params.id
    );
    res.json(parseCampaign(db.prepare('SELECT * FROM autopilot_campaigns WHERE id = ?').get(req.params.id)));
  });

  app.delete('/api/autopilot/campaigns/:id', requirePermission('autopilot:write'), (req, res) => {
    const info = db.prepare('DELETE FROM autopilot_campaigns WHERE id = ?').run(req.params.id);
    if (!info.changes) return res.status(404).json({ error: 'Campaign not found' });
    res.json({ ok: true });
  });

  app.post('/api/autopilot/campaigns/:id/run', requirePermission('autopilot:write'), (req, res) => {
    try {
      const mode = req.body?.mode;
      const limit = req.body?.limit;
      const result = runCampaign(req.params.id, { mode, limit });
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'Run failed' });
    }
  });

  app.get('/api/autopilot/stats', requirePermission('autopilot:read'), (_req, res) => {
    res.json(getAutopilotStats());
  });
}
