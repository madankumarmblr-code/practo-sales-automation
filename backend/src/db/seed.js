import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import db from './db.js';
import { permissionsForRole } from '../auth/roles.js';

const now = () => new Date().toISOString();

/**
 * Bootstrap system defaults only — no demo leads/contacts/campaigns.
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
      { name: 'Website', weight: 80 },
      { name: 'LinkedIn', weight: 70 },
      { name: 'Referral', weight: 90 },
      { name: 'WhatsApp Campaign', weight: 60 },
      { name: 'Gmail Outreach', weight: 55 },
      { name: 'Cold Call', weight: 40 },
      { name: 'Clinic Directory', weight: 75 },
      { name: 'Multi-platform Discovery', weight: 85 },
      { name: 'Event', weight: 65 },
    ];
    const insert = db.prepare(
      'INSERT INTO lead_sources (id, name, enabled, weight) VALUES (?, ?, 1, ?)'
    );
    for (const s of sources) insert.run(nanoid(), s.name, s.weight);
  }

  const leadSettingCount = db.prepare('SELECT COUNT(*) as c FROM lead_settings').get().c;
  if (leadSettingCount === 0) {
    const leadSettings = {
      scoring_rules: {
        emailOpened: 5,
        whatsappReplied: 15,
        callCompleted: 20,
        demoBooked: 30,
        companySizeBonus: 10,
        sourceWeights: true,
      },
      auto_assign: {
        enabled: false,
        strategy: 'round_robin',
        agents: [],
      },
      enrichment: {
        enabled: true,
        pullCompanyData: true,
        suggestScore: true,
      },
      notifications: {
        hotLeadAlert: true,
        dailyDigest: false,
        stageChange: true,
      },
    };
    const upsert = db.prepare('INSERT OR REPLACE INTO lead_settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(leadSettings)) {
      upsert.run(k, JSON.stringify(v));
    }
  }

  const appSettingCount = db.prepare('SELECT COUNT(*) as c FROM app_settings').get().c;
  if (appSettingCount === 0) {
    const appSettings = {
      profile: {
        orgName: 'Practo Sales',
        workspace: '',
        timezone: 'Asia/Kolkata',
        currency: 'INR',
      },
      integrations: {
        whatsapp: { connected: false, businessNumber: '', provider: 'Meta Cloud API' },
        gmail: { connected: false, account: '', dailyQuota: 500 },
        calls: { connected: false, provider: 'Twilio', number: '' },
      },
      ai: {
        model: 'gpt-sales-assist',
        tone: 'professional-warm',
        personalizeWithCompany: true,
        autoFollowUpHours: 48,
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

  const apiCount = db.prepare('SELECT COUNT(*) as c FROM api_integrations').get().c;
  if (apiCount === 0) {
    const ts = now();
    const providers = [
      {
        provider: 'practo',
        label: 'Practo API',
        category: 'Marketplace',
        config: { baseUrl: 'https://api.practo.com', environment: 'sandbox', version: 'v1' },
        secrets: { apiKey: '', clientId: '', clientSecret: '' },
        notes: 'Ready for Practo partner credentials',
      },
      {
        provider: 'whatsapp_meta',
        label: 'WhatsApp Cloud API (Meta)',
        category: 'Messaging',
        config: { phoneNumberId: '', wabaId: '', apiVersion: 'v19.0' },
        secrets: { accessToken: '' },
        notes: 'Connect Meta WhatsApp Business for Autopilot',
      },
      {
        provider: 'gmail',
        label: 'Gmail / Google Workspace',
        category: 'Email',
        config: { sender: '', scopes: 'gmail.send,gmail.readonly' },
        secrets: { oauthClientId: '', oauthClientSecret: '', refreshToken: '' },
        notes: 'OAuth credentials for Gmail outreach',
      },
      {
        provider: 'twilio_calls',
        label: 'Twilio Voice / Calls',
        category: 'Voice',
        config: { fromNumber: '', region: 'in1' },
        secrets: { accountSid: '', authToken: '' },
        notes: 'Ready for AI call qualifier campaigns',
      },
      {
        provider: 'google_maps',
        label: 'Google Maps Places API',
        category: 'Discovery',
        config: { region: 'in', language: 'en' },
        secrets: { apiKey: '' },
        notes: 'Enrich clinic discovery with live Places data',
      },
      {
        provider: 'openai',
        label: 'OpenAI / LLM',
        category: 'AI',
        config: { model: 'gpt-4o-mini', temperature: 0.4 },
        secrets: { apiKey: '' },
        notes: 'Powers Autopilot message personalization',
      },
      {
        provider: 'justdial',
        label: 'Justdial Partner API',
        category: 'Discovery',
        config: { baseUrl: '', cityDefault: 'Bangalore' },
        secrets: { apiKey: '' },
        notes: 'Optional listing enrichment source',
      },
      {
        provider: 'webhook_outbound',
        label: 'Outbound Webhooks',
        category: 'Automation',
        config: { leadCreatedUrl: '', stageChangedUrl: '', exportUrl: '' },
        secrets: { signingSecret: '' },
        notes: 'Push events to your CRM or data warehouse',
      },
    ];
    const insert = db.prepare(`
      INSERT INTO api_integrations (
        id, provider, label, category, enabled, status, config, secrets, last_tested_at, notes, updated_at
      ) VALUES (?, ?, ?, ?, 0, 'ready', ?, ?, NULL, ?, ?)
    `);
    for (const p of providers) {
      insert.run(
        nanoid(),
        p.provider,
        p.label,
        p.category,
        JSON.stringify(p.config),
        JSON.stringify(p.secrets),
        p.notes,
        ts
      );
    }
  }

  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (userCount === 0) {
    const ts = now();
    const defaults = [
      {
        name: 'Admin User',
        email: 'admin@practo.sales',
        password: 'Admin@123',
        role: 'admin',
      },
      {
        name: 'Sales Manager',
        email: 'manager@practo.sales',
        password: 'Manager@123',
        role: 'manager',
      },
      {
        name: 'Sales Agent',
        email: 'agent@practo.sales',
        password: 'Agent@123',
        role: 'agent',
      },
      {
        name: 'Viewer',
        email: 'viewer@practo.sales',
        password: 'Viewer@123',
        role: 'viewer',
      },
    ];
    const insert = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, permissions, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `);
    for (const u of defaults) {
      insert.run(
        nanoid(),
        u.name,
        u.email,
        bcrypt.hashSync(u.password, 10),
        u.role,
        JSON.stringify(permissionsForRole(u.role)),
        ts,
        ts
      );
    }
    console.log('Created default permission-level users (no demo CRM data)');
    console.log('  admin@practo.sales / Admin@123');
    console.log('  manager@practo.sales / Manager@123');
    console.log('  agent@practo.sales / Agent@123');
    console.log('  viewer@practo.sales / Viewer@123');
  }

  console.log('Bootstrap complete — CRM tables empty (no demo leads/contacts)');
}

bootstrap();
