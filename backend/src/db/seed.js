import { nanoid } from 'nanoid';
import db from './db.js';

const now = () => new Date().toISOString();

function seed() {
  const leadCount = db.prepare('SELECT COUNT(*) as c FROM leads').get().c;
  if (leadCount > 0) {
    console.log('Database already seeded');
    return;
  }

  const stages = [
    { name: 'New', slug: 'new', color: '#5B8DEF', position: 0 },
    { name: 'Contacted', slug: 'contacted', color: '#1DB8A0', position: 1 },
    { name: 'Qualified', slug: 'qualified', color: '#E8A838', position: 2 },
    { name: 'Proposal', slug: 'proposal', color: '#C45C26', position: 3 },
    { name: 'Won', slug: 'won', color: '#2F9E44', position: 4 },
    { name: 'Lost', slug: 'lost', color: '#868E96', position: 5 },
  ];

  const insertStage = db.prepare(
    'INSERT INTO pipeline_stages (id, name, slug, color, position) VALUES (?, ?, ?, ?, ?)'
  );
  for (const s of stages) {
    insertStage.run(nanoid(), s.name, s.slug, s.color, s.position);
  }

  const sources = [
    { name: 'Website', weight: 80 },
    { name: 'LinkedIn', weight: 70 },
    { name: 'Referral', weight: 90 },
    { name: 'WhatsApp Campaign', weight: 60 },
    { name: 'Gmail Outreach', weight: 55 },
    { name: 'Cold Call', weight: 40 },
    { name: 'Clinic Directory', weight: 75 },
    { name: 'Event', weight: 65 },
  ];
  const insertSource = db.prepare(
    'INSERT INTO lead_sources (id, name, enabled, weight) VALUES (?, ?, 1, ?)'
  );
  for (const s of sources) {
    insertSource.run(nanoid(), s.name, s.weight);
  }

  const contacts = [
    {
      name: 'Dr. Ananya Reddy',
      email: 'ananya.reddy@careplus.clinic',
      phone: '+91 98765 43210',
      company: 'CarePlus Clinic',
      title: 'Medical Director',
      tags: ['decision-maker', 'multi-specialty'],
      notes: 'Interested in patient booking automation.',
    },
    {
      name: 'Rahul Mehta',
      email: 'rahul@urbanhealth.in',
      phone: '+91 98111 22334',
      company: 'Urban Health Group',
      title: 'Operations Head',
      tags: ['chain', 'ops'],
      notes: 'Managing 12 clinics across Bangalore.',
    },
    {
      name: 'Priya Nair',
      email: 'priya.nair@smilecraft.com',
      phone: '+91 99000 11223',
      company: 'SmileCraft Dental',
      title: 'Founder',
      tags: ['dental', 'founder'],
      notes: 'Wants WhatsApp appointment reminders.',
    },
    {
      name: 'Vikram Singh',
      email: 'vikram@apexlabs.co',
      phone: '+91 97654 32109',
      company: 'Apex Diagnostics',
      title: 'Growth Lead',
      tags: 'diagnostics',
      notes: 'Evaluating lead scoring for lab referrals.',
    },
    {
      name: 'Sneha Kapoor',
      email: 'sneha@wellnest.care',
      phone: '+91 91234 56789',
      company: 'WellNest Care',
      title: 'Clinic Manager',
      tags: ['wellness'],
      notes: 'Prefers Gmail follow-ups over calls.',
    },
    {
      name: 'Arjun Desai',
      email: 'arjun@metrohospitals.in',
      phone: '+91 99887 76655',
      company: 'Metro Hospitals',
      title: 'VP Sales Partnerships',
      tags: ['hospital', 'enterprise'],
      notes: 'Enterprise deal — needs multi-location rollout.',
    },
  ];

  const insertContact = db.prepare(`
    INSERT INTO contacts (id, name, email, phone, company, title, tags, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const contactIds = [];
  for (const c of contacts) {
    const id = nanoid();
    contactIds.push(id);
    const tags = Array.isArray(c.tags) ? c.tags : [c.tags];
    const ts = now();
    insertContact.run(
      id,
      c.name,
      c.email,
      c.phone,
      c.company,
      c.title,
      JSON.stringify(tags),
      c.notes,
      ts,
      ts
    );
  }

  const leads = [
    {
      name: 'Dr. Ananya Reddy',
      email: 'ananya.reddy@careplus.clinic',
      phone: '+91 98765 43210',
      company: 'CarePlus Clinic',
      title: 'Medical Director',
      source: 'Referral',
      stage: 'proposal',
      score: 92,
      value: 240000,
      assigned_to: 'Aisha Khan',
      next_action: 'Send proposal deck',
      notes: 'Ready for demo of booking + WhatsApp suite.',
    },
    {
      name: 'Rahul Mehta',
      email: 'rahul@urbanhealth.in',
      phone: '+91 98111 22334',
      company: 'Urban Health Group',
      title: 'Operations Head',
      source: 'LinkedIn',
      stage: 'qualified',
      score: 81,
      value: 520000,
      assigned_to: 'Aisha Khan',
      next_action: 'Schedule discovery call',
      notes: 'Multi-clinic expansion opportunity.',
    },
    {
      name: 'Priya Nair',
      email: 'priya.nair@smilecraft.com',
      phone: '+91 99000 11223',
      company: 'SmileCraft Dental',
      title: 'Founder',
      source: 'WhatsApp Campaign',
      stage: 'contacted',
      score: 68,
      value: 85000,
      assigned_to: 'Dev Patel',
      next_action: 'Follow up on WhatsApp thread',
      notes: 'Responded positively to reminder demo.',
    },
    {
      name: 'Vikram Singh',
      email: 'vikram@apexlabs.co',
      phone: '+91 97654 32109',
      company: 'Apex Diagnostics',
      title: 'Growth Lead',
      source: 'Website',
      stage: 'new',
      score: 55,
      value: 120000,
      assigned_to: 'Unassigned',
      next_action: 'Initial outreach via Gmail',
      notes: 'Downloaded lead gen whitepaper.',
    },
    {
      name: 'Sneha Kapoor',
      email: 'sneha@wellnest.care',
      phone: '+91 91234 56789',
      company: 'WellNest Care',
      title: 'Clinic Manager',
      source: 'Gmail Outreach',
      stage: 'contacted',
      score: 61,
      value: 64000,
      assigned_to: 'Dev Patel',
      next_action: 'Send case study',
      notes: 'Opened 3 emails this week.',
    },
    {
      name: 'Arjun Desai',
      email: 'arjun@metrohospitals.in',
      phone: '+91 99887 76655',
      company: 'Metro Hospitals',
      title: 'VP Sales Partnerships',
      source: 'Event',
      stage: 'qualified',
      score: 88,
      value: 980000,
      assigned_to: 'Aisha Khan',
      next_action: 'Executive briefing',
      notes: 'Met at HealthTech Summit.',
    },
    {
      name: 'Meera Iyer',
      email: 'meera@lotusent.com',
      phone: '+91 93456 77889',
      company: 'Lotus ENT Center',
      title: 'Practice Owner',
      source: 'Clinic Directory',
      stage: 'new',
      score: 48,
      value: 45000,
      assigned_to: 'Unassigned',
      next_action: 'Cold WhatsApp intro',
      notes: 'Single location ENT practice.',
    },
    {
      name: 'Karan Malhotra',
      email: 'karan@pulsephysio.in',
      phone: '+91 94567 88990',
      company: 'Pulse Physio',
      title: 'Co-founder',
      source: 'Cold Call',
      stage: 'lost',
      score: 32,
      value: 30000,
      status: 'closed',
      assigned_to: 'Dev Patel',
      next_action: 'Re-engage in Q4',
      notes: 'Budget freeze until next quarter.',
    },
    {
      name: 'Nisha Verma',
      email: 'nisha@brightkids.clinic',
      phone: '+91 95678 99001',
      company: 'Bright Kids Pediatric',
      title: 'Clinic Admin',
      source: 'Website',
      stage: 'won',
      score: 95,
      value: 156000,
      status: 'closed',
      assigned_to: 'Aisha Khan',
      next_action: 'Onboarding kickoff',
      notes: 'Signed annual plan.',
    },
    {
      name: 'Omar Farooq',
      email: 'omar@cityskin.derm',
      phone: '+91 96789 00112',
      company: 'CitySkin Dermatology',
      title: 'Marketing Lead',
      source: 'LinkedIn',
      stage: 'proposal',
      score: 74,
      value: 110000,
      assigned_to: 'Dev Patel',
      next_action: 'Revise pricing proposal',
      notes: 'Comparing with competitor Autopilot suite.',
    },
  ];

  const insertLead = db.prepare(`
    INSERT INTO leads (
      id, name, email, phone, company, title, source, stage, score, value,
      status, assigned_to, last_contacted_at, next_action, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const leadIds = [];
  for (const l of leads) {
    const id = nanoid();
    leadIds.push(id);
    const ts = now();
    const contacted =
      l.stage === 'new' ? null : new Date(Date.now() - Math.random() * 5 * 86400000).toISOString();
    insertLead.run(
      id,
      l.name,
      l.email,
      l.phone,
      l.company,
      l.title,
      l.source,
      l.stage,
      l.score,
      l.value,
      l.status || 'open',
      l.assigned_to,
      contacted,
      l.next_action,
      l.notes,
      ts,
      ts
    );
  }

  const activities = [
    {
      lead_id: leadIds[0],
      type: 'email',
      channel: 'gmail',
      title: 'Proposal emailed',
      detail: 'Sent booking automation proposal with pricing tiers.',
      status: 'completed',
    },
    {
      lead_id: leadIds[1],
      type: 'call',
      channel: 'calls',
      title: 'Discovery call completed',
      detail: 'Discussed multi-clinic rollout and integrations.',
      status: 'completed',
    },
    {
      lead_id: leadIds[2],
      type: 'whatsapp',
      channel: 'whatsapp',
      title: 'WhatsApp reminder demo shared',
      detail: 'Shared sample patient reminder templates.',
      status: 'completed',
    },
    {
      lead_id: leadIds[3],
      type: 'email',
      channel: 'gmail',
      title: 'Autopilot intro queued',
      detail: 'Gmail sequence day 1 ready to send.',
      status: 'pending',
    },
    {
      lead_id: leadIds[5],
      type: 'meeting',
      channel: 'calls',
      title: 'Summit follow-up booked',
      detail: 'Executive briefing scheduled for Friday.',
      status: 'scheduled',
    },
    {
      lead_id: leadIds[4],
      type: 'email',
      channel: 'gmail',
      title: 'Case study opened',
      detail: 'WellNest opened pediatric clinic case study.',
      status: 'completed',
    },
    {
      lead_id: leadIds[8],
      type: 'deal',
      channel: 'system',
      title: 'Deal marked won',
      detail: 'Bright Kids Pediatric signed annual plan.',
      status: 'completed',
    },
    {
      lead_id: leadIds[6],
      type: 'whatsapp',
      channel: 'whatsapp',
      title: 'Cold intro drafted',
      detail: 'AI drafted personalized WhatsApp intro for Lotus ENT.',
      status: 'pending',
    },
  ];

  const insertActivity = db.prepare(`
    INSERT INTO activities (id, lead_id, contact_id, type, channel, title, detail, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const a of activities) {
    insertActivity.run(
      nanoid(),
      a.lead_id,
      null,
      a.type,
      a.channel,
      a.title,
      a.detail,
      a.status,
      new Date(Date.now() - Math.random() * 3 * 86400000).toISOString()
    );
  }

  const campaigns = [
    {
      name: 'Clinic WhatsApp Warm Intro',
      channel: 'whatsapp',
      status: 'active',
      goal: 'Book discovery demos with clinic owners',
      message_template:
        'Hi {{name}}, I noticed {{company}} is growing fast. We help clinics automate patient outreach on WhatsApp — open to a 10-min look?',
      daily_limit: 80,
      sent_today: 34,
      success_rate: 18.5,
    },
    {
      name: 'Gmail Re-engagement Sequence',
      channel: 'gmail',
      status: 'active',
      goal: 'Reactivate cold leads with value-led emails',
      message_template:
        'Subject: Quick idea for {{company}}\n\nHi {{name}}, clinics like yours cut no-shows by 30% with automated reminders. Worth a peek?',
      daily_limit: 120,
      sent_today: 67,
      success_rate: 12.2,
    },
    {
      name: 'AI Call Qualifier',
      channel: 'calls',
      status: 'paused',
      goal: 'Qualify inbound website leads via AI-assisted calls',
      message_template:
        'Script: Confirm practice size, current booking tools, and interest in Autopilot.',
      daily_limit: 40,
      sent_today: 0,
      success_rate: 22.0,
    },
  ];

  const insertCampaign = db.prepare(`
    INSERT INTO autopilot_campaigns (
      id, name, channel, status, goal, message_template, daily_limit, sent_today, success_rate, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of campaigns) {
    const ts = now();
    insertCampaign.run(
      nanoid(),
      c.name,
      c.channel,
      c.status,
      c.goal,
      c.message_template,
      c.daily_limit,
      c.sent_today,
      c.success_rate,
      ts,
      ts
    );
  }

  const leadSettings = {
    scoring_rules: JSON.stringify({
      emailOpened: 5,
      whatsappReplied: 15,
      callCompleted: 20,
      demoBooked: 30,
      companySizeBonus: 10,
      sourceWeights: true,
    }),
    auto_assign: JSON.stringify({
      enabled: true,
      strategy: 'round_robin',
      agents: ['Aisha Khan', 'Dev Patel'],
    }),
    enrichment: JSON.stringify({
      enabled: true,
      pullCompanyData: true,
      suggestScore: true,
    }),
    notifications: JSON.stringify({
      hotLeadAlert: true,
      dailyDigest: true,
      stageChange: true,
    }),
  };

  const upsertLeadSetting = db.prepare(
    'INSERT OR REPLACE INTO lead_settings (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of Object.entries(leadSettings)) {
    upsertLeadSetting.run(k, v);
  }

  const appSettings = {
    profile: JSON.stringify({
      orgName: 'Practo Sales',
      workspace: 'India Growth',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    }),
    integrations: JSON.stringify({
      whatsapp: { connected: true, businessNumber: '+91 80 4567 8900', provider: 'Meta Cloud API' },
      gmail: { connected: true, account: 'outreach@practo-sales.demo', dailyQuota: 500 },
      calls: { connected: false, provider: 'Twilio', number: '' },
    }),
    ai: JSON.stringify({
      model: 'gpt-sales-assist',
      tone: 'professional-warm',
      personalizeWithCompany: true,
      autoFollowUpHours: 48,
    }),
    notifications: JSON.stringify({
      email: true,
      inApp: true,
      slackWebhook: '',
    }),
  };

  const upsertAppSetting = db.prepare(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)'
  );
  for (const [k, v] of Object.entries(appSettings)) {
    upsertAppSetting.run(k, v);
  }

  console.log('Seeded database with sample sales data');
}

seed();
