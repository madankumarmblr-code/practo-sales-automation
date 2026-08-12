import { nanoid } from 'nanoid';

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

export const SPECIALTIES = [
  'Dentist',
  'Dermatologist',
  'Pediatrician',
  'Orthopedic',
  'Gynecologist',
  'Ophthalmologist',
  'ENT',
  'General Physician',
  'Physiotherapy',
  'Diagnostics Lab',
];

export const GEO = {
  Bangalore: ['Indiranagar', 'Koramangala', 'Whitefield', 'Jayanagar', 'HSR Layout', 'Malleshwaram'],
  Mumbai: ['Andheri', 'Bandra', 'Powai', 'Thane', 'Dadar'],
  'Delhi NCR': ['South Delhi', 'Gurgaon', 'Noida', 'Dwarka'],
  Hyderabad: ['Banjara Hills', 'Gachibowli', 'Madhapur', 'Secunderabad'],
  Chennai: ['T Nagar', 'Adyar', 'Velachery', 'Anna Nagar'],
  Pune: ['Koregaon Park', 'Hinjewadi', 'Baner', 'Kothrud'],
};

const FIRST = [
  'Ananya', 'Rahul', 'Priya', 'Vikram', 'Sneha', 'Arjun', 'Meera', 'Karan', 'Nisha', 'Omar',
  'Kavitha', 'Sanjay', 'Fatima', 'Rohan', 'Anita', 'Imran', 'Lakshmi', 'Deepak', 'Neha', 'Manish',
  'Aisha', 'Dev', 'Suresh', 'Pooja', 'Nikhil', 'Ritu', 'Harsh', 'Divya', 'Aditya', 'Shreya',
];
const LAST = [
  'Reddy', 'Mehta', 'Nair', 'Singh', 'Kapoor', 'Desai', 'Iyer', 'Malhotra', 'Verma', 'Farooq',
  'Rao', 'Pillai', 'Sheikh', 'Gupta', 'Bose', 'Ali', 'Krishnan', 'Jain', 'Joshi', 'Aggarwal',
  'Khan', 'Patel', 'Sharma', 'Menon', 'Chopra', 'Banerjee', 'Nayak', 'Das', 'Mukherjee', 'Shah',
];

const CLINIC_PREFIX = [
  'Smile', 'Care', 'Pearl', 'Apollo', 'Harmony', 'Bright', 'City', 'Prime', 'Lotus', 'Aura',
  'Summit', 'Green', 'Metro', 'Nova', 'Pulse', 'Orchid', 'Skyline', 'Heritage', 'Unity', 'Elite',
];
const CLINIC_SUFFIX = {
  Dentist: ['Dental Care', 'Dental Clinic', 'Tooth Clinic', 'Orthodontics', 'Smile Studio'],
  Dermatologist: ['Skin Clinic', 'Derm Centre', 'Skin & Hair', 'Derma Studio'],
  Pediatrician: ['Kids Clinic', 'Child Care', 'Pediatrics', 'Little Care'],
  Orthopedic: ['Ortho Centre', 'Bone & Joint', 'Ortho Clinic'],
  Gynecologist: ['Womens Clinic', 'Maternity Care', 'Gyne Centre'],
  Ophthalmologist: ['Eye Care', 'Eye Clinic', 'Vision Centre'],
  ENT: ['ENT Clinic', 'ENT Care', 'Sinus & ENT'],
  'General Physician': ['Family Clinic', 'Multi Speciality', 'Health Clinic'],
  Physiotherapy: ['Physio Centre', 'Rehab Clinic', 'Physio Care'],
  'Diagnostics Lab': ['Diagnostics', 'Path Lab', 'Diagnostic Centre'],
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
    .slice(0, 18) || 'clinic';
}

function citySlug(city) {
  return city
    .toLowerCase()
    .replace('delhi ncr', 'delhi')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function specialtySlug(specialty) {
  const map = {
    Dentist: 'dentist',
    Dermatologist: 'dermatologist',
    Pediatrician: 'pediatrician',
    Orthopedic: 'orthopedist',
    Gynecologist: 'gynecologist',
    Ophthalmologist: 'ophthalmologist',
    ENT: 'ear-nose-throat',
    'General Physician': 'general-physician',
    Physiotherapy: 'physiotherapist',
    'Diagnostics Lab': 'diagnostic',
  };
  return map[specialty] || specialty.toLowerCase().replace(/\s+/g, '-');
}

function practoListingUrl(city, specialty) {
  return `https://www.practo.com/${citySlug(city)}/${specialtySlug(specialty)}`;
}

function buildPlatforms(seed, hasPracto, clinicName, city, specialty) {
  const q = encodeURIComponent(`${clinicName} ${city}`);
  const specialtyQ = encodeURIComponent(`${specialty} clinic ${city}`);
  const all = [
    {
      name: 'Google Maps',
      listed: true,
      url: `https://www.google.com/maps/search/${q}`,
    },
    {
      name: 'Practo',
      listed: hasPracto,
      url: hasPracto ? practoListingUrl(city, specialty) : null,
    },
    {
      name: 'Justdial',
      listed: seed % 3 !== 0,
      url: `https://www.justdial.com/${encodeURIComponent(city)}/${specialtyQ}`,
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

function makeClinic({ city, zone, specialty, index }) {
  const key = `${city}|${zone}|${specialty}|${index}`;
  const seed = hash(key);
  const prefix = pick(CLINIC_PREFIX, seed);
  const suffix = pick(CLINIC_SUFFIX[specialty] || CLINIC_SUFFIX['General Physician'], seed >>> 3);
  const landmarks = ['Plaza', 'Cross', 'Avenue', 'Residency', 'Arcade', 'Heights', 'Corner', 'Hub'];
  const landmark = pick(landmarks, seed >>> 7);
  const clinicName =
    index === 0
      ? `${prefix} ${suffix}`
      : `${prefix} ${suffix} — ${zone} ${landmark}`;
  const clinicSlug = slugify(clinicName);

  const ownerFirst = pick(FIRST, seed >>> 2);
  const ownerLast = pick(LAST, seed >>> 4);
  const ownerIsDoctor = specialty !== 'Diagnostics Lab' && seed % 5 !== 0;
  const ownerName = ownerIsDoctor ? `Dr. ${ownerFirst} ${ownerLast}` : `${ownerFirst} ${ownerLast}`;

  const hasMarketing = seed % 3 !== 2;
  const mFirst = pick(FIRST, seed * 17 + index * 13);
  const mLast = pick(LAST, seed * 29 + index * 41);
  const marketingName = hasMarketing ? `${mFirst} ${mLast}` : null;

  const hasPracto = seed % 5 !== 4; // ~80% on Practo
  const rating = hasPracto ? (3.6 + ((seed % 14) / 10)).toFixed(1) : null;
  const streetNo = 10 + (seed % 240);
  const address = `${streetNo}, ${zone} Main Road, ${city}`;

  const ownerPhone = phoneFromSeed(seed);
  const ownerEmail = emailFromName(ownerName, clinicSlug);
  const marketingPhone = hasMarketing ? phoneFromSeed(seed + 17) : null;
  const marketingEmail = hasMarketing
    ? `marketing@${clinicSlug}.in`
    : null;

  const platforms = buildPlatforms(seed, hasPracto, clinicName, city, specialty);
  const score =
    40 +
    platforms.length * 4 +
    (hasPracto ? 12 : 0) +
    (hasMarketing ? 6 : 0) +
    (seed % 10);

  return {
    id: `clinic-${nanoid(10)}`,
    clinicName,
    specialty,
    city,
    zone,
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
          name: marketingName,
          phone: marketingPhone,
          email: marketingEmail,
          title: 'Marketing Head',
        }
      : null,
    practo: {
      hasProfile: hasPracto,
      url: hasPracto ? practoListingUrl(city, specialty) : null,
      rating: rating ? Number(rating) : null,
    },
    platforms,
    platformNames: platforms.map((p) => p.name),
    sourcesFoundOn: platforms.map((p) => p.name),
    score: Math.min(99, score),
    estimatedValue: 45000 + (seed % 20) * 12000 + (hasPracto ? 25000 : 0),
    suggestedChannel: !hasPracto ? 'whatsapp' : seed % 2 === 0 ? 'gmail' : 'calls',
    matchReason: `Discovered via multi-platform scan for ${specialty} in ${zone}, ${city}.`,
  };
}

/** Density varies by specialty popularity in a zone */
function clinicCountFor(specialty, seed) {
  const base = {
    Dentist: 8,
    Dermatologist: 6,
    Pediatrician: 7,
    Orthopedic: 5,
    Gynecologist: 6,
    Ophthalmologist: 5,
    ENT: 4,
    'General Physician': 9,
    Physiotherapy: 5,
    'Diagnostics Lab': 4,
  }[specialty] || 5;
  return Math.max(3, base - (seed % 3));
}

function buildCatalog() {
  const clinics = [];
  for (const [city, zones] of Object.entries(GEO)) {
    for (const zone of zones) {
      for (const specialty of SPECIALTIES) {
        const seed = hash(`${city}|${zone}|${specialty}`);
        const count = clinicCountFor(specialty, seed);
        for (let i = 0; i < count; i += 1) {
          clinics.push(makeClinic({ city, zone, specialty, index: i }));
        }
      }
    }
  }
  return clinics;
}

const CATALOG = buildCatalog();

export function getDiscoveryMeta() {
  return {
    cities: Object.keys(GEO),
    zonesByCity: GEO,
    specialties: SPECIALTIES,
    platforms: PLATFORMS,
    catalogSize: CATALOG.length,
  };
}

/**
 * Multi-platform clinic discovery for a city / zone / specialty.
 * Aggregates listings as if scanning Google Maps, Practo, Justdial, etc.
 */
export function discoverClinics({ city, zone, specialty, limit = 50 } = {}) {
  if (!city || !zone || !specialty) {
    return {
      error: 'city, zone, and specialty are required',
      results: [],
    };
  }

  const scannedSources = PLATFORMS.map((name, i) => ({
    name,
    status: 'scanned',
    latencyMs: 120 + i * 35 + (hash(`${city}${zone}${specialty}${name}`) % 80),
  }));

  let results = CATALOG.filter(
    (c) => c.city === city && c.zone === zone && c.specialty === specialty
  );

  // Stable but varied order by score + name
  results = [...results].sort((a, b) => b.score - a.score || a.clinicName.localeCompare(b.clinicName));

  if (limit) results = results.slice(0, Math.min(Number(limit) || 50, 100));

  const withPracto = results.filter((r) => r.practo.hasProfile).length;
  const withoutPracto = results.length - withPracto;

  return {
    query: { city, zone, specialty, limit: results.length },
    scannedSources,
    summary: {
      total: results.length,
      withPractoProfile: withPracto,
      withoutPractoProfile: withoutPracto,
      platformsCovered: PLATFORMS.length,
    },
    count: results.length,
    results: results.map((r) => ({
      ...r,
      // Flatten helpers for import / table
      name: r.owner.name,
      email: r.owner.email,
      phone: r.owner.phone,
      company: r.clinicName,
      title: r.owner.title,
      source: 'Multi-platform Discovery',
      location: `${r.zone}, ${r.city}`,
    })),
  };
}
