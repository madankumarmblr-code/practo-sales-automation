# Hosting guide — Practo Sales Automation

One process serves **API + UI** on a single port after `npm run build`.

## Option A — Docker (recommended)

```bash
docker compose up -d --build
```

Open **http://localhost:8080**

- Health: `http://localhost:8080/api/health`
- Data volume: `practo_sales_data` (SQLite + sheet cache)
- Stop: `docker compose down`

### Custom port

```bash
PORT=3000 docker compose up -d --build
```

(`PORT` maps host → container `8080`.)

## Option B — Node on a VPS

Requirements: **Node 20+**, build tools for `better-sqlite3` (`python3`, `make`, `g++` on Linux).

```bash
git clone <your-repo>
cd practo-sales-automation
npm install
npm run build
NODE_ENV=production PORT=8080 DATA_DIR=./data npm start
```

Open **http://YOUR_SERVER:8080**

### systemd example

```ini
[Unit]
Description=Practo Sales Automation
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/practo-sales-automation
Environment=NODE_ENV=production
Environment=PORT=8080
Environment=DATA_DIR=/var/lib/practo-sales
ExecStart=/usr/bin/node backend/src/index.js
Restart=always
User=www-data

[Install]
WantedBy=multi-user.target
```

## Option C — Behind Nginx reverse proxy

```nginx
server {
  listen 80;
  server_name sales.yourdomain.com;

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 5m;
  }
}
```

Then terminate TLS with Certbot / your load balancer.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `4000` (dev) / `8080` (Docker) | Listen port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | — | Set `production` when hosting |
| `DATA_DIR` | `backend/data` | SQLite + CSV cache (use a volume) |
| `SHEET_CSV_URL` | Practo published sheet | Inventory / lead generator source |
| `SHEET_SYNC_MINUTES` | `15` | Auto-sync interval |
| `CORS_ORIGIN` | `true` | CORS policy |
| `FRONTEND_DIST` | `frontend/dist` | Built UI path |

Copy `.env.example` → `.env` if you want local overrides (Docker Compose reads `PORT` / `SHEET_*` from the shell or `.env`).

## Default login (change after first login)

| Field | Value |
|-------|--------|
| User ID | `superadmin` |
| Password | `SuperAdmin@123` |

Create real users under **Super Admin** and rotate this password in production.

## Checklist before go-live

1. `npm run build` succeeds (or `docker compose build`)
2. `/api/health` returns `{ ok: true }`
3. Persist `DATA_DIR` / Docker volume so the DB survives restarts
4. On **Vercel**, also set `BLOB_READ_WRITE_TOKEN` so Settings / API Integrations survive cold starts (`durableStore: true` on `/api/health`)
5. Point DNS + HTTPS at the host
6. Add live WhatsApp / Gmail / Calls API credentials under **API Integrations**
7. Confirm Google Sheet still publishes as CSV

## Architecture (hosted)

```
Browser ──► :8080 ──► Express
                        ├─ /api/*     JSON API + SQLite
                        └─ /*         React SPA (frontend/dist)
```

## Option D — Vercel (UI + API)

See **[VERCEL.md](./VERCEL.md)**.

Import the repo with **Root Directory empty**. After deploy, `/api/health` must return JSON.

Demo login: `superadmin` / `SuperAdmin@123`

SQLite on Vercel uses `/tmp` (ephemeral). Prefer Docker (Option A) for durable data.
