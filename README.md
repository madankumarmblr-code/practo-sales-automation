# Practo Sales Automation

Full-stack sales automation suite for clinic and healthcare outreach.

## Features

- **Super Admin dashboard** — create users, set permission levels, passwords, system health & event logs
- **Simple login** — user ID / email + password (no role picker)
- **Lead Generator** — Google Sheet auto-sync (city → zone → speciality) discovery
- **Commercial Suite** — VV1 proposal engine (Prime / Reach / Video) with live sheet inventory
- **Lead Management / Autopilot / Lead Settings / API Integrations / Settings**
- **Practo logo** branding

## Quick start

```bash
npm install
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/health

### Super Admin login

| Field | Value |
|------|-------|
| User ID | `superadmin` |
| Email | `superadmin@practo.sales` |
| Password | `SuperAdmin@123` |

Use **Super Admin** to create other users and assign roles/permissions. Those users then sign in with the credentials you set.

## Inventory source (Google Sheet)

Auto-syncs every 15 minutes from the published CSV (no manual CSV upload):

`https://docs.google.com/spreadsheets/d/e/2PACX-1vQTl9Yrc0MVODAlLUTrHvOCJZxrm7bpEMV3xAX1d3UYiXQIeGySyOe8t1Jk8evBTQg2rSeC8akfGfxr/pub?gid=305008958&single=true&output=csv`

Cached under `backend/data/locations-sheet.csv`. Manual refresh: `POST /api/sheet/sync`.
