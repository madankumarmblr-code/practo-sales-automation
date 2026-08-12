import { nanoid } from 'nanoid';
import db from '../db/db.js';

const now = () => new Date().toISOString();

export function registerAutopilotRoutes(app) {
  app.get('/api/autopilot/campaigns', (_req, res) => {
    const rows = db
      .prepare('SELECT * FROM autopilot_campaigns ORDER BY updated_at DESC')
      .all();
    res.json(rows);
  });

  app.post('/api/autopilot/campaigns', (req, res) => {
    const body = req.body || {};
    if (!body.name || !body.channel) {
      return res.status(400).json({ error: 'name and channel are required' });
    }
    const id = nanoid();
    const ts = now();
    db.prepare(`
      INSERT INTO autopilot_campaigns (
        id, name, channel, status, goal, message_template, daily_limit, sent_today, success_rate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
    `).run(
      id,
      body.name,
      body.channel,
      body.status || 'paused',
      body.goal || '',
      body.message_template || '',
      body.daily_limit ?? 50,
      ts,
      ts
    );
    res.status(201).json(db.prepare('SELECT * FROM autopilot_campaigns WHERE id = ?').get(id));
  });

  app.put('/api/autopilot/campaigns/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM autopilot_campaigns WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });
    const b = req.body || {};
    db.prepare(`
      UPDATE autopilot_campaigns SET
        name=?, channel=?, status=?, goal=?, message_template=?, daily_limit=?, sent_today=?, success_rate=?, updated_at=?
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
      now(),
      req.params.id
    );
    res.json(db.prepare('SELECT * FROM autopilot_campaigns WHERE id = ?').get(req.params.id));
  });

  app.post('/api/autopilot/campaigns/:id/run', (req, res) => {
    const campaign = db.prepare('SELECT * FROM autopilot_campaigns WHERE id = ?').get(req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const openLeads = db
      .prepare("SELECT * FROM leads WHERE status = 'open' ORDER BY score DESC LIMIT 5")
      .all();

    const channelLabel =
      campaign.channel === 'whatsapp'
        ? 'WhatsApp'
        : campaign.channel === 'gmail'
          ? 'Gmail'
          : 'Call';

    const insertActivity = db.prepare(`
      INSERT INTO activities (id, lead_id, contact_id, type, channel, title, detail, status, created_at)
      VALUES (?, ?, NULL, ?, ?, ?, ?, 'completed', ?)
    `);
    const updateLead = db.prepare(`
      UPDATE leads SET last_contacted_at=?, next_action=?, updated_at=?, stage=CASE WHEN stage='new' THEN 'contacted' ELSE stage END
      WHERE id=?
    `);

    const actions = [];
    const ts = now();
    const tx = db.transaction(() => {
      for (const lead of openLeads) {
        const personalized = (campaign.message_template || '')
          .replaceAll('{{name}}', lead.name.split(' ')[0])
          .replaceAll('{{company}}', lead.company || 'your clinic');
        insertActivity.run(
          nanoid(),
          lead.id,
          campaign.channel === 'calls' ? 'call' : campaign.channel === 'whatsapp' ? 'whatsapp' : 'email',
          campaign.channel,
          `Autopilot ${channelLabel}: ${campaign.name}`,
          personalized.slice(0, 280) || `AI ${channelLabel} outreach executed`,
          ts
        );
        updateLead.run(ts, `Await ${channelLabel} reply`, ts, lead.id);
        actions.push({ leadId: lead.id, leadName: lead.name, channel: campaign.channel });
      }
      db.prepare(`
        UPDATE autopilot_campaigns
        SET sent_today = sent_today + ?, status = 'active', updated_at = ?
        WHERE id = ?
      `).run(actions.length, ts, campaign.id);
    });
    tx();

    res.json({
      campaignId: campaign.id,
      executed: actions.length,
      actions,
      message: `Autopilot ran ${actions.length} ${channelLabel} outreaches`,
    });
  });

  app.get('/api/autopilot/stats', (_req, res) => {
    const campaigns = db.prepare('SELECT * FROM autopilot_campaigns').all();
    const byChannel = { whatsapp: 0, gmail: 0, calls: 0 };
    let sentToday = 0;
    let active = 0;
    for (const c of campaigns) {
      byChannel[c.channel] = (byChannel[c.channel] || 0) + c.sent_today;
      sentToday += c.sent_today;
      if (c.status === 'active') active += 1;
    }
    const recent = db
      .prepare(
        `SELECT * FROM activities WHERE channel IN ('whatsapp','gmail','calls')
         ORDER BY created_at DESC LIMIT 12`
      )
      .all();
    res.json({ sentToday, activeCampaigns: active, byChannel, recent, campaigns: campaigns.length });
  });
}
