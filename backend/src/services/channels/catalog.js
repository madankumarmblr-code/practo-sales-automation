/**
 * Multi-provider catalog + channel playbooks for Autopilot AI pilots.
 */

export const CHANNELS = {
  whatsapp: {
    id: 'whatsapp',
    label: 'WhatsApp AI Pilot',
    short: 'WhatsApp',
    icon: '💬',
    description: 'Warm intros, slot offers, and follow-ups via WhatsApp Business APIs.',
    activityType: 'whatsapp',
    requires: 'phone',
    defaultDailyLimit: 80,
    defaultGoal: 'Book Practo demo / Prime intro',
    defaultSubject: '',
    defaultTemplate:
      'Hi {{name}}, this is Practo Enterprise. Clinics like {{company}} in your area are unlocking more patient bookings with Practo Reach & Prime. Can I share a 2-min overview today?',
    advanced: [
      'Template / HSM personalization with {{name}} {{company}}',
      'Phone-qualified audience only',
      'Daily send caps + dry-run mode',
      'Multi-provider: Meta Cloud, Gupshup, Exotel WhatsApp',
    ],
  },
  gmail: {
    id: 'gmail',
    label: 'Gmail AI Pilot',
    short: 'Gmail',
    icon: '📧',
    description: 'Multi-touch email nurture with subject lines and AI-ready copy.',
    activityType: 'email',
    requires: 'email',
    defaultDailyLimit: 60,
    defaultGoal: 'Nurture → proposal conversation',
    defaultSubject: '{{company}} × Practo — patient growth plan',
    defaultTemplate:
      'Dear {{name}},\n\nI noticed {{company}} and wanted to share how Practo Enterprise helps clinics grow discovery and bookings (Prime, Reach, Video).\n\nWould you be open to a short call this week?\n\nBest,\nPracto Enterprise',
    advanced: [
      'Subject + body templates',
      'Email-qualified audience only',
      'Providers: Gmail OAuth, SendGrid, Amazon SES',
      'Optional OpenAI rewrite when AI connector is enabled',
    ],
  },
  calls: {
    id: 'calls',
    label: 'Calls AI Pilot',
    short: 'Calls',
    icon: '📞',
    description: 'AI qualifier scripts and dial queues for high-intent clinic leads.',
    activityType: 'call',
    requires: 'phone',
    defaultDailyLimit: 40,
    defaultGoal: 'Qualify → book commercial walkthrough',
    defaultSubject: '',
    defaultTemplate:
      'Script: Confirm speaking with {{name}} at {{company}}. Pitch Practo Reach visibility + Prime appointments. Ask for decision-maker / marketing head. Book 15-min commercial suite review.',
    advanced: [
      'Call script playbook',
      'Phone-qualified dial list',
      'Providers: Twilio, Exotel, Knowlarity',
      'Outcome logging into CRM activities',
    ],
  },
};

/** Multiple ready integration options per channel (+ shared AI / discovery) */
export const INTEGRATION_CATALOG = [
  // WhatsApp options
  {
    provider: 'whatsapp_meta',
    label: 'WhatsApp Cloud API (Meta)',
    category: 'Messaging',
    channel: 'whatsapp',
    is_default: 1,
    config: { phoneNumberId: '', wabaId: '', apiVersion: 'v19.0', templateNamespace: '' },
    secrets: { accessToken: '' },
    notes: 'Official Meta Cloud API — best for production WhatsApp Business',
  },
  {
    provider: 'whatsapp_gupshup',
    label: 'Gupshup WhatsApp',
    category: 'Messaging',
    channel: 'whatsapp',
    is_default: 0,
    config: { appName: '', sourceNumber: '', apiBase: 'https://api.gupshup.io' },
    secrets: { apiKey: '' },
    notes: 'India-friendly WhatsApp BSP alternative',
  },
  {
    provider: 'whatsapp_exotel',
    label: 'Exotel WhatsApp',
    category: 'Messaging',
    channel: 'whatsapp',
    is_default: 0,
    config: { subdomain: '', from: '' },
    secrets: { apiKey: '', apiToken: '' },
    notes: 'Exotel unified messaging for WhatsApp',
  },
  // Gmail / email options
  {
    provider: 'gmail',
    label: 'Gmail / Google Workspace',
    category: 'Email',
    channel: 'gmail',
    is_default: 1,
    config: { sender: '', scopes: 'gmail.send,gmail.readonly' },
    secrets: { oauthClientId: '', oauthClientSecret: '', refreshToken: '' },
    notes: 'OAuth for Gmail / Workspace send',
  },
  {
    provider: 'sendgrid_email',
    label: 'SendGrid Email',
    category: 'Email',
    channel: 'gmail',
    is_default: 0,
    config: { fromEmail: '', fromName: 'Practo Enterprise', region: 'global' },
    secrets: { apiKey: '' },
    notes: 'Transactional / marketing email at scale',
  },
  {
    provider: 'amazon_ses',
    label: 'Amazon SES',
    category: 'Email',
    channel: 'gmail',
    is_default: 0,
    config: { region: 'ap-south-1', fromEmail: '' },
    secrets: { accessKeyId: '', secretAccessKey: '' },
    notes: 'AWS SES for high-volume outbound email',
  },
  // Calls options
  {
    provider: 'twilio_calls',
    label: 'Twilio Voice',
    category: 'Voice',
    channel: 'calls',
    is_default: 1,
    config: { fromNumber: '', region: 'in1' },
    secrets: { accountSid: '', authToken: '' },
    notes: 'Twilio programmable voice dialer',
  },
  {
    provider: 'exotel_calls',
    label: 'Exotel Voice',
    category: 'Voice',
    channel: 'calls',
    is_default: 0,
    config: { subdomain: '', callerId: '' },
    secrets: { apiKey: '', apiToken: '' },
    notes: 'India call center / click-to-call',
  },
  {
    provider: 'knowlarity_calls',
    label: 'Knowlarity Voice',
    category: 'Voice',
    channel: 'calls',
    is_default: 0,
    config: { srNumber: '', channel: 'voice' },
    secrets: { apiKey: '', authToken: '' },
    notes: 'Cloud telephony for sales dialers',
  },
  // Shared / advanced
  {
    provider: 'openai',
    label: 'OpenAI / LLM',
    category: 'AI',
    channel: 'ai',
    is_default: 1,
    config: { model: 'gpt-4o-mini', temperature: 0.4 },
    secrets: { apiKey: '' },
    notes: 'Personalize Autopilot copy when enabled',
  },
  {
    provider: 'practo',
    label: 'Practo API',
    category: 'Marketplace',
    channel: 'discovery',
    is_default: 1,
    config: { baseUrl: 'https://api.practo.com', environment: 'sandbox', version: 'v1' },
    secrets: { apiKey: '', clientId: '', clientSecret: '' },
    notes: 'Partner API for listing / product sync',
  },
  {
    provider: 'google_maps',
    label: 'Google Maps Places API',
    category: 'Discovery',
    channel: 'discovery',
    is_default: 0,
    config: { region: 'in', language: 'en' },
    secrets: { apiKey: '' },
    notes: 'Enrich clinic discovery with Places data',
  },
  {
    provider: 'justdial',
    label: 'Justdial Partner API',
    category: 'Discovery',
    channel: 'discovery',
    is_default: 0,
    config: { baseUrl: '', cityDefault: 'Bangalore' },
    secrets: { apiKey: '' },
    notes: 'Optional listing enrichment',
  },
  {
    provider: 'webhook_outbound',
    label: 'Outbound Webhooks',
    category: 'Automation',
    channel: 'automation',
    is_default: 1,
    config: { leadCreatedUrl: '', stageChangedUrl: '', campaignRunUrl: '' },
    secrets: { signingSecret: '' },
    notes: 'Push Autopilot / CRM events to your stack',
  },
];

export function personalizeTemplate(template, lead, extras = {}) {
  const first = (lead.name || 'Doctor').split(' ')[0];
  return String(template || '')
    .replaceAll('{{name}}', first)
    .replaceAll('{{full_name}}', lead.name || first)
    .replaceAll('{{company}}', lead.company || 'your clinic')
    .replaceAll('{{phone}}', lead.phone || '')
    .replaceAll('{{email}}', lead.email || '')
    .replaceAll('{{title}}', lead.title || '')
    .replaceAll('{{subject}}', extras.subject || '');
}

export function channelMeta(channel) {
  return CHANNELS[channel] || CHANNELS.whatsapp;
}
