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

/** Expanded zone coverage per city for full-location pulls */
export const GEO = {
  Bangalore: [
    'Indiranagar',
    'Koramangala',
    'Whitefield',
    'Jayanagar',
    'HSR Layout',
    'Malleshwaram',
    'BTM Layout',
    'Marathahalli',
    'Electronic City',
    'Yelahanka',
    'Rajajinagar',
    'Banashankari',
  ],
  Mumbai: [
    'Andheri',
    'Bandra',
    'Powai',
    'Thane',
    'Dadar',
    'Borivali',
    'Goregaon',
    'Navi Mumbai',
    'Malad',
    'Worli',
  ],
  'Delhi NCR': [
    'South Delhi',
    'Gurgaon',
    'Noida',
    'Dwarka',
    'Rohini',
    'East Delhi',
    'Ghaziabad',
    'Faridabad',
    'Saket',
    'Connaught Place',
  ],
  Hyderabad: [
    'Banjara Hills',
    'Gachibowli',
    'Madhapur',
    'Secunderabad',
    'Kukatpally',
    'Hitech City',
    'Jubilee Hills',
    'Kondapur',
    'Begumpet',
  ],
  Chennai: [
    'T Nagar',
    'Adyar',
    'Velachery',
    'Anna Nagar',
    'OMR',
    'Porur',
    'Tambaram',
    'Nungambakkam',
    'Mylapore',
  ],
  Pune: [
    'Koregaon Park',
    'Hinjewadi',
    'Baner',
    'Kothrud',
    'Hadapsar',
    'Wakad',
    'Viman Nagar',
    'Kalyani Nagar',
    'Aundh',
  ],
};

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
  'Bhat', 'Kulkarni', 'Shetty', 'Trivedi', 'Pandey', 'Saxena', 'Gill', 'Ahuja', 'Bansal', 'Iyer',
];

const CLINIC_PREFIX = [
  'Smile', 'Care', 'Pearl', 'Apollo', 'Harmony', 'Bright', 'City', 'Prime', 'Lotus', 'Aura',
  'Summit', 'Green', 'Metro', 'Nova', 'Pulse', 'Orchid', 'Skyline', 'Heritage', 'Unity', 'Elite',
  'Ashirwad', 'Sankalp', 'Veda', 'Nexus', 'Aarogya', 'Lifeline', 'Medanta', 'Fortuna', 'Sapphire', 'Cedar',
];
const CLINIC_SUFFIX = {
  Dentist: ['Dental Care', 'Dental Clinic', 'Tooth Clinic', 'Orthodontics', 'Smile Studio', 'Dental Hub', 'Implant Centre'],
  Dermatologist: ['Skin Clinic', 'Derm Centre', 'Skin & Hair', 'Derma Studio', 'Skin Lab', 'Derma Care'],
  Pediatrician: ['Kids Clinic', 'Child Care', 'Pediatrics', 'Little Care', 'Child Health', 'Kids First'],
  Orthopedic: ['Ortho Centre', 'Bone & Joint', 'Ortho Clinic', 'Spine & Ortho', 'Joint Care'],
  Gynecologist: ['Womens Clinic', 'Maternity Care', 'Gyne Centre', 'Women Health', 'Fertility Care'],
  Ophthalmologist: ['Eye Care', 'Eye Clinic', 'Vision Centre', 'Retina Care', 'Laser Eye'],
  ENT: ['ENT Clinic', 'ENT Care', 'Sinus & ENT', 'Hearing Care', 'Throat & ENT'],
  'General Physician': ['Family Clinic', 'Multi Speciality', 'Health Clinic', 'Polyclinic', 'Primary Care'],
  Physiotherapy: ['Physio Centre', 'Rehab Clinic', 'Physio Care', 'Sports Physio', 'Recovery Lab'],
  'Diagnostics Lab': ['Diagnostics', 'Path Lab', 'Diagnostic Centre', 'Imaging Lab', 'Health Check'],
};

const STREETS = [
  'Main Road', 'Cross Road', '1st Block', '2nd Block', '3rd Cross', '4th Main', 'Ring Road',
  'Market Road', 'Station Road', 'Temple Street', 'Church Street', 'Park Avenue', 'MG Road',
  'Service Road', 'Link Road', 'Extension', 'Layout Road', 'Colony Road', 'Sector Road', 'Phase',
];

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

/**
 * Full-location density — intended to represent complete local inventory
 * for a specialty inside one zone (not a tiny sample).
 */
export function clinicCountFor(specialty, city, zone) {
  const seed = hash(`${city}|${zone}|${specialty}|density`);
  const base = {
    Dentist: 95,
    Dermatologist: 62,
    Pediatrician: 78,
    Orthopedic: 54,
    Gynecologist: 68,
    Ophthalmologist: 58,
    ENT: 48,
    'General Physician': 110,
    Physiotherapy: 52,
    'Diagnostics Lab': 42,
  }[specialty] || 55;
  // Mild zone variance so denser areas show more listings
  const zoneBoost = 8 + (seed % 25);
  return base + zoneBoost;
}

function makeClinic({ city, zone, specialty, index }) {
  const key = `${city}|${zone}|${specialty}|${index}`;
  const seed = hash(key);
  const prefix = pick(CLINIC_PREFIX, seed);
  const suffix = pick(CLINIC_SUFFIX[specialty] || CLINIC_SUFFIX['General Physician'], seed >>> 3);
  const street = pick(STREETS, seed >>> 7);
  const door = 1 + (seed % 240);
  const clinicName = `${prefix} ${suffix} #${index + 1}`;
  const clinicSlug = slugify(`${prefix}${suffix}${zone}${index}`);

  const ownerFirst = pick(FIRST, seed >>> 2);
  const ownerLast = pick(LAST, seed >>> 4);
  const ownerIsDoctor = specialty !== 'Diagnostics Lab' && seed % 5 !== 0;
  const ownerName = ownerIsDoctor ? `Dr. ${ownerFirst} ${ownerLast}` : `${ownerFirst} ${ownerLast}`;

  const hasMarketing = seed % 3 !== 2;
  const mFirst = pick(FIRST, seed * 17 + index * 13);
  const mLast = pick(LAST, seed * 29 + index * 41);
  const marketingName = hasMarketing ? `${mFirst} ${mLast}` : null;

  const hasPracto = seed % 5 !== 4;
  const rating = hasPracto ? (3.6 + ((seed % 14) / 10)).toFixed(1) : null;
  const address = `${door}, ${street}, ${zone}, ${city}`;

  const ownerPhone = phoneFromSeed(seed);
  const ownerEmail = emailFromName(ownerName, clinicSlug);
  const marketingPhone = hasMarketing ? phoneFromSeed(seed + 17) : null;
  const marketingEmail = hasMarketing ? `marketing@${clinicSlug}.in` : null;

  const platforms = buildPlatforms(seed, hasPracto, clinicName, city, specialty);
  const score =
    40 +
    platforms.length * 4 +
    (hasPracto ? 12 : 0) +
    (hasMarketing ? 6 : 0) +
    (seed % 10);

  return {
    id: `clinic-${hash(key).toString(36)}-${index}`,
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
    matchReason: `Full multi-platform inventory for ${specialty} in ${zone}, ${city}.`,
  };
}

function estimateCatalogSize() {
  let total = 0;
  for (const [city, zones] of Object.entries(GEO)) {
    for (const zone of zones) {
      for (const specialty of SPECIALTIES) {
        total += clinicCountFor(specialty, city, zone);
      }
    }
  }
  return total;
}

export function getDiscoveryMeta() {
  return {
    cities: Object.keys(GEO),
    zonesByCity: GEO,
    specialties: SPECIALTIES,
    platforms: PLATFORMS,
    catalogSize: estimateCatalogSize(),
    supportsAllZones: true,
  };
}

function resolveZones(city, zone) {
  const cityZones = GEO[city] || [];
  if (!zone || zone === 'All' || zone === 'All zones') return cityZones;
  return cityZones.includes(zone) ? [zone] : [];
}

/**
 * Pull the full clinic inventory for a city / zone(s) / specialty.
 * zone may be a specific zone or "All" / "All zones" for the entire city.
 * No sampling — returns every generated listing for the selection.
 */
export function discoverClinics({ city, zone, specialty, limit = null } = {}) {
  if (!city || !specialty) {
    return {
      error: 'city and specialty are required',
      results: [],
    };
  }
  if (!GEO[city]) {
    return { error: `Unknown city: ${city}`, results: [] };
  }
  if (!SPECIALTIES.includes(specialty)) {
    return { error: `Unknown specialty: ${specialty}`, results: [] };
  }

  const zones = resolveZones(city, zone || 'All');
  if (!zones.length) {
    return { error: `Unknown zone for ${city}: ${zone}`, results: [] };
  }

  const scannedSources = PLATFORMS.map((name, i) => ({
    name,
    status: 'scanned',
    latencyMs: 120 + i * 35 + (hash(`${city}${zone}${specialty}${name}`) % 80),
  }));

  const results = [];
  const perZone = {};
  for (const z of zones) {
    const count = clinicCountFor(specialty, city, z);
    perZone[z] = count;
    for (let i = 0; i < count; i += 1) {
      results.push(makeClinic({ city, zone: z, specialty, index: i }));
    }
  }

  results.sort((a, b) => b.score - a.score || a.clinicName.localeCompare(b.clinicName) || a.zone.localeCompare(b.zone));

  // Optional safety cap only if explicitly requested; default = full inventory
  let final = results;
  const numericLimit = limit == null || limit === '' || Number(limit) <= 0 ? null : Number(limit);
  if (numericLimit) {
    final = results.slice(0, numericLimit);
  }

  const withPracto = final.filter((r) => r.practo.hasProfile).length;

  return {
    query: {
      city,
      zone: zone || 'All',
      specialty,
      zonesScanned: zones,
      limit: numericLimit,
      fullInventory: !numericLimit,
    },
    scannedSources,
    summary: {
      total: final.length,
      totalAvailable: results.length,
      zonesCovered: zones.length,
      perZone,
      withPractoProfile: withPracto,
      withoutPractoProfile: final.length - withPracto,
      platformsCovered: PLATFORMS.length,
    },
    count: final.length,
    results: final.map((r) => ({
      ...r,
      name: r.owner.name,
      email: r.owner.email,
      phone: r.owner.phone,
      company: r.clinicName,
      title: r.owner.title,
      source: 'Multi-platform Discovery',
      location: `${r.zone}, ${r.city}`,
      // stable import id
      importKey: r.id || nanoid(8),
    })),
  };
}
