/**
 * Product pitching dialogues & channel templates (Prime / Reach / Video).
 */

export const PRODUCTS = [
  { id: 'prime', label: 'Practo Prime', blurb: 'Assured appointments & premium clinic badge' },
  { id: 'reach', label: 'Practo Reach', blurb: 'Top-slot visibility by city / zone / speciality' },
  { id: 'video', label: 'Video Shoot', blurb: 'Complimentary clinic profile shoot' },
  { id: 'prime_reach', label: 'Prime + Reach', blurb: 'Bundled growth plan' },
  { id: 'full_suite', label: 'Full Enterprise Suite', blurb: 'Prime + Reach + Video' },
];

/** Ready dialogues / templates to follow per channel × product */
export const DIALOGUES = [
  {
    id: 'wa_prime_intro',
    channel: 'whatsapp',
    product: 'prime',
    title: 'WhatsApp — Prime intro',
    subject: '',
    body: `Hi {{name}}, this is Practo Enterprise.
Clinics like {{company}} are using *Practo Prime* for assured appointments, lower wait times, and a premium badge.
Can I share a 2-min overview today?`,
    steps: ['Confirm doctor/owner', 'Pitch Prime value', 'Ask for 2-min share / callback slot'],
  },
  {
    id: 'wa_reach_offer',
    channel: 'whatsapp',
    product: 'reach',
    title: 'WhatsApp — Reach slot offer',
    subject: '',
    body: `Hi {{name}}, quick note from Practo.
We have *Reach* visibility slots open for {{company}}'s speciality in your zone — patients searching Practo see you first.
Shall I send available positions & pricing?`,
    steps: ['Confirm speciality + zone', 'Mention available slots', 'Offer Commercial Suite walkthrough'],
  },
  {
    id: 'wa_bundle',
    channel: 'whatsapp',
    product: 'prime_reach',
    title: 'WhatsApp — Prime + Reach bundle',
    subject: '',
    body: `Hi {{name}}, for {{company}} we recommend *Prime + Reach*:
• Prime → bookings & patient experience
• Reach → discovery in your city/zone
Happy to share a custom proposal from our Commercial Suite.`,
    steps: ['Pitch bundle outcomes', 'Offer proposal PDF', 'Book review call'],
  },
  {
    id: 'gm_prime_nurture',
    channel: 'gmail',
    product: 'prime',
    title: 'Gmail — Prime nurture',
    subject: '{{company}} × Practo Prime — patient experience upgrade',
    body: `Dear {{name}},

I am reaching out from Practo Enterprise about **Practo Prime** for {{company}}.

Prime helps clinics deliver assured appointments, shorter wait times, 24×7 booking, and a premium visibility badge.

Would you be open to a short call this week to review fit and commercials?

Best regards,
Practo Enterprise Team`,
    steps: ['Personalized subject', 'Prime value props', 'CTA for call'],
  },
  {
    id: 'gm_reach_proposal',
    channel: 'gmail',
    product: 'reach',
    title: 'Gmail — Reach proposal invite',
    subject: 'Reach slots for {{company}} — Practo visibility',
    body: `Dear {{name}},

**Practo Reach** places {{company}} in top search positions for your speciality and locality, driving discovery and footfall.

I can share live inventory (city → zone → speciality → position) and a commercial proposal.

May I send options today?

Warm regards,
Practo Enterprise`,
    steps: ['Mention live inventory', 'Invite proposal', 'Soft CTA'],
  },
  {
    id: 'gm_full_suite',
    channel: 'gmail',
    product: 'full_suite',
    title: 'Gmail — Full suite pitch',
    subject: 'Prime + Reach + Video for {{company}}',
    body: `Dear {{name}},

Sharing a full Practo Enterprise plan for {{company}}:
1. **Prime** — appointments & experience
2. **Reach** — top-slot discovery
3. **Video shoot** — complimentary clinic profile content

I can prepare a custom Commercial Suite proposal (with GST/TDS) for your review.

Best,
Practo Enterprise`,
    steps: ['List three products', 'Offer Commercial Suite PDF', 'Ask for preferred term 3/6/12M'],
  },
  {
    id: 'call_prime_qualify',
    channel: 'calls',
    product: 'prime',
    title: 'Call script — Prime qualify',
    subject: '',
    body: `OPEN: Hi, am I speaking with {{name}} at {{company}}?
PITCH: Calling from Practo Enterprise about Practo Prime — assured appointments, less wait, premium badge.
PROBE: Who handles marketing / growth decisions?
ASK: Can we schedule a 15-min Commercial Suite walkthrough this week?
CLOSE: Confirm callback time; note objections.`,
    steps: ['Verify identity', 'Prime pitch (30s)', 'Find decision maker', 'Book follow-up'],
  },
  {
    id: 'call_reach_inventory',
    channel: 'calls',
    product: 'reach',
    title: 'Call script — Reach inventory',
    subject: '',
    body: `OPEN: Hi {{name}}, Practo Enterprise — calling about Reach visibility for {{company}}.
PITCH: Top placement when patients search your speciality in your zone.
PROBE: Confirm city, zone, speciality preference.
ASK: Share available positions & pricing on WhatsApp/email now?
CLOSE: Send Commercial Suite proposal; set decision date.`,
    steps: ['Confirm geo + speciality', 'Pitch Reach', 'Offer live slots', 'Send proposal'],
  },
  {
    id: 'call_bundle_close',
    channel: 'calls',
    product: 'prime_reach',
    title: 'Call script — Bundle close',
    subject: '',
    body: `OPEN: Following up with {{name}} / {{company}} on Prime + Reach.
RECAP: Discovery (Reach) + conversion experience (Prime).
HANDLE: Price → offer 3/6/12M terms; competition → Practo traffic proof.
ASK: Shall I issue proforma / proposal today?
NEXT: Confirm signer, GSTIN, preferred start date.`,
    steps: ['Recap bundle', 'Handle objections', 'Push proposal/proforma', 'Capture GSTIN'],
  },
  {
    id: 'wa_self_test',
    channel: 'whatsapp',
    product: 'prime',
    title: 'Self-test WhatsApp ping',
    subject: '',
    body: `Practo Sales Autopilot TEST ✅
Integration connected. Product: {{product}}.
If you received this on your number, WhatsApp test succeeded.`,
    steps: ['Send to own number', 'Confirm delivery in records'],
  },
  {
    id: 'gm_self_test',
    channel: 'gmail',
    product: 'prime',
    title: 'Self-test Gmail ping',
    subject: 'Practo Autopilot integration self-test',
    body: `This is a Practo Sales Autopilot self-test email for product {{product}}.
If you received this, your email integration test path is working.`,
    steps: ['Send to own inbox', 'Confirm in mail records'],
  },
  {
    id: 'call_self_test',
    channel: 'calls',
    product: 'prime',
    title: 'Self-test call script',
    subject: '',
    body: `TEST CALL SCRIPT — dial your own number.
Announce: "Practo Autopilot test call for {{product}}. Hang up after confirmation."
Log outcome in Call records.`,
    steps: ['Dial own number', 'Announce test', 'Log record'],
  },
];

export function getDialogue(id) {
  return DIALOGUES.find((d) => d.id === id) || null;
}

export function dialoguesFor(channel, product) {
  return DIALOGUES.filter(
    (d) =>
      (!channel || d.channel === channel) &&
      (!product || product === 'all' || d.product === product || d.id.includes('self_test'))
  );
}

export function productLabel(id) {
  return PRODUCTS.find((p) => p.id === id)?.label || id || '—';
}
