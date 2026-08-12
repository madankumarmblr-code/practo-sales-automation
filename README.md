# Practo Sales Automation

Full-stack sales automation suite for clinic and healthcare outreach.

## Features

- **Permission-level login** — Admin, Manager, Sales Agent, Viewer
- **Dashboard** — pipeline KPIs (starts empty — no demo CRM data)
- **Contacts / Lead Management / Lead Generator**
- **Autopilot AI** — WhatsApp, Gmail, Calls campaigns
- **Lead Settings** — scoring, sources, enrichment
- **API Integrations** — advanced ready-to-use connectors + export
- **Settings** — workspace, users, JSON/CSV export
- **Practo logo** branding

## Quick start

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/health

### Default logins

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@practo.sales` | `Admin@123` |
| Manager | `manager@practo.sales` | `Manager@123` |
| Sales Agent | `agent@practo.sales` | `Agent@123` |
| Viewer | `viewer@practo.sales` | `Viewer@123` |

CRM tables start **empty**. Use Lead Generator or manual entry to add data.

## API Integrations

Configure Practo, WhatsApp Meta, Gmail, Twilio, Google Maps, OpenAI, Justdial, and webhooks under **API Integrations**.  
Export JSON/CSV from that page or **Settings → Export** (secrets are never exported).
