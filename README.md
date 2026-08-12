# Practo Sales Automation

Full-stack sales automation suite for clinic and healthcare outreach — **ready to host on one port**.

## Features

- **Super Admin** — users, permissions, system health & logs
- **Lead Generator** — Google Sheet auto-sync (city → zone → speciality)
- **Commercial Suite** — Prime / Reach / Video proposals
- **Autopilot AI** — separate WhatsApp, Gmail, Calls pilots + records & dialogues
- **API Integrations** — multi-provider connectors with self-test

## Local development

```bash
npm install
npm run dev
```

- Web: http://localhost:5173  
- API: http://localhost:4000/api/health  

## Host (production)

### Fastest — Docker

```bash
docker compose up -d --build
```

Open **http://localhost:8080**

### Node (VPS)

```bash
npm install
npm run build
NODE_ENV=production PORT=8080 npm start
```

Full steps, Nginx, env vars, and systemd: see **[HOSTING.md](./HOSTING.md)**.

### Super Admin login

| Field | Value |
|------|-------|
| User ID | `superadmin` |
| Email | `superadmin@practo.sales` |
| Password | `SuperAdmin@123` |

Change this password after go-live and create users in **Super Admin**.

## Inventory source (Google Sheet)

Auto-syncs every 15 minutes from the published CSV:

`https://docs.google.com/spreadsheets/d/e/2PACX-1vQTl9Yrc0MVODAlLUTrHvOCJZxrm7bpEMV3xAX1d3UYiXQIeGySyOe8t1Jk8evBTQg2rSeC8akfGfxr/pub?gid=305008958&single=true&output=csv`
