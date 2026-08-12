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
    };
    db.prepare('INSERT INTO lead_settings (key, value) VALUES (?, ?)').run(
      'scoring_rules',
      JSON.stringify(scoring)
    );
    db.prepare('INSERT INTO lead_settings (key, value) VALUES (?, ?)').run(
      'auto_assign',
      JSON.stringify({ enabled: false, roundRobin: true })
    );
  }

  const appCount = db.prepare('SELECT COUNT(*) as c FROM app_settings').get().c;
  if (appCount === 0) {
    const appSettings = {
      profile: { company: 'Practo Enterprise', timezone: 'Asia/Kolkata' },
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

  if (!superAdmin) {
    const id = nanoid();
    db.prepare(`
      INSERT INTO users (id, name, email, username, password_hash, role, permissions, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'superadmin', ?, 1, ?, ?)
    `).run(
      id,
      'Super Admin',
      'superadmin@practo.sales',
      'superadmin',
      bcrypt.hashSync('SuperAdmin@123', 10),
      JSON.stringify(permissionsForRole('superadmin')),
      ts,
      ts
    );
    console.log('Created Super Admin user');
    console.log('  username: superadmin');
    console.log('  email:    superadmin@practo.sales');
    console.log('  password: SuperAdmin@123');
  } else {
    db.prepare(`
      UPDATE users
      SET role = 'superadmin',
          username = COALESCE(NULLIF(username, ''), 'superadmin'),
          permissions = ?,
          active = 1,
          updated_at = ?
      WHERE id = ?
    `).run(JSON.stringify(permissionsForRole('superadmin')), ts, superAdmin.id);
  }

  console.log('Bootstrap complete — integrations & AI pilots ready; Super Admin ready');
}

bootstrap();
