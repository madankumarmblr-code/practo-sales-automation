# Practo Sales Automation

Full-stack sales automation suite for clinic and healthcare outreach.

## Features

- **Super Admin dashboard** — create users, set permission levels, passwords, system health & event logs
- **Simple login** — user ID / email + password (no role picker)
- **Lead Generator** — locations-sheet driven city → zone → keyword discovery
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

## Lead Generator

Uses `backend/data/locations.csv` (city → zone → keyword mappings).
