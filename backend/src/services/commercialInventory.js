import fs from "fs";
import { parseCsv } from "./csvParse.js";
import { getCachedCsvPath, syncSheetFromGoogle, getSheetSyncMeta } from "./sheetSync.js";

/**
 * Commercial inventory from the published Google Sheet.
 * Columns: City, Zone, Speciality, Position, Price_3M, Price_6M, Price_12M, Total Slots, Available Slots
 */

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

function num(v) {
  if (v == null || v === "") return 0;
  const n = Number(String(v).replace(/[₹,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function mapRows(rawRows) {
  if (!rawRows.length) return [];
  const sample = rawRows[0];
  const cityCol = findCol(sample, "city");
  const zoneCol = findCol(sample, "zone", "locality", "area");
  const specCol = findCol(sample, "speciality", "specialty", "keyword");
  const posCol = findCol(sample, "position", "pos", "slot position");
  const p3 = findCol(sample, "price_3m", "price 3m", "3m", "price3m");
  const p6 = findCol(sample, "price_6m", "price 6m", "6m", "price6m");
  const p12 = findCol(sample, "price_12m", "price 12m", "12m", "price12m");
  const totalCol = findCol(sample, "total slots", "total_slots", "totalslots");
  const availCol = findCol(sample, "available slots", "available_slots", "availableslots", "available");

  if (!cityCol || !zoneCol) return [];

  return rawRows
    .map((r, i) => {
      const city = String(r[cityCol] || "").trim();
      const zone = String(r[zoneCol] || "").trim();
      if (!city || !zone) return null;
      return {
        id: i + 1,
        city,
        zone,
        speciality: specCol ? String(r[specCol] || "").trim() : "",
        position: posCol ? String(r[posCol] || "").trim() : "",
        price3M: p3 ? num(r[p3]) : 0,
        price6M: p6 ? num(r[p6]) : 0,
        price12M: p12 ? num(r[p12]) : 0,
        totalSlots: totalCol ? num(r[totalCol]) : 0,
        availableSlots: availCol ? num(r[availCol]) : 0,
      };
    })
    .filter(Boolean);
}

export function loadCommercialInventory({ forceSync = false } = {}) {
  const csvPath = getCachedCsvPath();
  if (!fs.existsSync(csvPath) || forceSync) {
    // Caller should await sync; sync is async — load what we have
  }
  if (!fs.existsSync(csvPath)) {
    return { rows: [], meta: getSheetSyncMeta() };
  }
  const text = fs.readFileSync(csvPath, "utf8");
  const raw = parseCsv(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  return { rows: mapRows(raw), meta: getSheetSyncMeta() };
}

export async function getCommercialInventoryFresh() {
  await syncSheetFromGoogle({ force: false });
  return loadCommercialInventory();
}

export function getCommercialFilters(rows) {
  const cities = new Set();
  const zonesByCity = new Map();
  const specsByCityZone = new Map();

  for (const r of rows) {
    cities.add(r.city);
    if (!zonesByCity.has(r.city)) zonesByCity.set(r.city, new Set());
    zonesByCity.get(r.city).add(r.zone);
    const key = `${r.city}||${r.zone}`;
    if (!specsByCityZone.has(key)) specsByCityZone.set(key, new Set());
    if (r.speciality) specsByCityZone.get(key).add(r.speciality);
  }

  return {
    cities: [...cities].sort((a, b) => a.localeCompare(b)),
    zonesByCity: Object.fromEntries(
      [...zonesByCity.entries()].map(([c, set]) => [c, [...set].sort((a, b) => a.localeCompare(b))])
    ),
    specialitiesByCityZone: Object.fromEntries(
      [...specsByCityZone.entries()].map(([k, set]) => [k, [...set].sort((a, b) => a.localeCompare(b))])
    ),
  };
}

export function filterInventory(rows, { city, zone, speciality, availableOnly } = {}) {
  return rows.filter((r) => {
    if (city && city !== "All" && r.city !== city) return false;
    if (zone && zone !== "All" && r.zone !== zone) return false;
    if (speciality && speciality !== "All" && r.speciality !== speciality) return false;
    if (availableOnly && !(r.availableSlots > 0)) return false;
    return true;
  });
}
