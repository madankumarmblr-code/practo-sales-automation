# Vercel deploy (UI + API)

## Demo login

| Field | Value |
|-------|--------|
| User ID | `superadmin` |
| Password | `SuperAdmin@123` |

## How deploy works

`vercel.json` does **not** use `outputDirectory` (that mode is static-only and breaks `/api`).

Instead the build:

1. Builds Vite → `frontend/dist`
2. Copies it to `public/` (static CDN)
3. Deploys `api/index.js` as a serverless Express function
4. Rewrites `/api/*` → `/api` and SPA routes → `/index.html`

## Dashboard settings

| Setting | Value |
|---------|--------|
| **Root Directory** | **empty** (repo root — never `backend`) |
| Framework | Other / leave default (`vercel.json` controls build) |

After deploy, open `/api/health` — it must return JSON `{ "ok": true }`, not the HTML app.

## Deploy

```bash
npm i -g vercel
vercel link --project practo-sales-automation-1
vercel build --prod
vercel deploy --prebuilt --prod
```

Or import the GitHub repo at [vercel.com/new](https://vercel.com/new) and set Production Branch to this fullstack branch / `main` after merge.

## Production check (salesmaster.live)

| Check | Expected |
|-------|----------|
| `https://www.salesmaster.live/api/health` | JSON `{ "ok": true, ... }` |
| Login | `superadmin` / `SuperAdmin@123` → Dashboard |
| If `/api/health` returns HTML | API function is missing — redeploy with this branch (Root Directory empty) |

## Notes

- SQLite on Vercel still boots from `/tmp` (ephemeral per instance).
- **Required for Settings / API Integrations to stick:** create a [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) store on the project and set:

  | Name | Value |
  |------|--------|
  | `BLOB_READ_WRITE_TOKEN` | from the Blob store (also auto-injected when you link Blob in the project) |

  After deploy, `/api/health` should show `"durableStore": true`. Saves then snapshot the DB to Blob and restore it on cold starts.
- You can still set `OPENAI_API_KEY` / `GOOGLE_MAPS_API_KEY` / etc. (see `.env.example`) as a backup hydration path.
- First API request after a cold start can be slower (restore + seed + sheet sync).
- Custom domain `salesmaster.live` / `www.salesmaster.live` is on project `practo-sales-automation-1`.
- For fully durable CRM without Blob, host with Docker/VPS (`DATA_DIR` volume) — see HOSTING.md.