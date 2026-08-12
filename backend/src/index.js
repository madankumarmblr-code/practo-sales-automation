import express from 'express';
import cors from 'cors';
import './db/db.js';
import './db/seed.js';
import { authRequired } from './auth/middleware.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerLeadRoutes } from './routes/leads.js';
import { registerAutopilotRoutes } from './routes/autopilot.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerIntegrationRoutes } from './routes/integrations.js';
import { registerExportRoutes } from './routes/export.js';
import { registerCommercialRoutes } from './routes/commercial.js';
import { logEvent } from './services/logger.js';
import { startSheetAutoSync } from './services/sheetSync.js';
import { reloadLocationsIndex } from './services/locations.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'practo-sales-api', time: new Date().toISOString() });
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
registerAutopilotRoutes(app);
registerSettingsRoutes(app);
registerIntegrationRoutes(app);
registerExportRoutes(app);
registerCommercialRoutes(app);

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Practo Sales API listening on http://0.0.0.0:${PORT}`);
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
