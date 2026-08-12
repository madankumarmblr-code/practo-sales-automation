# Practo Sales Automation

Full-stack sales automation suite for clinic and healthcare outreach.

## Features

- **Dashboard** — pipeline KPIs, hot leads, recent activity
- **Contacts** — CRM contacts with search and CRUD
- **Lead Generator** — AI-style prospect discovery and import
- **Lead Management** — board + table views, stage moves, scoring
- **Autopilot AI** — WhatsApp, Gmail, and Calls campaigns with run-now simulation
- **Lead Settings** — scoring rules, sources, enrichment, auto-assign
- **Settings** — workspace profile, integrations, AI tone, notifications

## Stack

- **Frontend:** React + Vite
- **Backend:** Express + better-sqlite3
- **Data:** SQLite with demo seed data

## Quick start

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/health

## Scripts

| Command | Description |
|--------|-------------|
| `npm run dev` | Start API + web together |
| `npm run seed` | Re-seed database (noop if already seeded) |
| `npm run build` | Build frontend (and backend pass-through) |

## API overview

- `GET /api/dashboard`
- `GET/POST/PUT/DELETE /api/contacts`
- `GET/POST/PUT/DELETE /api/leads`
- `POST /api/lead-generator/search`
- `POST /api/lead-generator/import`
- `GET/POST/PUT /api/autopilot/campaigns`
- `POST /api/autopilot/campaigns/:id/run`
- `GET/PUT /api/lead-settings`
- `GET/PUT /api/settings`
