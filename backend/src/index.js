import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import './db/db.js';
import './db/seed.js';
import { authRequired } from './auth/middleware.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerLeadRoutes } from './routes/leads.js';
import { registerContactRoutes } from './routes/contacts.js';
import { registerAutopilotRoutes } from './routes/autopilot.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerIntegrationRoutes } from './routes/integrations.js';
import { registerExportRoutes } from './routes/export.js';
import { registerImportRoutes } from './routes/import.js';
import { registerCommercialRoutes } from './routes/commercial.js';
import { logEvent } from './services/logger.js';
import { startSheetAutoSync } from './services/sheetSync.js';
import { reloadLocationsIndex } from './services/locations.js';
import { getFrontendDistDir } from './config.js';
import './services/outreach.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const HOST = process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'practo-sales-api',
    env: isProd ? 'production' : 'development',
    time: new Date().toISOString(),
  });
});

registerAuthRoutes(app);

// Protect all remaining API routes (login is registered above)
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/auth/login') {
    return next();
  }
  return authRequired(req, res, next);
});

// Structured request event logging for authenticated traffic
app.use('/api', (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.path === '/auth/login') return;
    if (req.path.startsWith('/system/events')) return;
    logEvent({
      type: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      category: 'api',
      message: `${req.method} ${req.originalUrl}`,
      detail: `status ${res.statusCode} in ${Date.now() - started}ms`,
      userId: req.user?.id || null,
      meta: { method: req.method, path: req.originalUrl, status: res.statusCode },
    });
  });
  next();
});

registerLeadRoutes(app);
registerContactRoutes(app);
registerAutopilotRoutes(app);
registerSettingsRoutes(app);
registerIntegrationRoutes(app);
registerExportRoutes(app);
registerImportRoutes(app);
registerCommercialRoutes(app);

// Production: serve Vite build (SPA) from the same port as the API
const distDir = getFrontendDistDir();
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { index: false, maxAge: isProd ? '1h' : 0 }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(distDir, 'index.html'), (err) => {
      if (err) next();
    });
  });
  console.log(`Serving frontend from ${distDir}`);
} else if (isProd) {
  console.warn(`Frontend dist not found at ${distDir}. Run: npm run build`);
}

app.use((err, _req, res, _next) => {
  console.error(err);
  logEvent({
    type: 'error',
    category: 'system',
    message: 'Unhandled API error',
    detail: err.message || 'Internal server error',
  });
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, HOST, () => {
  console.log(`Practo Sales listening on http://${HOST}:${PORT}`);
  if (fs.existsSync(distDir)) {
    console.log(`Open http://${HOST}:${PORT} (API + UI)`);
  }
  startSheetAutoSync();
  // Rebuild location index after first sync settles
  setTimeout(() => {
    try {
      reloadLocationsIndex();
    } catch {
      /* ignore */
    }
  }, 5000);
});
