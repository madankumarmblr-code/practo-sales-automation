import {
  loadCommercialInventory,
  getCommercialFilters,
  filterInventory,
} from '../services/commercialInventory.js';
import {
  syncSheetFromGoogle,
  getSheetSyncStatus,
  readCachedSheetCsv,
  SHEET_CSV_URL,
} from '../services/sheetSync.js';
import { reloadLocationsIndex } from '../services/locations.js';

function rowsForSuite(rows) {
  // Shape expected by VV1 Commercial Suite (PapaParse transformHeader names)
  return rows.map((r) => ({
    City: r.city,
    Zone: r.zone,
    Speciality: r.speciality,
    Position: r.position,
    Price_3M: r.price3M,
    Price_6M: r.price6M,
    Price_12M: r.price12M,
    TotalSlots: r.totalSlots,
    AvailableSlots: r.availableSlots,
  }));
}

export function registerCommercialRoutes(app) {
  app.get('/api/sheet/status', (_req, res) => {
    res.json(getSheetSyncStatus());
  });

  app.post('/api/sheet/sync', async (_req, res) => {
    const result = await syncSheetFromGoogle({ force: true });
    reloadLocationsIndex();
    res.status(result.ok ? 200 : 502).json(result);
  });

  app.get('/api/commercial/meta', (_req, res) => {
    const { rows, meta } = loadCommercialInventory();
    const filters = getCommercialFilters(rows);
    res.json({
      rowCount: rows.length,
      sheetUrl: SHEET_CSV_URL,
      sync: meta,
      ...filters,
    });
  });

  app.get('/api/commercial/inventory', (req, res) => {
    const { rows, meta } = loadCommercialInventory();
    const filtered = filterInventory(rows, {
      city: req.query.city,
      zone: req.query.zone,
      speciality: req.query.speciality || req.query.specialty,
      availableOnly: req.query.availableOnly === '1' || req.query.availableOnly === 'true',
    });
    const limit = Math.min(Number(req.query.limit) || filtered.length, 20000);
    res.json({
      sync: meta,
      count: filtered.length,
      rows: rowsForSuite(filtered.slice(0, limit)),
    });
  });

  /** Raw CSV for Commercial Suite PapaParse / download */
  app.get('/api/commercial/inventory.csv', async (req, res) => {
    if (req.query.refresh === '1') {
      await syncSheetFromGoogle({ force: true });
      reloadLocationsIndex();
    }
    let csv = readCachedSheetCsv();
    if (!csv) {
      const result = await syncSheetFromGoogle({ force: true });
      if (!result.ok) {
        return res.status(502).json({ error: result.message || 'Sheet sync failed' });
      }
      csv = readCachedSheetCsv();
    }
    if (!csv) return res.status(404).json({ error: 'Inventory not available yet' });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(csv);
  });

  app.post('/api/commercial/refresh', async (_req, res) => {
    const result = await syncSheetFromGoogle({ force: true });
    reloadLocationsIndex();
    if (!result.ok) return res.status(502).json(result);
    const { rows, meta } = loadCommercialInventory();
    res.json({
      ok: true,
      count: rows.length,
      sync: meta,
      rows: rowsForSuite(rows),
    });
  });
}
