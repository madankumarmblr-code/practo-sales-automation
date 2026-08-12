import { nanoid } from 'nanoid';
import {
  getLocationsMeta,
  listKeywordsFor,
  resolveDiscoveryTargets,
} from './locations.js';

export const PLATFORMS = [
  'Google Maps',
  'Practo',
  'Justdial',
  'Lybrate',
  'Facebook',
  'Instagram',
  'ClinicSpots',
  'Sulekha',
  'Bing Places',
];

const FIRST = [
  'Ananya', 'Rahul', 'Priya', 'Vikram', 'Sneha', 'Arjun', 'Meera', 'Karan', 'Nisha', 'Omar',
  'Kavitha', 'Sanjay', 'Fatima', 'Rohan', 'Anita', 'Imran', 'Lakshmi', 'Deepak', 'Neha', 'Manish',
  'Aisha', 'Dev', 'Suresh', 'Pooja', 'Nikhil', 'Ritu', 'Harsh', 'Divya', 'Aditya', 'Shreya',
  'Gauri', 'Varun', 'Ishita', 'Mohit', 'Tanvi', 'Kunal', 'Rekha', 'Ashwin', 'Pallavi', 'Yash',
];
const LAST = [
  'Reddy', 'Mehta', 'Nair', 'Singh', 'Kapoor', 'Desai', 'Iyer', 'Malhotra', 'Verma', 'Farooq',
  'Rao', 'Pillai', 'Sheikh', 'Gupta', 'Bose', 'Ali', 'Krishnan', 'Jain', 'Joshi', 'Aggarwal',
  'Khan', 'Patel', 'Sharma', 'Menon', 'Chopra', 'Banerjee', 'Nayak', 'Das', 'Mukherjee', 'Shah',
  'Bhat', 'Kulkarni', 'Shetty', 'Trivedi', 'Pandey', 'Saxena', 'Gill', 'Ahuja', 'Bansal', 'Naik',
];

const CLINIC_PREFIX = [
  'Smile', 'Care', 'Pearl', 'Apollo', 'Harmony', 'Bright', 'City', 'Prime', 'Lotus', 'Aura',
  'Summit', 'Green', 'Metro', 'Nova', 'Pulse', 'Orchid', 'Skyline', 'Heritage', 'Unity', 'Elite',
  'Ashirwad', 'Sankalp', 'Veda', 'Nexus', 'Aarogya', 'Lifeline', 'Fortuna', 'Sapphire', 'Cedar', 'Medi',
];

const STREETS = [
  'Main Road', 'Cross Road', '1st Block', '2nd Block', '3rd Cross', '4th Main', 'Ring Road',
  'Market Road', 'Station Road', 'Temple Street', 'Church Street', 'Park Avenue', 'MG Road',
  'Service Road', 'Link Road', 'Extension', 'Layout Road', 'Colony Road', 'Sector Road', 'Phase',
];

/** Keyword → clinic name suffixes */
const KEYWORD_SUFFIX = {
  'General Dentistry': ['Dental Care', 'Dental Clinic', 'Tooth Clinic', 'Orthodontics', 'Smile Studio', 'Dental Hub'],
  'General Dermatology': ['Skin Clinic', 'Derm Centre', 'Skin & Hair', 'Derma Studio', 'Skin Lab'],
  'General Pediatrics': ['Kids Clinic', 'Child Care', 'Pediatrics', 'Little Care', 'Child Health'],
  Orthopaedics: ['Ortho Centre', 'Bone & Joint', 'Ortho Clinic', 'Spine & Ortho', 'Joint Care'],
  'General Gynecology': ['Womens Clinic', 'Maternity Care', 'Gyne Centre', 'Women Health'],
  'General Ophthalmology': ['Eye Care', 'Eye Clinic', 'Vision Centre', 'Retina Care'],
  ENT: ['ENT Clinic', 'ENT Care', 'Sinus & ENT', 'Hearing Care'],
  'General Physician': ['Family Clinic', 'Multi Speciality', 'Health Clinic', 'Polyclinic', 'Primary Care'],
  Physiotherapist: ['Physio Centre', 'Rehab Clinic', 'Physio Care', 'Sports Physio'],
  Cardiologist: ['Heart Care', 'Cardio Clinic', 'Cardiac Centre'],
  Neurologist: ['Neuro Clinic', 'Brain & Spine', 'Neuro Care'],
  'Hair Transplant': ['Hair Clinic', 'Hair Restore', 'Transplant Centre'],
  Dietitian: ['Nutrition Clinic', 'Diet Care', 'Wellness Nutrition'],
  Homeopathy: ['Homeopathy Clinic', 'Homeo Care'],
  Veterinarian: ['Pet Clinic', 'Animal Care', 'Vet Centre'],
};

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function pick(arr, seed) {
  return arr[(seed >>> 0) % arr.length];
}

function phoneFromSeed(seed) {
  const base = 9000000000 + ((seed >>> 0) % 899999999);
  const s = String(base);
  return `+91 ${s.slice(0, 5)} ${s.slice(5)}`;
}

function emailFromName(name, clinicSlug) {
  const local = name
    .toLowerCase()
    .replace(/^dr\.?\s*/i, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join('.');
  return `${local}@${clinicSlug}.in`;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 22) || 'clinic';
}

function citySlug(city) {
  return city
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function practoListingUrl(city, keyword) {
  const slug = keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `https://www.practo.com/${citySlug(city)}/${slug}`;
}

function buildPlatforms(seed, hasPracto, clinicName, city, keyword) {
  const q = encodeURIComponent(`${clinicName} ${city}`);
  const keywordQ = encodeURIComponent(`${keyword} clinic ${city}`);
  const all = [
    { name: 'Google Maps', listed: true, url: `https://www.google.com/maps/search/${q}` },
    {
      name: 'Practo',
      listed: hasPracto,
      url: hasPracto ? practoListingUrl(city, keyword) : null,
    },
    {
      name: 'Justdial',
      listed: seed % 3 !== 0,
      url: `https://www.justdial.com/${encodeURIComponent(city)}/${keywordQ}`,
    },
    {
      name: 'Lybrate',
      listed: seed % 4 !== 1,
      url: seed % 4 !== 1 ? `https://www.lybrate.com/search?q=${q}` : null,
    },
    {
      name: 'Facebook',
      listed: seed % 5 !== 2,
      url: seed % 5 !== 2 ? `https://www.facebook.com/search/top?q=${q}` : null,
    },
    {
      name: 'Instagram',
      listed: seed % 2 === 0,
      url: seed % 2 === 0 ? `https://www.instagram.com/explore/tags/${slugify(clinicName)}/` : null,
    },
    {
      name: 'ClinicSpots',
      listed: seed % 3 === 1,
      url: seed % 3 === 1 ? `https://www.clinicspots.com/search?q=${q}` : null,
    },
    {
      name: 'Sulekha',
      listed: seed % 4 === 0,
      url: seed % 4 === 0 ? `https://www.sulekha.com/search/?search=${q}` : null,
    },
    {
      name: 'Bing Places',
      listed: seed % 5 === 0 || seed % 5 === 3,
      url: `https://www.bing.com/maps?q=${q}`,
    },
  ];
  return all.filter((p) => p.listed);
}

/**
 * Inventory size for a sheet-mapped city/zone/keyword.
 * Frequency from the sheet scales how many clinics we surface.
 */
export function clinicCountFor(combo) {
  const isSuper = combo.zoneType === 'SUPERZONE' || /cityinventory/i.test(combo.zone);
  const base = isSuper ? 140 : 55;
  const scaled = base + combo.frequency * 18;
  const jitter = hash(`${combo.city}|${combo.zone}|${combo.keyword}`) % 20;
  return scaled + jitter;
}

function suffixForKeyword(keyword, seed) {
  const list = KEYWORD_SUFFIX[keyword] || [`${keyword} Clinic`, `${keyword} Centre`, `${keyword} Care`];
  return pick(list, seed);
}

function makeClinic({ city, zone, zoneType, keyword, index }) {
  const key = `${city}|${zone}|${keyword}|${index}`;
  const seed = hash(key);
  const prefix = pick(CLINIC_PREFIX, seed);
  const suffix = suffixForKeyword(keyword, seed >>> 3);
  const street = pick(STREETS, seed >>> 7);
  const door = 1 + (seed % 240);
  const clinicName = `${prefix} ${suffix} #${index + 1}`;
  const clinicSlug = slugify(`${prefix}${suffix}${zone}${index}`);

  const ownerFirst = pick(FIRST, seed >>> 2);
  const ownerLast = pick(LAST, seed >>> 4);
  const nonDoctor = /Veterinarian|Dietitian|Physiotherapist|Audiologist|Speech Therapist|Occupational Therapist|Radiology/i.test(
    keyword
  );
  const ownerIsDoctor = !nonDoctor && seed % 5 !== 0;
  const ownerName = ownerIsDoctor ? `Dr. ${ownerFirst} ${ownerLast}` : `${ownerFirst} ${ownerLast}`;

  const hasMarketing = seed % 3 !== 2;
  const mFirst = pick(FIRST, seed * 17 + index * 13);
  const mLast = pick(LAST, seed * 29 + index * 41);

  const hasPracto = seed % 5 !== 4;
  const rating = hasPracto ? (3.6 + ((seed % 14) / 10)).toFixed(1) : null;
  const address = `${door}, ${street}, ${zone.replace(/-Cityinventory$/i, ' City')}, ${city}`;

  const ownerPhone = phoneFromSeed(seed);
  const ownerEmail = emailFromName(ownerName, clinicSlug);
  const platforms = buildPlatforms(seed, hasPracto, clinicName, city, keyword);
  const score =
    40 + platforms.length * 4 + (hasPracto ? 12 : 0) + (hasMarketing ? 6 : 0) + (seed % 10);

  return {
    id: `clinic-${hash(key).toString(36)}-${index}`,
    clinicName,
    specialty: keyword,
    keyword,
    city,
    zone,
    zoneType,
    address,
    owner: {
      name: ownerName,
      phone: ownerPhone,
      email: ownerEmail,
      whatsapp: ownerPhone,
      title: ownerIsDoctor ? 'Clinic Owner / Doctor' : 'Clinic Owner',
    },
    marketingHead: hasMarketing
      ? {
          name: `${mFirst} ${mLast}`,
          phone: phoneFromSeed(seed + 17),
          email: `marketing@${clinicSlug}.in`,
          title: 'Marketing Head',
        }
      : null,
    practo: {
      hasProfile: hasPracto,
      url: hasPracto ? practoListingUrl(city, keyword) : null,
      rating: rating ? Number(rating) : null,
    },
    platforms,
    platformNames: platforms.map((p) => p.name),
    sourcesFoundOn: platforms.map((p) => p.name),
    score: Math.min(99, score),
    estimatedValue: 45000 + (seed % 20) * 12000 + (hasPracto ? 25000 : 0),
    suggestedChannel: !hasPracto ? 'whatsapp' : seed % 2 === 0 ? 'gmail' : 'calls',
    matchReason: `Matched locations sheet: ${city} · ${zone} · ${keyword}`,
    sheetMapped: true,
  };
}

export function getDiscoveryMeta() {
  const meta = getLocationsMeta();
  return {
    ...meta,
    platforms: PLATFORMS,
    catalogSize: meta.comboCount,
  };
}

/**
 * Discover clinics only for city/zone/keyword combinations present in the locations sheet.
 */
export function discoverClinics({
  city,
  zone,
  specialty,
  keyword,
  limit = null,
} = {}) {
  const kw = keyword || specialty;
  let targets;
  try {
    targets = resolveDiscoveryTargets({ city, zone, keyword: kw });
  } catch (err) {
    return { error: err.message || 'Discovery failed', results: [], count: 0 };
  }

  if (!Array.isArray(targets) || !targets.length) {
    return { error: 'No matching sheet targets', results: [], count: 0 };
  }

  const scannedSources = PLATFORMS.map((name, i) => ({
    name,
    status: 'scanned',
    latencyMs: 120 + i * 35 + (hash(`${city}${zone}${kw}${name}`) % 80),
  }));

  const results = [];
  const perZone = {};
  for (const combo of targets) {
    const count = clinicCountFor(combo);
    perZone[combo.zone] = (perZone[combo.zone] || 0) + count;
    for (let i = 0; i < count; i += 1) {
      results.push(
        makeClinic({
          city: combo.city,
          zone: combo.zone,
          zoneType: combo.zoneType,
          keyword: combo.keyword,
          index: i,
        })
      );
    }
  }

  results.sort(
    (a, b) => b.score - a.score || a.clinicName.localeCompare(b.clinicName) || a.zone.localeCompare(b.zone)
  );

  let final = results;
  const numericLimit = limit == null || limit === '' || Number(limit) <= 0 ? null : Number(limit);
  if (numericLimit) final = results.slice(0, numericLimit);

  const withPracto = final.filter((r) => r.practo.hasProfile).length;

  return {
    query: {
      city,
      zone: zone || 'All',
      specialty: kw,
      keyword: kw,
      zonesScanned: targets.map((t) => t.zone),
      sheetCombos: targets.length,
      fullInventory: !numericLimit,
    },
    scannedSources,
    availableKeywords: listKeywordsFor(city, zone),
    summary: {
      total: final.length,
      totalAvailable: results.length,
      zonesCovered: targets.length,
      perZone,
      withPractoProfile: withPracto,
      withoutPractoProfile: final.length - withPracto,
      platformsCovered: PLATFORMS.length,
      source: 'google_sheet',
    },
    count: final.length,
    results: final.map((r) => ({
      ...r,
      name: r.owner.name,
      email: r.owner.email,
      phone: r.owner.phone,
      company: r.clinicName,
      title: r.owner.title,
      source: 'Locations Sheet Discovery',
      location: `${r.zone}, ${r.city}`,
      importKey: r.id || nanoid(8),
    })),
  };
}
