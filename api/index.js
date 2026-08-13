/**
 * Vercel serverless Express entry.
 * All /api/* requests are rewritten here (see vercel.json).
 *
 * Restores the durable SQLite snapshot into /tmp before opening the DB so
 * Settings / API Integrations / CRM data survive cold starts.
 */
let appPromise;

async function loadApp() {
  if (!process.env.DATA_DIR) {
    process.env.DATA_DIR = '/tmp/practo-sales-data';
  }
  if (!appPromise) {
    appPromise = (async () => {
      const { restoreDurableDb } = await import('../backend/src/services/dbSnapshot.js');
      await restoreDurableDb();
      const mod = await import('../backend/src/app.js');
      return mod.createApp({ serveStatic: false, warmSheet: true });
    })();
  }
  return appPromise;
}

export default async function handler(req, res) {
  const app = await loadApp();
  return app(req, res);
}
