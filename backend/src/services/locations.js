import fs from "fs";
import path from "path";
import { parseCsv } from "./csvParse.js";
import { getCachedCsvPath, syncSheetFromGoogle, getSheetSyncMeta } from "./sheetSync.js";
import { getDataDir } from "../config.js";

const LEGACY_CSV = path.join(getDataDir(), "locations.csv");
/** @type {{ byCity: Map<string, Map<string, Set<string>>>, rows: object[], source: string } | null} */
let cache = null;

function normalizeHeader(h) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function findCol(row, ...candidates) {
  const keys = Object.keys(row);
  const map = new Map(keys.map((k) => [normalizeHeader(k), k]));
  for (const c of candidates) {
    const hit = map.get(normalizeHeader(c));
    if (hit) return hit;
  }
  return null;
}

function parseCsvText(text) {
  return parseCsv(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

function buildIndex(rawRows, source) {
  if (!rawRows.length) {
    return { byCity: new Map(), rows: [], source };
  }

  const sample = rawRows[0];
  const cityCol = findCol(sample, "city", "City");
  const zoneCol = findCol(sample, "zone", "Zone", "locality", "Locality", "area", "Area");
  const specialityCol = findCol(sample, "speciality", "Speciality", "specialty", "Specialty", "keyword", "Keyword");
  const zoneTypeCol = findCol(sample, "zone type", "Zone Type", "zonetype", "type");

  if (!cityCol || !zoneCol) {
    throw new Error("Sheet must include City and Zone columns.");
  }

  /** @type {Map<string, Map<string, Set<string>>>} */
  const byCity = new Map();
  const rows = [];

  for (const r of rawRows) {
    const city = String(r[cityCol] || "").trim();
    const zone = String(r[zoneCol] || "").trim();
    if (!city || !zone) continue;

    const speciality = specialityCol ? String(r[specialityCol] || "").trim() : "";
    const zoneType = zoneTypeCol ? String(r[zoneTypeCol] || "").trim() : "";

    if (!byCity.has(city)) byCity.set(city, new Map());
    const zones = byCity.get(city);
    if (!zones.has(zone)) zones.set(zone, new Set());
    if (speciality) zones.get(zone).add(speciality);

    rows.push({
      city,
      zone,
      zoneType: zoneType || null,
      speciality: speciality || null,
      keyword: speciality || null,
    });
  }

  return { byCity, rows, source };
}

export function reloadLocationsIndex() {
  cache = null;
  return getLocationsIndex();
}

export function getLocationsIndex() {
  if (cache) return cache;

  const sheetPath = getCachedCsvPath();
  if (fs.existsSync(sheetPath)) {
    const text = fs.readFileSync(sheetPath, "utf8");
    cache = buildIndex(parseCsvText(text), "google_sheet");
    return cache;
  }

  if (fs.existsSync(LEGACY_CSV)) {
    const text = fs.readFileSync(LEGACY_CSV, "utf8");
    cache = buildIndex(parseCsvText(text), "legacy_csv");
    return cache;
  }

  cache = { byCity: new Map(), rows: [], source: "empty" };
  return cache;
}

export async function ensureLocationsSynced() {
  try {
    await syncSheetFromGoogle({ force: false });
  } catch (err) {
    console.warn("[locations] Initial sheet sync failed:", err.message);
  }
  return reloadLocationsIndex();
}

export function listCities() {
  const { byCity } = getLocationsIndex();
  return [...byCity.keys()].sort((a, b) => a.localeCompare(b));
}

export function listZones(city) {
  const { byCity } = getLocationsIndex();
  const zones = byCity.get(city);
  if (!zones) return [];
  return [...zones.keys()].sort((a, b) => a.localeCompare(b));
}

export function listKeywords(city, zone) {
  const { byCity } = getLocationsIndex();
  const zones = byCity.get(city);
  if (!zones) return [];
  if (!zone || zone === "All") {
    const all = new Set();
    for (const set of zones.values()) {
      for (const k of set) all.add(k);
    }
    return [...all].sort((a, b) => a.localeCompare(b));
  }
  const set = zones.get(zone);
  if (!set) return [];
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Alias used by clinic discovery */
export function listKeywordsFor(city, zone) {
  return listKeywords(city, zone);
}

/** @deprecated Prefer listKeywords — aliases specialty/keyword */
export function listSpecialities(city, zone) {
  return listKeywords(city, zone);
}

export function getLocationsMeta() {
  const index = getLocationsIndex();
  const sync = getSheetSyncMeta();
  const cities = listCities();
  /** @type {Record<string, string[]>} */
  const zonesByCity = {};
  /** @type {Record<string, Record<string, string|null>>} */
  const zoneMetaByCity = {};
  /** @type {Record<string, string[]>} */
  const keywordsByCity = {};
  /** @type {Record<string, string[]>} */
  const keywordsByCityZone = {};
  const allKeywords = new Set();
  let comboCount = 0;

  for (const city of cities) {
    const zones = listZones(city);
    zonesByCity[city] = zones;
    zoneMetaByCity[city] = {};
    const cityKw = new Set();
    for (const zone of zones) {
      zoneMetaByCity[city][zone] = null;
      const kws = listKeywords(city, zone);
      keywordsByCityZone[`${city}||${zone}`] = kws;
      for (const kw of kws) {
        cityKw.add(kw);
        allKeywords.add(kw);
        comboCount += 1;
      }
    }
    keywordsByCity[city] = [...cityKw].sort((a, b) => a.localeCompare(b));
  }

  return {
    source: index.source,
    cityCount: cities.length,
    cities,
    rows: index.rows.length,
    comboCount,
    catalogSize: comboCount,
    zonesByCity,
    zoneMetaByCity,
    keywordsByCity,
    keywordsByCityZone,
    keywords: [...allKeywords].sort((a, b) => a.localeCompare(b)),
    specialties: [...allKeywords].sort((a, b) => a.localeCompare(b)),
    sheetSync: sync,
  };
}

export function resolveDiscoveryTargets({ city, zone, keyword }) {
  const index = getLocationsIndex();
  if (!index.byCity.size) {
    throw new Error("Location sheet is empty. Wait for Google Sheet sync or check the published CSV URL.");
  }

  const cities = city && city !== "All"
    ? [city]
    : listCities();

  if (!cities.length) {
    throw new Error("No cities found in the synced sheet.");
  }

  /** @type {{ city: string, zone: string, keyword: string, zoneType: string|null }[]} */
  const targets = [];

  for (const c of cities) {
    const zoneMap = index.byCity.get(c);
    if (!zoneMap) continue;

    const zones = zone && zone !== "All"
      ? (zoneMap.has(zone) ? [zone] : [])
      : [...zoneMap.keys()];

    if (!zones.length) continue;

    for (const z of zones) {
      const kws = zoneMap.get(z) || new Set();
      let keywords = [...kws];
      if (keyword && keyword !== "All") {
        keywords = keywords.filter((k) => k.toLowerCase() === String(keyword).toLowerCase());
      }
      if (!keywords.length && keyword && keyword !== "All") continue;
      if (!keywords.length) keywords = [keyword && keyword !== "All" ? keyword : "clinic"];

      for (const kw of keywords) {
        targets.push({ city: c, zone: z, keyword: kw, zoneType: null, frequency: 1 });
      }
    }
  }

  if (!targets.length) {
    throw new Error("No City → Zone → Speciality matches in the synced Google Sheet for this filter.");
  }

  return targets;
}
