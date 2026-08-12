import { nanoid } from 'nanoid';
import db from '../db/db.js';
import { personalizeTemplate } from './channels/catalog.js';
import { getDialogue, productLabel, DIALOGUES, PRODUCTS } from './channels/dialogues.js';

const now = () => new Date().toISOString();

export function ensureOutreachTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS outreach_records (
      id TEXT PRIMARY KEY,
      channel TEXT NOT NULL,
      record_type TEXT NOT NULL,
      direction TEXT DEFAULT 'outbound',
      to_phone TEXT DEFAULT '',
      to_email TEXT DEFAULT '',
      product_pitch TEXT DEFAULT '',
      dialogue_id TEXT DEFAULT '',
      dialogue_title TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      body TEXT DEFAULT '',
      steps TEXT DEFAULT '[]',
      campaign_id TEXT,
      lead_id TEXT,
      lead_name TEXT DEFAULT '',
      company TEXT DEFAULT '',
      integration_id TEXT,
      integration_label TEXT DEFAULT '',
      status TEXT DEFAULT 'queued',
      detail TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_outreach_channel ON outreach_records(channel);
    CREATE INDEX IF NOT EXISTS idx_outreach_created ON outreach_records(created_at);
  `);
}

ensureOutreachTable();

export function listOutreachRecords({ channel, product, q, limit = 100 } = {}) {
  let rows = db
    .prepare('SELECT * FROM outreach_records ORDER BY created_at DESC LIMIT ?')
    .all(Math.min(Number(limit) || 100, 500));
  if (channel && channel !== 'all') rows = rows.filter((r) => r.channel === channel);
  if (product && product !== 'all') rows = rows.filter((r) => r.product_pitch === product);
  if (q) {
    const needle = String(q).toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.lead_name || '').toLowerCase().includes(needle) ||
        (r.company || '').toLowerCase().includes(needle) ||
        (r.to_phone || '').toLowerCase().includes(needle) ||
        (r.to_email || '').toLowerCase().includes(needle) ||
        (r.body || '').toLowerCase().includes(needle) ||
        (r.dialogue_title || '').toLowerCase().includes(needle)
    );
  }
  return rows.map((r) => ({
    ...r,
    steps: JSON.parse(r.steps || '[]'),
    product_label: productLabel(r.product_pitch),
  }));
}

export function createOutreachRecord(input = {}) {
  const id = nanoid();
  const ts = now();
  const dialogue = input.dialogue_id ? getDialogue(input.dialogue_id) : null;
  const steps = input.steps || dialogue?.steps || [];
  db.prepare(`
    INSERT INTO outreach_records (
      id, channel, record_type, direction, to_phone, to_email, product_pitch, dialogue_id, dialogue_title,
      subject, body, steps, campaign_id, lead_id, lead_name, company, integration_id, integration_label,
      status, detail, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    input.channel || 'whatsapp',
    input.record_type || 'message',
    input.direction || 'outbound',
    input.to_phone || '',
    input.to_email || '',
    input.product_pitch || dialogue?.product || '',
    input.dialogue_id || dialogue?.id || '',
    input.dialogue_title || dialogue?.title || '',
    input.subject || '',
    input.body || '',
    JSON.stringify(steps),
    input.campaign_id || null,
    input.lead_id || null,
    input.lead_name || '',
    input.company || '',
    input.integration_id || null,
    input.integration_label || '',
    input.status || 'queued',
    input.detail || '',
    input.created_by || '',
    ts
  );
  return listOutreachRecords({ limit: 1 }).find((r) => r.id === id) ||
    db.prepare('SELECT * FROM outreach_records WHERE id = ?').get(id);
}

/**
 * Self-test an integration to the user's own phone/email.
 */
export function selfTestIntegration(integration, { phone, email, product = 'prime', dialogue_id, user } = {}) {
  const channel = integration.channel || inferChannel(integration);
  if (!['whatsapp', 'gmail', 'calls'].includes(channel)) {
    const err = new Error('Self-test is available for WhatsApp, Gmail, and Calls integrations');
    err.status = 400;
    throw err;
  }

  if (channel === 'gmail' && !email) {
    const err = new Error('Enter your email address to test Gmail / email integrations');
    err.status = 400;
    throw err;
  }
  if ((channel === 'whatsapp' || channel === 'calls') && !phone) {
    const err = new Error('Enter your mobile number to test WhatsApp / Calls integrations');
    err.status = 400;
    throw err;
  }

  const secrets = JSON.parse(integration.secrets || '{}');
  const hasSecrets = Object.values(secrets).some(Boolean);
  const dialogue =
    getDialogue(dialogue_id) ||
    DIALOGUES.find((d) => d.channel === channel && d.id.includes('self_test')) ||
    DIALOGUES.find((d) => d.channel === channel && d.product === product);

  const fakeLead = {
    name: user?.name || 'Tester',
    company: 'Your clinic',
    phone: phone || '',
    email: email || '',
  };
  const body = personalizeTemplate(dialogue?.body || 'Practo Autopilot self-test', fakeLead).replaceAll(
    '{{product}}',
    productLabel(product)
  );
  const subject = personalizeTemplate(dialogue?.subject || '', fakeLead);

  const status = hasSecrets && integration.enabled ? 'test_queued' : 'test_simulated';
  const recordType = channel === 'calls' ? 'call' : channel === 'gmail' ? 'email' : 'message';

  const record = createOutreachRecord({
    channel,
    record_type: recordType,
    direction: 'self_test',
    to_phone: phone || '',
    to_email: email || '',
    product_pitch: product,
    dialogue_id: dialogue?.id,
    dialogue_title: dialogue?.title,
    subject,
    body,
    steps: dialogue?.steps,
    integration_id: integration.id,
    integration_label: integration.label,
    status,
    detail: hasSecrets
      ? `Self-test ${status} via ${integration.label}`
      : `Simulated self-test via ${integration.label} (add credentials + enable for live provider handoff)`,
    created_by: user?.email || user?.username || '',
  });

  // Mirror into activities for Autopilot feed
  db.prepare(`
    INSERT INTO activities (id, lead_id, contact_id, type, channel, title, detail, status, created_at)
    VALUES (?, NULL, NULL, ?, ?, ?, ?, 'completed', ?)
  `).run(
    nanoid(),
    recordType === 'call' ? 'call' : recordType === 'email' ? 'email' : 'whatsapp',
    channel,
    `Self-test ${integration.label}`,
    `${status} → ${phone || email} · ${productLabel(product)} · ${body.slice(0, 160)}`,
    now()
  );

  const ts = now();
  db.prepare(
    'UPDATE api_integrations SET status=?, last_tested_at=?, updated_at=? WHERE id=?'
  ).run(hasSecrets ? 'connected' : 'ready', ts, ts, integration.id);

  return {
    ok: true,
    status,
    message:
      status === 'test_queued'
        ? `Test ${recordType} queued to ${phone || email} via ${integration.label}`
        : `Test ${recordType} simulated to ${phone || email}. Add API credentials & enable integration for live provider send.`,
    record,
    dialogue,
    product: { id: product, label: productLabel(product) },
    testedAt: ts,
  };
}

function inferChannel(integration) {
  if (integration.channel) return integration.channel;
  const p = integration.provider || '';
  if (p.includes('whatsapp')) return 'whatsapp';
  if (p.includes('gmail') || p.includes('sendgrid') || p.includes('ses')) return 'gmail';
  if (p.includes('twilio') || p.includes('exotel') || p.includes('knowlarity') || p.includes('call'))
    return 'calls';
  return '';
}

export function catalogPayload() {
  return { products: PRODUCTS, dialogues: DIALOGUES };
}
