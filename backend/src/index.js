import express from 'express';
import cors from 'cors';
import './db/db.js';
import './db/seed.js';
import { authRequired } from './auth/middleware.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerContactRoutes } from './routes/contacts.js';
import { registerLeadRoutes } from './routes/leads.js';
import { registerAutopilotRoutes } from './routes/autopilot.js';
import { registerSettingsRoutes } from './routes/settings.js';
import { registerIntegrationRoutes } from './routes/integrations.js';
import { registerExportRoutes } from './routes/export.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'practo-sales-api', time: new Date().toISOString() });
});

registerAuthRoutes(app);

// Protect all remaining API routes
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/login') || req.path.startsWith('/auth/roles') || req.path === '/health') {
    return next();
  }
  return authRequired(req, res, next);
});

registerContactRoutes(app);
registerLeadRoutes(app);
registerAutopilotRoutes(app);
registerSettingsRoutes(app);
registerIntegrationRoutes(app);
registerExportRoutes(app);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Practo Sales API listening on http://0.0.0.0:${PORT}`);
});
