/**
 * lib/flights.ts
 *
 * Fetches live ADS-B aircraft positions for the Iran War Theater using the
 * free adsb.lol community API (no API key, no registration required).
 *
 * Primary endpoint: https://api.adsb.lol/v2/point/{lat}/{lon}/{radius_nm}
 *   → All aircraft within radius of the theater center
 *
 * All ADS-B data is publicly broadcast by aircraft transponders — the same
 * data used by FlightRadar24, FlightAware, ADS-B Exchange, etc.
 *
 * Caching: 5-minute server-side TTL to respect rate limits.
 */


// ── Types ─────────────────────────────────────────────────────────────────────
export type Aircraft = {
  hex:          string;   // ICAO 24-bit address (hex)
  callsign:     string;   // flight number / military callsign
  registration: string;   // tail number (when available)
  typeCode:     string;   // ICAO aircraft type code, e.g. "C17", "B738"
  country:      string;   // estimated country from hex range
  lat:          number;
  lon:          number;
  altFt:        number;   // barometric altitude in feet
  speedKts:     number;   // ground speed in knots
  heading:      number;   // track (degrees, 0 = North, clockwise)
  vertRateFpm:  number;   // vertical rate in feet per minute
  squawk:       string;   // transponder squawk code
  category:     string;   // ADS-B emitter category (A1-C7)
  seenSecs:     number;   // seconds since last ADS-B message
  isStrategic:  boolean;  // military / government / ISR
  strategicHint:string;   // human-readable reason e.g. "US Military", "ISR Pattern"
};

export type FlightPayload = {
  aircraft:  Aircraft[];
  total:     number;
  strategic: number;      // count of strategic aircraft
  fetchedAt: string;
  source:    'adsblol' | 'stale' | 'error';
};

// ── Theater bounding box ──────────────────────────────────────────────────────
// Covers: Yemen → Turkey, Egypt → Pakistan
export const THEATER_BOUNDS = { lamin: 10, lomin: 25, lamax: 50, lomax: 75 };
// Center + radius for adsb.lol (lat=30, lon=50, ~2200nm covers the theater)
const THEATER_CENTER = { lat: 30, lon: 50, radiusNm: 2200 };

// ── ICAO 24-bit hex ranges → country ─────────────────────────────────────────
// Source: ICAO Doc 9684 Annex 10 / community databases
const HEX_COUNTRY_RANGES: [number, number, string][] = [
  [0xA00000, 0xAFFFFF, 'United States'],
  [0x400000, 0x43FFFF, 'United Kingdom'],
  [0x380000, 0x3BFFFF, 'France'],
  [0x3C0000, 0x3FFFFF, 'Germany'],
  [0x480000, 0x4BFFFF, 'Netherlands'],
  [0x500000, 0x53FFFF, 'Italy'],
  [0x600000, 0x6FFFFF, 'Russia'],
  [0x700000, 0x73FFFF, 'Israel'],
  [0x730000, 0x737FFF, 'Iran'],
  [0x710000, 0x717FFF, 'Turkey'],
  [0x760000, 0x76FFFF, 'Pakistan'],
  [0x780000, 0x7BFFFF, 'China'],
  [0x800000, 0x83FFFF, 'Australia'],
  [0x860000, 0x87FFFF, 'India'],
  [0x880000, 0x887FFF, 'Yemen'],
  [0x888000, 0x88FFFF, 'Oman'],
  [0x890000, 0x8AFFFF, 'Saudi Arabia'],
  [0x896000, 0x8973FF, 'Saudi Arabia'],
  [0x897C00, 0x897FFF, 'Qatar'],
  [0x898000, 0x8983FF, 'Kuwait'],
  [0x898400, 0x8987FF, 'Bahrain'],
  [0x899000, 0x899FFF, 'UAE'],
  [0x89C000, 0x89FFFF, 'UAE'],
  [0x8A0000, 0x8AFFFF, 'Iraq'],
  [0x02A000, 0x02AFFF, 'Jordan'],
  [0x018000, 0x01FFFF, 'Egypt'],
];

// ── US Military hex ranges (approximate, from community databases) ────────────
const US_MILITARY_HEX: [number, number][] = [
  [0xADF000, 0xADFFFF],
  [0xAE0000, 0xAE3FFF],
  [0xAE4000, 0xAE7FFF],
  [0xAE8000, 0xAEFFFF],
  [0xAF0000, 0xAFFFFF],
];

// ── Callsign patterns indicating military / government / ISR operations ────────
type CallsignRule = { prefix: string; hint: string };
const STRATEGIC_CALLSIGNS: CallsignRule[] = [
  // USAF Air Mobility Command (C-17, C-5, KC-135, KC-46 tankers/transports)
  { prefix: 'RCH',    hint: 'USAF Air Mobility' },
  { prefix: 'REACH',  hint: 'USAF Air Mobility' },
  // USAF Special Air Mission (VIP / executive)
  { prefix: 'SAM',    hint: 'USAF VIP' },
  { prefix: 'EXEC',   hint: 'US Executive' },
  // US State Dept aircraft
  { prefix: 'SPAR',   hint: 'US State Dept' },
  // USAF Combat / ISR
  { prefix: 'JAKE',   hint: 'USAF Combat' },
  { prefix: 'DUKE',   hint: 'USAF Combat' },
  { prefix: 'IRON',   hint: 'USAF Combat' },
  { prefix: 'COVE',   hint: 'USAF Ops' },
  { prefix: 'FORTE',  hint: 'USAF ISR' },
  { prefix: 'GRIM',   hint: 'USAF Combat' },
  { prefix: 'MAGMA',  hint: 'USAF Special Ops' },
  { prefix: 'PACK',   hint: 'USAF Ops' },
  { prefix: 'ZEUS',   hint: 'Military' },
  { prefix: 'COBRA',  hint: 'Military' },
  { prefix: 'VIPER',  hint: 'Military' },
  { prefix: 'WRATH',  hint: 'Military' },
  // RAF (UK)
  { prefix: 'RRR',    hint: 'RAF' },
  { prefix: 'ASCOT',  hint: 'RAF Air Mobility' },
  { prefix: 'TARTAN', hint: 'RAF' },
  // Israeli Air Force (when broadcasting)
  { prefix: 'IAF',    hint: 'Israeli Air Force' },
  { prefix: 'HATZERIM', hint: 'Israeli Air Force' },
  // French Air Force
  { prefix: 'FAF',    hint: 'French Air Force' },
  { prefix: 'CTM',    hint: 'French Military' },
  // German Air Force
  { prefix: 'GAF',    hint: 'German Air Force' },
  // NATO AWACS
  { prefix: 'NATO',   hint: 'NATO' },
  // Maritime Patrol
  { prefix: 'SHARK',  hint: 'Maritime Patrol' },
];

// ── Aircraft type codes that suggest strategic/military missions ───────────────
const STRATEGIC_TYPES = new Set([
  // Tankers
  'KC135', 'KC10', 'KC46', 'MRTT', 'A330', 'IL78',
  // Transports
  'C17', 'C5', 'C130', 'C2', 'IL76', 'AN124', 'AN26',
  // ISR / SIGINT
  'RC135', 'U2', 'P8', 'P3', 'EP3', 'E3', 'E8', 'E6', 'E4', 'E7',
  'G550', 'G5', 'G650',  // often converted for ISR/ELINT
  // Bombers
  'B52', 'B1', 'B2',
  // Fighters / Strike (when broadcasting ADS-B)
  'F15', 'F16', 'F18', 'F22', 'F35', 'A10', 'AV8',
  'EUFI', 'TYPHOON', 'RAFALE', 'GRIPEN', 'F4',
  // AWACS / AEW
  'E767', 'B735',
  // UAV (when transponder fitted)
  'GLOB',   // RQ-4 Global Hawk type code
]);

// ── Interesting squawk codes ──────────────────────────────────────────────────
export const SQUAWK_LABELS: Record<string, string> = {
  '7500': '🔴 HIJACK',
  '7600': '🟡 COMMS LOST',
  '7700': '🔴 EMERGENCY',
  '7777': '⚠ MILITARY INTERCEPT',
  '0000': 'TRANSPONDER OFF',
};

// ── Module-level cache ────────────────────────────────────────────────────────
let _cache:     FlightPayload | null = null;
let _lastFetch: number               = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexToInt(hex: string): number {
  return parseInt(hex, 16);
}

function countryFromHex(hex: string): string {
  const n = hexToInt(hex);
  for (const [lo, hi, country] of HEX_COUNTRY_RANGES) {
    if (n >= lo && n <= hi) return country;
  }
  return 'Unknown';
}

function isUSMilitary(hex: string): boolean {
  const n = hexToInt(hex);
  return US_MILITARY_HEX.some(([lo, hi]) => n >= lo && n <= hi);
}

function classifyAircraft(
  hex: string,
  callsign: string,
  typeCode: string,
  country: string,
): { isStrategic: boolean; hint: string } {
  const cs = (callsign || '').trim().toUpperCase();
  const tc = (typeCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // US military hex block
  if (isUSMilitary(hex)) {
    return { isStrategic: true, hint: 'US Military' };
  }

  // Callsign pattern match
  for (const rule of STRATEGIC_CALLSIGNS) {
    if (cs.startsWith(rule.prefix.toUpperCase())) {
      return { isStrategic: true, hint: rule.hint };
    }
  }

  // Aircraft type
  if (STRATEGIC_TYPES.has(tc)) {
    return { isStrategic: true, hint: `${tc} (${country})` };
  }

  // Israel military (hex in Israeli range, not commercial El Al)
  if (country === 'Israel' && !cs.startsWith('ELY') && !cs.startsWith('ISR')) {
    const n = hexToInt(hex);
    // Israeli military tends to cluster in upper part of their range
    if (n >= 0x738000 && n <= 0x73FFFF) {
      return { isStrategic: true, hint: 'Israeli Military' };
    }
  }

  return { isStrategic: false, hint: '' };
}

function inTheaterBounds(lat: number, lon: number): boolean {
  return lat >= THEATER_BOUNDS.lamin && lat <= THEATER_BOUNDS.lamax &&
         lon >= THEATER_BOUNDS.lomin && lon <= THEATER_BOUNDS.lomax;
}

// Heading in degrees → compass abbreviation
export function headingToCompass(deg: number): string {
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}

// Altitude → flight level string
export function altToFL(ft: number): string {
  if (ft >= 18_000) return `FL${Math.round(ft / 100).toString().padStart(3, '0')}`;
  return `${ft.toLocaleString()} ft`;
}

// ── Parse adsb.lol aircraft objects ──────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseAdsbLol(raw: any): Aircraft | null {
  if (!raw || raw.lat == null || raw.lon == null) return null;
  if (raw.on_ground === true) return null;                // skip ground traffic
  const altFt = typeof raw.alt_baro === 'number' ? Math.round(raw.alt_baro) : 0;
  if (altFt < 500) return null;                           // skip very low / ground

  const hex         = (raw.hex || '').toLowerCase().trim();
  const callsign    = (raw.flight || raw.callsign || '').trim();
  const registration= (raw.r || '').trim();
  const typeCode    = (raw.t || '').trim();
  const country     = countryFromHex(hex);
  const lat         = raw.lat as number;
  const lon         = raw.lon as number;
  const speedKts    = typeof raw.gs === 'number' ? Math.round(raw.gs) : 0;
  const heading     = typeof raw.track === 'number' ? raw.track : 0;
  const vertRateFpm = typeof raw.baro_rate === 'number'
    ? Math.round(raw.baro_rate)
    : typeof raw.vert_rate === 'number'
    ? Math.round(raw.vert_rate * 197)   // m/s → fpm
    : 0;
  const squawk      = (raw.squawk || '').trim();
  const category    = (raw.category || '').trim();
  const seenSecs    = typeof raw.seen === 'number' ? raw.seen : 0;

  if (!inTheaterBounds(lat, lon)) return null;

  const { isStrategic, hint } = classifyAircraft(hex, callsign, typeCode, country);

  return {
    hex, callsign: callsign || hex.toUpperCase(),
    registration, typeCode, country,
    lat, lon, altFt, speedKts, heading, vertRateFpm,
    squawk, category, seenSecs,
    isStrategic, strategicHint: hint,
  };
}

// ── Main fetch function ───────────────────────────────────────────────────────
export async function fetchFlights(): Promise<FlightPayload> {
  const now = Date.now();

  // Return fresh cache immediately
  if (_cache && now - _lastFetch < CACHE_TTL_MS) return _cache;

  // ── Try adsb.lol first (community, no key, permissive limits) ──────────────
  const controller = new AbortController();
  const timeout    = setTimeout(() => controller.abort(), 10_000);
  try {
    const { lat, lon, radiusNm } = THEATER_CENTER;
    const url  = `https://api.adsb.lol/v2/point/${lat}/${lon}/${radiusNm}`;
    const resp = await fetch(url, {
      signal:  controller.signal,
      headers: { 'User-Agent': 'FrameTheGlobe/1.0 (+https://frametheglobe.xyz)' },
    });

    if (!resp.ok) throw new Error(`adsb.lol ${resp.status}`);
    const data = await resp.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawList: any[] = data?.ac ?? data?.aircraft ?? [];
    const aircraft: Aircraft[] = rawList
      .map(parseAdsbLol)
      .filter((a): a is Aircraft => a !== null);

    const payload: FlightPayload = {
      aircraft,
      total:     aircraft.length,
      strategic: aircraft.filter(a => a.isStrategic).length,
      fetchedAt: new Date().toISOString(),
      source:    'adsblol',
    };

    _cache     = payload;
    _lastFetch = now;
    return payload;

  } catch (err1) {
    console.warn('[FTG] adsb.lol flight fetch failed:', (err1 as Error).message);
  } finally {
    clearTimeout(timeout);
  }

  // ── Both failed — return stale cache or empty ─────────────────────────────
  if (_cache) {
    return { ..._cache, source: 'stale' };
  }
  return { aircraft: [], total: 0, strategic: 0, fetchedAt: new Date().toISOString(), source: 'error' };
}

export function getFlightsCache(): FlightPayload | null {
  return _cache;
}

export function isFlightCacheStale(): boolean {
  return Date.now() - _lastFetch > CACHE_TTL_MS;
}
