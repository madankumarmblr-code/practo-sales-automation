# Cloudflare Workers — static UI deploy

This monorepo deploys the **Vite frontend** to Cloudflare as static assets.
The Express + SQLite API does **not** run on Cloudflare.

## Dashboard settings (copy exactly)

| Setting | Value |
|---------|--------|
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | *(leave empty / repo root)* |
| Non-production deploy *(optional)* | `npx wrangler versions upload` |

These match Cloudflare Workers Builds defaults. Root `wrangler.toml` points assets at `frontend/dist` and enables SPA routing — that is what fixes the previous monorepo “workspace root” deploy error.

## One-command local deploy

```bash
npm install
npx wrangler login   # once
npm run deploy:cf
```

Validate without uploading:

```bash
npm run cf:check
```

## API (required for a working app)

Host the API on Docker/VPS, then rebuild the UI with:

```bash
VITE_API_BASE=https://api.yourdomain.com npm run build
npx wrangler deploy
```

Set `CORS_ORIGIN` on the API to your Workers URL.

For API + UI on one host, use Docker instead (`docker compose up -d --build`).
