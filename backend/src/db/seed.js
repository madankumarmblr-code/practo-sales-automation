import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import db from './db.js';
import { permissionsForRole } from '../auth/roles.js';
import { INTEGRATION_CATALOG, channelMeta } from '../services/channels/catalog.js';

const now = () => new Date().toISOString();

function ensureIntegrations() {
  const ts = now();
  const insert = db.prepare(`
    INSERT INTO api_integrations (
      id, provider, label, category, enabled, status, config, secrets, last_tested_at, notes, updated_at, channel, is_default
    ) VALUES (?, ?, ?, ?, 0, 'ready', ?, ?, NULL, ?, ?, ?, ?)
  `);
  const updateMeta = db.prepare(`
    UPDATE api_integrations
    SET label = ?, category = ?, channel = ?, is_default = ?, notes = COALESCE(NULLIF(notes, ''), ?), updated_at = ?
    WHERE provider = ?
  `);

  for (const p of INTEGRATION_CATALOG) {
    const existing = db.prepare('SELECT id FROM api_integrations WHERE provider = ?').get(p.provider);
    if (existing) {
      updateMeta.run(
        p.label,
        p.category,
        p.channel,
        p.is_default ? 1 : 0,
        p.notes,
        ts,
        p.provider
      );
    } else {
      insert.run(
        nanoid(),
        p.provider,
        p.label,
        p.category,
        JSON.stringify(p.config),
        JSON.stringify(p.secrets),
        p.notes,
        ts,
        p.channel,
        p.is_default ? 1 : 0
      );
    }
  }

  hydrateIntegrationSecretsFromEnv();
}

/**
 * On Vercel, SQLite under /tmp is ephemeral — hydrate common API keys from
 * environment variables on every boot so Integrations keep working after deploys.
 * Does not overwrite a non-empty secret already saved in the DB unless
 * INTEGRATION_SECRETS_FORCE=1.
 */
function hydrateIntegrationSecretsFromEnv() {
  const force = String(process.env.INTEGRATION_SECRETS_FORCE || '') === '1';
  const map = [
    { provider: 'google_maps', secret: 'apiKey', env: 'GOOGLE_MAPS_API_KEY' },
    { provider: 'google_gemini', secret: 'apiKey', env: 'GOOGLE_GEMINI_API_KEY' },
    { provider: 'openai', secret: 'apiKey', env: 'OPENAI_API_KEY' },
    { provider: 'anthropic_claude', secret: 'apiKey', env: 'ANTHROPIC_API_KEY' },
    { provider: 'groq_llm', secret: 'apiKey', env: 'GROQ_API_KEY' },
    { provider: 'serpapi', secret: 'apiKey', env: 'SERPAPI_API_KEY' },
    { provider: 'sendgrid_email', secret: 'apiKey', env: 'SENDGRID_API_KEY' },
    { provider: 'resend_email', secret: 'apiKey', env: 'RESEND_API_KEY' },
    { provider: 'hunter_email', secret: 'apiKey', env: 'HUNTER_API_KEY' },
    { provider: 'apify', secret: 'token', env: 'APIFY_TOKEN' },
    { provider: 'outscraper', secret: 'apiKey', env: 'OUTSCRAPER_API_KEY' },
    {
      provider: 'whatsapp_meta',
      secret: 'accessToken',
      env: 'WHATSAPP_META_ACCESS_TOKEN',
    },
    { provider: 'twilio_calls', secret: 'accountSid', env: 'TWILIO_ACCOUNT_SID' },
    { provider: 'twilio_calls', secret: 'authToken', env: 'TWILIO_AUTH_TOKEN' },
    { provider: 'whatsapp_twilio', secret: 'accountSid', env: 'TWILIO_ACCOUNT_SID' },
    { provider: 'whatsapp_twilio', secret: 'authToken', env: 'TWILIO_AUTH_TOKEN' },
  ];

  const byProvider = new Map();
  for (const row of map) {
    const value = String(process.env[row.env] || '').trim();
    if (!value) continue;
    if (!byProvider.has(row.provider)) byProvider.set(row.provider, {});
    byProvider.get(row.provider)[row.secret] = value;
  }

  // Optional JSON blob: { "google_maps": { "apiKey": "..." }, ... }
  try {
    const raw = process.env.INTEGRATION_SECRETS_JSON;
    if (raw) {
      const parsed = JSON.parse(raw);
      for (const [provider, secrets] of Object.entries(parsed || {})) {
        if (!secrets || typeof secrets !== 'object') continue;
        if (!byProvider.has(provider)) byProvider.set(provider, {});
        Object.assign(byProvider.get(provider), secrets);
      }
    }
  } catch (err) {
    console.warn('INTEGRATION_SECRETS_JSON parse failed:', err.message);
  }

  const update = db.prepare(
    'UPDATE api_integrations SET secrets = ?, enabled = CASE WHEN ? = 1 THEN 1 ELSE enabled END, updated_at = ? WHERE provider = ?'
  );
  const ts = now();
  let applied = 0;
  for (const [provider, incoming] of byProvider.entries()) {
    const row = db.prepare('SELECT secrets, enabled FROM api_integrations WHERE provider = ?').get(provider);
    if (!row) continue;
    let current = {};
    try {
      current = JSON.parse(row.secrets || '{}');
    } catch {
      current = {};
    }
    let changed = false;
    const next = { ...current };
    for (const [k, v] of Object.entries(incoming)) {
      if (!v) continue;
      if (force || !String(current[k] || '').trim()) {
        if (next[k] !== v) {
          next[k] = v;
          changed = true;
        }
      }
    }
    if (!changed) continue;
    const enable = Object.values(next).some(Boolean) ? 1 : 0;
    update.run(JSON.stringify(next), enable, ts, provider);
    applied += 1;
  }
  if (applied) {
    console.log(`Hydrated ${applied} integration(s) from environment secrets`);
  }
}

function ensureDefaultCampaigns() {
  const ts = now();
  const insert = db.prepare(`
    INSERT INTO autopilot_campaigns (
      id, name, channel, status, goal, message_template, daily_limit, sent_today, success_rate,
      integration_id, subject, channel_config, ai_personalize, run_mode, last_run_day, created_at, updated_at
    ) VALUES (?, ?, ?, 'paused', ?, ?, ?, 0, 0, ?, ?, '{}', 1, 'live', NULL, ?, ?)
  `);

  for (const channel of ['whatsapp', 'gmail', 'calls']) {
    const existing = db
      .prepare('SELECT id FROM autopilot_campaigns WHERE channel = ? LIMIT 1')
      .get(channel);
    if (existing) continue;
    const meta = channelMeta(channel);
    const integ = db
      .prepare(
        `SELECT id FROM api_integrations WHERE channel = ? ORDER BY is_default DESC, label ASC LIMIT 1`
      )
      .get(channel);
    insert.run(
      nanoid(),
      `${meta.short} — Ready Pilot`,
      channel,
      meta.defaultGoal,
      meta.defaultTemplate,
      meta.defaultDailyLimit,
      integ?.id || null,
      meta.defaultSubject,
      ts,
      ts
    );
  }
}

/**
 * Bootstrap system defaults — Super Admin, integrations, ready AI pilots.
 */
export function bootstrap() {
  const stageCount = db.prepare('SELECT COUNT(*) as c FROM pipeline_stages').get().c;
  if (stageCount === 0) {
    const stages = [
      { name: 'New', slug: 'new', color: '#5B8DEF', position: 0 },
      { name: 'Contacted', slug: 'contacted', color: '#1DB8A0', position: 1 },
      { name: 'Qualified', slug: 'qualified', color: '#E8A838', position: 2 },
      { name: 'Proposal', slug: 'proposal', color: '#C45C26', position: 3 },
      { name: 'Won', slug: 'won', color: '#2F9E44', position: 4 },
      { name: 'Lost', slug: 'lost', color: '#868E96', position: 5 },
    ];
    const insert = db.prepare(
      'INSERT INTO pipeline_stages (id, name, slug, color, position) VALUES (?, ?, ?, ?, ?)'
    );
    for (const s of stages) insert.run(nanoid(), s.name, s.slug, s.color, s.position);
  }

  const sourceCount = db.prepare('SELECT COUNT(*) as c FROM lead_sources').get().c;
  if (sourceCount === 0) {
    const sources = [
      { name: 'Website', weight: 70 },
      { name: 'Locations Sheet Discovery', weight: 85 },
      { name: 'WhatsApp Campaign', weight: 75 },
      { name: 'Gmail Outreach', weight: 65 },
      { name: 'Cold Call', weight: 55 },
      { name: 'Referral', weight: 90 },
      { name: 'Practo Marketplace', weight: 80 },
      { name: 'manual', weight: 40 },
    ];
    const insert = db.prepare(
      'INSERT INTO lead_sources (id, name, enabled, weight) VALUES (?, ?, 1, ?)'
    );
    for (const s of sources) insert.run(nanoid(), s.name, s.weight);
  }

  const settingsCount = db.prepare('SELECT COUNT(*) as c FROM lead_settings').get().c;
  if (settingsCount === 0) {
    const scoring = {
      emailOpened: 5,
      whatsappReplied: 12,
      callCompleted: 15,
      demoBooked: 30,
      proposalSent: 20,
      sourceWeights: true,
    };
    const insertSetting = db.prepare('INSERT INTO lead_settings (key, value) VALUES (?, ?)');
    insertSetting.run('scoring_rules', JSON.stringify(scoring));
    insertSetting.run(
      'auto_assign',
      JSON.stringify({
        enabled: false,
        roundRobin: true,
        strategy: 'round_robin',
        agents: ['Unassigned'],
      })
    );
    insertSetting.run(
      'enrichment',
      JSON.stringify({
        enabled: true,
        pullCompanyData: true,
        suggestScore: true,
      })
    );
    insertSetting.run(
      'notifications',
      JSON.stringify({
        newLead: true,
        stageChange: true,
        highScore: true,
        assignment: true,
      })
    );
  } else {
    // Ensure newer keys exist on upgraded DBs
    const get = db.prepare('SELECT value FROM lead_settings WHERE key = ?');
    const upsert = db.prepare('INSERT OR REPLACE INTO lead_settings (key, value) VALUES (?, ?)');
    if (!get.get('enrichment')) {
      upsert.run(
        'enrichment',
        JSON.stringify({ enabled: true, pullCompanyData: true, suggestScore: true })
      );
    }
    if (!get.get('notifications')) {
      upsert.run(
        'notifications',
        JSON.stringify({
          newLead: true,
          stageChange: true,
          highScore: true,
          assignment: true,
        })
      );
    }
    const auto = get.get('auto_assign');
    if (auto) {
      try {
        const parsed = JSON.parse(auto.value);
        if (!parsed.strategy) {
          upsert.run(
            'auto_assign',
            JSON.stringify({
              ...parsed,
              strategy: parsed.roundRobin ? 'round_robin' : 'manual',
              agents: parsed.agents || ['Unassigned'],
            })
          );
        }
      } catch {
        /* ignore */
      }
    }
  }

  const appCount = db.prepare('SELECT COUNT(*) as c FROM app_settings').get().c;
  if (appCount === 0) {
    const appSettings = {
      profile: {
        orgName: 'Practo Enterprise',
        company: 'Practo Enterprise',
        workspace: 'Enterprise Sales',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
      },
      ai: {
        model: 'gpt-sales-assist',
        tone: 'consultative',
        autoFollowUpHours: 24,
        personalizeWithCompany: true,
      },
      notifications: {
        email: true,
        inApp: true,
        slackWebhook: '',
      },
    };
    const upsert = db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(appSettings)) {
      upsert.run(k, JSON.stringify(v));
    }
  }

  ensureIntegrations();
  ensureDefaultCampaigns();

  const ts = now();
  const presetEmails = [
    'admin@practo.sales',
    'manager@practo.sales',
    'agent@practo.sales',
    'viewer@practo.sales',
  ];
  for (const email of presetEmails) {
    db.prepare('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = ?)').run(email);
    db.prepare('DELETE FROM users WHERE email = ?').run(email);
  }

  let superAdmin = db
    .prepare("SELECT * FROM users WHERE role = 'superadmin' OR username = 'superadmin' OR email = ?")
    .get('superadmin@practo.sales');

  const demoPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin@123';
  const passwordHash = bcrypt.hashSync(demoPassword, 10);

  if (!superAdmin) {
    // Stable id so signed tokens still resolve after serverless /tmp DB rebuilds
    const id = 'user_superadmin';
    db.prepare(`
      INSERT INTO users (id, name, email, username, password_hash, role, permissions, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'superadmin', ?, 1, ?, ?)
    `).run(
      id,
      'Super Admin',
      'superadmin@practo.sales',
      'superadmin',
      passwordHash,
      JSON.stringify(permissionsForRole('superadmin')),
      ts,
      ts
    );
    console.log('Created Super Admin user');
  } else {
    // Keep demo credentials predictable across local / Docker / Vercel boots
    db.prepare(`
      UPDATE users
      SET role = 'superadmin',
          username = 'superadmin',
          email = 'superadmin@practo.sales',
          password_hash = ?,
          permissions = ?,
          active = 1,
          updated_at = ?
      WHERE id = ?
    `).run(passwordHash, JSON.stringify(permissionsForRole('superadmin')), ts, superAdmin.id);
  }

  console.log('Super Admin ready');
  console.log('  User ID:  superadmin');
  console.log('  Email:    superadmin@practo.sales');
  console.log(`  Password: ${demoPassword}`);

  console.log('Bootstrap complete — integrations & AI pilots ready; Super Admin ready');
}

bootstrap();
