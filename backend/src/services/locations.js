import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, '../../data/locations.csv');

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitCsvLine(lines[i]);
    if (!cols.length) continue;
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] || '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function field(row, ...names) {
  for (const name of names) {
    if (row[name] != null && String(row[name]).trim()) return String(row[name]).trim();
  }
  // fuzzy header match
  const keys = Object.keys(row);
  for (const name of names) {
    const hit = keys.find((k) => k.toLowerCase().startsWith(name.toLowerCase()));
    if (hit && String(row[hit]).trim()) return String(row[hit]).trim();
  }
  return '';
}

function loadLocationIndex() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`Locations sheet not found at ${CSV_PATH}`);
  }
  const raw = parseCsv(fs.readFileSync(CSV_PATH, 'utf8'));
  const combos = new Map(); // key -> { city, zone, zoneType, keyword, frequency }
  const citiesSet = new Set();
  const zonesByCity = new Map(); // city -> Map(zone -> zoneType)
  const keywordsByCityZone = new Map(); // `${city}||${zone}` -> Set(keyword)
  const keywordsByCity = new Map();

  for (const row of raw) {
    const city = field(row, 'city::multi-filter', 'city');
    const zone = field(row, 'zone');
    const zoneType = field(row, 'zone type::multi-filter', 'zone type') || 'ZONE';
    const keyword = field(row, 'keyword::multi-filter', 'keyword');
    if (!city || !zone || !keyword) continue;

    citiesSet.add(city);
    if (!zonesByCity.has(city)) zonesByCity.set(city, new Map());
    zonesByCity.get(city).set(zone, zoneType);

    const ck = `${city}||${zone}`;
    if (!keywordsByCityZone.has(ck)) keywordsByCityZone.set(ck, new Set());
    keywordsByCityZone.get(ck).add(keyword);

    if (!keywordsByCity.has(city)) keywordsByCity.set(city, new Set());
    keywordsByCity.get(city).add(keyword);

    const key = `${city}||${zone}||${keyword}`;
    const existing = combos.get(key);
    if (existing) existing.frequency += 1;
    else combos.set(key, { city, zone, zoneType, keyword, frequency: 1 });
  }

  const cities = [...citiesSet].sort((a, b) => a.localeCompare(b));

  const zonesByCityObj = {};
  const zoneMetaByCity = {};
  for (const city of cities) {
    const zmap = zonesByCity.get(city);
    const zones = [...zmap.keys()].sort((a, b) => {
      const ta = zmap.get(a);
      const tb = zmap.get(b);
      // SUPERZONE / Cityinventory first, then alpha
      if (ta !== tb) return ta === 'SUPERZONE' ? -1 : 1;
      return a.localeCompare(b);
    });
    zonesByCityObj[city] = zones;
    zoneMetaByCity[city] = Object.fromEntries(
      zones.map((z) => [z, { type: zmap.get(z), isCityInventory: /cityinventory/i.test(z) }])
    );
  }

  const keywordsByCityZoneObj = {};
  for (const [ck, set] of keywordsByCityZone.entries()) {
    keywordsByCityZoneObj[ck] = [...set].sort((a, b) => a.localeCompare(b));
  }

  const keywordsByCityObj = {};
  for (const [city, set] of keywordsByCity.entries()) {
    keywordsByCityObj[city] = [...set].sort((a, b) => a.localeCompare(b));
  }

  const allKeywords = [...new Set([...combos.values()].map((c) => c.keyword))].sort((a, b) =>
    a.localeCompare(b)
  );

  return {
    cities,
    zonesByCity: zonesByCityObj,
    zoneMetaByCity,
    keywordsByCityZone: keywordsByCityZoneObj,
    keywordsByCity: keywordsByCityObj,
    allKeywords,
    combos,
    comboCount: combos.size,
    rowCount: raw.length,
  };
}

let INDEX = null;

export function getLocationIndex() {
  if (!INDEX) INDEX = loadLocationIndex();
  return INDEX;
}

export function reloadLocationIndex() {
  INDEX = loadLocationIndex();
  return INDEX;
}

export function listKeywordsFor(city, zone) {
  const idx = getLocationIndex();
  if (!city) return idx.allKeywords;
  if (!zone || zone === 'All' || zone === 'All zones') {
    return idx.keywordsByCity[city] || [];
  }
  return idx.keywordsByCityZone[`${city}||${zone}`] || [];
}

export function listZonesFor(city, keyword) {
  const idx = getLocationIndex();
  if (!city) return [];
  const zones = idx.zonesByCity[city] || [];
  if (!keyword || keyword === 'All') return zones;
  return zones.filter((z) => (idx.keywordsByCityZone[`${city}||${z}`] || []).includes(keyword));
}

export function resolveDiscoveryTargets({ city, zone, keyword }) {
  const idx = getLocationIndex();
  if (!city || !idx.cities.includes(city)) {
    return { error: `City not found in locations sheet: ${city}`, targets: [] };
  }
  if (!keyword) {
    return { error: 'Keyword / specialty is required', targets: [] };
  }

  let zones = [];
  if (!zone || zone === 'All' || zone === 'All zones') {
    // All locality ZONEs that have this keyword (skip Cityinventory superzone duplicates)
    zones = (idx.zonesByCity[city] || []).filter((z) => {
      const meta = idx.zoneMetaByCity[city]?.[z];
      const hasKw = (idx.keywordsByCityZone[`${city}||${z}`] || []).includes(keyword);
      if (!hasKw) return false;
      // Prefer real localities; include Cityinventory only if it's the only match
      return true;
    });
    const localities = zones.filter((z) => !/cityinventory/i.test(z));
    if (localities.length) zones = localities;
  } else {
    zones = [zone];
  }

  const targets = [];
  for (const z of zones) {
    const key = `${city}||${z}||${keyword}`;
    const combo = idx.combos.get(key);
    if (combo) targets.push(combo);
  }

  if (!targets.length) {
    return {
      error: `No sheet mapping for ${city} / ${zone || 'All'} / ${keyword}`,
      targets: [],
    };
  }
  return { targets, index: idx };
}

export function getLocationsMeta() {
  const idx = getLocationIndex();
  return {
    source: 'locations.csv',
    cities: idx.cities,
    zonesByCity: idx.zonesByCity,
    zoneMetaByCity: idx.zoneMetaByCity,
    keywordsByCity: idx.keywordsByCity,
    keywordsByCityZone: idx.keywordsByCityZone,
    specialties: idx.allKeywords,
    keywords: idx.allKeywords,
    comboCount: idx.comboCount,
    rowCount: idx.rowCount,
    supportsAllZones: true,
  };
}
