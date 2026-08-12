# Vercel — static UI deploy

Deploys the **Vite React frontend** to Vercel. Express + SQLite does **not** run on Vercel — host the API with Docker/VPS (see HOSTING.md).

## One-click / Git deploy

1. Import the GitHub repo in [Vercel](https://vercel.com/new)
2. Leave **Root Directory** empty (repo root)
3. Vercel reads `vercel.json` automatically:

| Setting | Value |
|---------|--------|
| Install | `npm install --ignore-scripts && node node_modules/esbuild/install.js` |
| Build | `npm run build` |
| Output | `frontend/dist` |

4. Deploy

SPA routes (`/login`, `/leads`, …) are covered by the rewrite to `index.html`.

## Optional: point UI at a hosted API

In Vercel → Project → Settings → Environment Variables:

| Name | Value |
|------|--------|
| `VITE_API_BASE` | `https://api.yourdomain.com` |

Redeploy after saving. On the API host set `CORS_ORIGIN` to your Vercel URL (e.g. `https://practo-sales-automation.vercel.app`).

## Local preview of the production build

```bash
npm install
npm run build
npx serve frontend/dist
```

## Full app (API + UI)

Use Docker on a VPS instead of Vercel:

```bash
docker compose up -d --build
```
