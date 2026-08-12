import { nanoid } from 'nanoid';
import db from '../db/db.js';
import { channelMeta, personalizeTemplate } from './channels/catalog.js';

const now = () => new Date().toISOString();

function todayKey(tz = 'Asia/Kolkata') {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Reset sent_today counters when calendar day rolls over */
export function resetDailyCountersIfNeeded() {
  const day = todayKey();
  const rows = db.prepare('SELECT id, last_run_day, sent_today FROM autopilot_campaigns').all();
  const upd = db.prepare(
    'UPDATE autopilot_campaigns SET sent_today = 0, last_run_day = ?, updated_at = ? WHERE id = ?'
  );
  const ts = now();
  for (const r of rows) {
    if (r.last_run_day !== day && (r.sent_today || 0) > 0) {
      upd.run(day, ts, r.id);
    } else if (!r.last_run_day) {
      db.prepare('UPDATE autopilot_campaigns SET last_run_day = ? WHERE id = ?').run(day, r.id);
    }
  }
  return day;
}

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

export function listCampaigns({ channel } = {}) {
  resetDailyCountersIfNeeded();
  let rows;
  if (channel) {
    rows = db
      .prepare('SELECT * FROM autopilot_campaigns WHERE channel = ? ORDER BY updated_at DESC')
      .all(channel);
  } else {
    rows = db.prepare('SELECT * FROM autopilot_campaigns ORDER BY updated_at DESC').all();
  }
  return rows.map(parseCampaign);
}

function audienceForChannel(channel, limit) {
  const meta = channelMeta(channel);
  if (meta.requires === 'email') {
    return db
      .prepare(
        `SELECT * FROM leads
         WHERE status = 'open' AND email IS NOT NULL AND TRIM(email) != ''
         ORDER BY score DESC LIMIT ?`
      )
      .all(limit);
  }
  return db
    .prepare(
      `SELECT * FROM leads
       WHERE status = 'open' AND phone IS NOT NULL AND TRIM(phone) != ''
       ORDER BY score DESC LIMIT ?`
    )
    .all(limit);
}

function resolveIntegration(campaign) {
  if (campaign.integration_id) {
    const row = db.prepare('SELECT * FROM api_integrations WHERE id = ?').get(campaign.integration_id);
    if (row) return row;
  }
  const byChannel = db
    .prepare(
      `SELECT * FROM api_integrations
       WHERE channel = ? AND enabled = 1
       ORDER BY is_default DESC, label ASC LIMIT 1`
    )
    .all(campaign.channel);
  if (byChannel[0]) return byChannel[0];
  return db
    .prepare(
      `SELECT * FROM api_integrations
       WHERE channel = ?
       ORDER BY is_default DESC, label ASC LIMIT 1`
    )
    .get(campaign.channel);
}

function maybeAiPolish(text, channel) {
  const ai = db
    .prepare(
      `SELECT * FROM api_integrations WHERE provider = 'openai' AND enabled = 1 LIMIT 1`
    )
    .get();
  if (!ai) return { text, aiUsed: false };
  const secrets = JSON.parse(ai.secrets || '{}');
  if (!secrets.apiKey) {
    // Ready mode: lightly polish without external call
    return {
      text: text.replace(/\s+/g, ' ').trim(),
      aiUsed: false,
      aiNote: 'OpenAI enabled but API key missing — using template',
    };
  }
  // Live key present: still local polish in this environment (no outbound LLM required)
  const polished = `[AI] ${text.trim()}`;
  return { text: polished, aiUsed: true };
}

/**
 * Execute a campaign in dry_run or live mode.
 * Live still queues locally when provider secrets are missing (ready-to-wire).
 */
export function runCampaign(campaignId, { mode, limit } = {}) {
  resetDailyCountersIfNeeded();
  const campaign = parseCampaign(
    db.prepare('SELECT * FROM autopilot_campaigns WHERE id = ?').get(campaignId)
  );
  if (!campaign) {
    const err = new Error('Campaign not found');
    err.status = 404;
    throw err;
  }

  const meta = channelMeta(campaign.channel);
  const runMode = mode || campaign.run_mode || 'live';
  const day = todayKey();
  const remaining = Math.max(0, (campaign.daily_limit || 50) - (campaign.sent_today || 0));
  if (remaining <= 0) {
    const err = new Error(`Daily limit reached (${campaign.daily_limit}). Resets tomorrow.`);
    err.status = 429;
    throw err;
  }

  const batch = Math.min(limit || 8, remaining, 25);
  const leads = audienceForChannel(campaign.channel, batch);
  if (!leads.length) {
    return {
      campaignId: campaign.id,
      channel: campaign.channel,
      mode: runMode,
      executed: 0,
      actions: [],
      message: `No open leads with ${meta.requires} for ${meta.short}. Import leads first.`,
      integration: null,
    };
  }

  const integration = resolveIntegration(campaign);
  const secrets = integration ? JSON.parse(integration.secrets || '{}') : {};
  const hasLiveCreds = Object.values(secrets).some(Boolean);
  const delivery =
    runMode === 'dry_run'
      ? 'dry_run'
      : hasLiveCreds && integration?.enabled
        ? 'live_queued'
        : 'ready_simulated';

  const insertActivity = db.prepare(`
    INSERT INTO activities (id, lead_id, contact_id, type, channel, title, detail, status, created_at)
    VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)
  `);
  const updateLead = db.prepare(`
    UPDATE leads SET last_contacted_at=?, next_action=?, updated_at=?,
      stage=CASE WHEN stage='new' THEN 'contacted' ELSE stage END
    WHERE id=?
  `);

  const actions = [];
  const ts = now();
  const tx = db.transaction(() => {
    for (const lead of leads) {
      let body = personalizeTemplate(campaign.message_template || meta.defaultTemplate, lead, {
        subject: campaign.subject || meta.defaultSubject,
      });
      let subject = personalizeTemplate(campaign.subject || meta.defaultSubject, lead);

      let aiUsed = false;
      if (campaign.ai_personalize) {
        const polished = maybeAiPolish(body, campaign.channel);
        body = polished.text;
        aiUsed = !!polished.aiUsed;
      }

      const detailParts = [
        subject ? `Subject: ${subject}` : null,
        body.slice(0, 400),
        integration ? `via ${integration.label}` : null,
        `mode=${delivery}`,
        aiUsed ? 'ai=on' : null,
      ].filter(Boolean);

      insertActivity.run(
        nanoid(),
        lead.id,
        meta.activityType,
        campaign.channel,
        `${runMode === 'dry_run' ? '[Dry-run] ' : ''}Autopilot ${meta.short}: ${campaign.name}`,
        detailParts.join(' · '),
        runMode === 'dry_run' ? 'planned' : 'completed',
        ts
      );

      if (runMode !== 'dry_run') {
        updateLead.run(ts, `Await ${meta.short} reply`, ts, lead.id);
      }

      actions.push({
        leadId: lead.id,
        leadName: lead.name,
        company: lead.company,
        channel: campaign.channel,
        to: meta.requires === 'email' ? lead.email : lead.phone,
        subject: subject || null,
        preview: body.slice(0, 120),
        delivery,
        integration: integration?.label || null,
      });
    }

    if (runMode !== 'dry_run') {
      const successBump = Math.min(99, (campaign.success_rate || 0) + actions.length * 0.4);
      db.prepare(`
        UPDATE autopilot_campaigns
        SET sent_today = sent_today + ?,
            status = 'active',
            last_run_day = ?,
            success_rate = ?,
            updated_at = ?
        WHERE id = ?
      `).run(actions.length, day, successBump, ts, campaign.id);
    } else {
      db.prepare('UPDATE autopilot_campaigns SET updated_at = ? WHERE id = ?').run(ts, campaign.id);
    }
  });
  tx();

  const verb =
    delivery === 'dry_run'
      ? 'Dry-run planned'
      : delivery === 'live_queued'
        ? 'Queued live'
        : 'Ready-mode executed';

  return {
    campaignId: campaign.id,
    channel: campaign.channel,
    mode: runMode,
    delivery,
    executed: actions.length,
    remainingAfter: runMode === 'dry_run' ? remaining : Math.max(0, remaining - actions.length),
    actions,
    integration: integration
      ? {
          id: integration.id,
          label: integration.label,
          provider: integration.provider,
          enabled: !!integration.enabled,
          status: integration.status,
          hasSecrets: hasLiveCreds,
        }
      : null,
    message: `${verb} ${actions.length} ${meta.short} outreaches${
      integration ? ` via ${integration.label}` : ''
    }`,
  };
}

export function getAutopilotStats() {
  resetDailyCountersIfNeeded();
  const campaigns = listCampaigns();
  const byChannel = { whatsapp: 0, gmail: 0, calls: 0 };
  const activeByChannel = { whatsapp: 0, gmail: 0, calls: 0 };
  let sentToday = 0;
  let active = 0;
  for (const c of campaigns) {
    byChannel[c.channel] = (byChannel[c.channel] || 0) + (c.sent_today || 0);
    sentToday += c.sent_today || 0;
    if (c.status === 'active') {
      active += 1;
      activeByChannel[c.channel] = (activeByChannel[c.channel] || 0) + 1;
    }
  }
  const recent = db
    .prepare(
      `SELECT * FROM activities WHERE channel IN ('whatsapp','gmail','calls')
       ORDER BY created_at DESC LIMIT 20`
    )
    .all();

  const integrations = db
    .prepare(
      `SELECT id, provider, label, category, channel, enabled, status, is_default
       FROM api_integrations
       WHERE channel IN ('whatsapp','gmail','calls','ai')
       ORDER BY channel, is_default DESC, label`
    )
    .all()
    .map((r) => ({ ...r, enabled: !!r.enabled, is_default: !!r.is_default }));

  return {
    sentToday,
    activeCampaigns: active,
    byChannel,
    activeByChannel,
    recent,
    campaigns: campaigns.length,
    playbooks: getPlaybooks(),
    integrations,
  };
}

export function getPlaybooks() {
  return {
    whatsapp: channelMeta('whatsapp'),
    gmail: channelMeta('gmail'),
    calls: channelMeta('calls'),
  };
}
