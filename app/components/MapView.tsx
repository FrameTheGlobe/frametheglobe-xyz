'use client';

/**
 * MapView — Leaflet map for the Iran Theater feed
 *
 * Leaflet is imported from npm (not CDN) and loaded dynamically inside
 * useEffect so it never runs on the server.
 * Always use this component via next/dynamic with ssr: false.
 */

// leaflet/dist/leaflet.css is imported in globals.css (NOT here) to keep it
// in the main CSS bundle rather than a lazy chunk that can 404 in production.
import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import type { Aircraft } from '@/lib/flights';
import { headingToCompass, altToFL, SQUAWK_LABELS } from '@/lib/flights';

// ── Types ─────────────────────────────────────────────────────────────────────
type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  region: string;
  sourceColor: string;
};

// ── Region colours (matches page.tsx) ─────────────────────────────────────────
const REGION_DOTS: Record<string, string> = {
  western:       '#c0392b',
  iranian:       '#27ae60',
  gulf:          '#8e44ad',
  'south-asian': '#2980b9',
  levant:        '#e67e22',
  analysis:      '#16a085',
  osint:         '#f0b429',
  global:        '#7f8c8d',
};

// ── Keyword → [lat, lng] lookup table ─────────────────────────────────────────
// Ordered most-specific first so multi-word terms match before single words.
const LOCATION_MAP: [string, [number, number]][] = [
  // ── Iran — nuclear sites ───────────────────────────────────────────────────
  ['natanz',            [33.72, 51.93]],
  ['fordow',            [34.88, 50.57]],
  ['parchin',           [35.52, 51.78]],
  ['arak heavy water',  [34.32, 49.00]],
  ['arak',              [34.09, 49.69]],
  ['bushehr',           [28.97, 50.84]],

  // ── Iran — cities ──────────────────────────────────────────────────────────
  ['ahvaz',             [31.32, 48.67]],
  ['bandar abbas',      [27.19, 56.28]],
  ['abadan',            [30.34, 48.30]],
  ['khuzestan',         [31.50, 49.00]],
  ['qom',               [34.64, 50.88]],
  ['shiraz',            [29.59, 52.58]],
  ['isfahan',           [32.66, 51.68]],
  ['tabriz',            [38.08, 46.30]],
  ['mashhad',           [36.29, 59.61]],
  ['urmia',             [37.55, 45.07]],
  ['kermanshah',        [34.32, 47.07]],
  ['zahedan',           [29.50, 60.86]],
  ['chabahar',          [25.29, 60.64]],
  ['tehran',            [35.69, 51.39]],
  ['irgc',              [35.69, 51.39]],
  ['khamenei',          [35.69, 51.39]],
  ['pezeshkian',        [35.69, 51.39]],
  ['iran',              [32.43, 53.69]],

  // ── Iraq ──────────────────────────────────────────────────────────────────
  ['fallujah',          [33.35, 43.77]],
  ['ramadi',            [33.43, 43.30]],
  ['tikrit',            [34.61, 43.68]],
  ['kirkuk',            [35.47, 44.39]],
  ['mosul',             [36.34, 43.13]],
  ['tal afar',          [36.37, 42.45]],
  ['sinjar',            [36.32, 41.87]],
  ['baquba',            [33.75, 44.64]],
  ['najaf',             [32.00, 44.33]],
  ['karbala',           [32.62, 44.02]],
  ['basra',             [30.51, 47.81]],
  ['nasiriyah',         [31.05, 46.26]],
  ['erbil',             [36.19, 44.01]],
  ['sulaymaniyah',      [35.56, 45.43]],
  ['duhok',             [36.87, 42.99]],
  ['pmu',               [33.34, 44.40]], // Popular Mobilization Units → Baghdad
  ['hashd',             [33.34, 44.40]],
  ['baghdad',           [33.34, 44.40]],
  ['iraq',              [33.22, 43.68]],

  // ── Syria ─────────────────────────────────────────────────────────────────
  ['raqqa',             [35.95, 39.01]],
  ['deir ez-zor',       [35.34, 40.14]],
  ['deir ezzor',        [35.34, 40.14]],
  ['al-tanf',           [33.47, 38.65]],
  ['tanf',              [33.47, 38.65]],
  ['palmyra',           [34.55, 38.27]],
  ['latakia',           [35.52, 35.79]],
  ['tartus',            [34.89, 35.89]],
  ['idlib',             [35.93, 36.63]],
  ['aleppo',            [36.20, 37.16]],
  ['hama',              [35.13, 36.76]],
  ['homs',              [34.73, 36.71]],
  ['daraa',             [32.62, 36.10]],
  ['deir al-zour',      [35.34, 40.14]],
  ['al-bukamal',        [34.46, 40.93]],
  ['qaim',              [34.44, 40.97]], // Iraq-Syria border crossing
  ['damascus',          [33.51, 36.29]],
  ['hayat tahrir',      [35.93, 36.63]], // HTS → Idlib
  ['sdf',               [36.82, 40.05]], // Syrian Democratic Forces
  ['syria',             [35.00, 38.00]],

  // ── Lebanon ───────────────────────────────────────────────────────────────
  ['tripoli',           [34.43, 35.85]], // Lebanon Tripoli
  ['bint jbeil',        [33.12, 35.43]],
  ['baalbek',           [34.00, 36.21]],
  ['nabatieh',          [33.38, 35.48]],
  ['tyre',              [33.27, 35.20]],
  ['sidon',             [33.56, 35.37]],
  ['hezbollah',         [33.55, 35.50]],
  ['beirut',            [33.89, 35.50]],
  ['lebanon',           [33.85, 35.86]],

  // ── Israel / Palestine ────────────────────────────────────────────────────
  ['tulkarm',           [32.31, 35.03]],
  ['qalqilya',          [32.19, 34.97]],
  ['hebron',            [31.53, 35.10]],
  ['jericho',           [31.86, 35.46]],
  ['bethlehem',         [31.71, 35.20]],
  ['west bank',         [32.00, 35.25]],
  ['ramallah',          [31.90, 35.21]],
  ['nablus',            [32.22, 35.26]],
  ['jenin',             [32.46, 35.30]],
  ['jabalia',           [31.53, 34.48]],
  ['beit lahia',        [31.55, 34.49]],
  ['deir al-balah',     [31.42, 34.35]],
  ['rafah',             [31.29, 34.25]],
  ['khan younis',       [31.34, 34.31]],
  ['khan yunis',        [31.34, 34.31]],
  ['gaza city',         [31.52, 34.46]],
  ['gaza',              [31.42, 34.38]],
  ['hamas',             [31.42, 34.38]],
  ['islamic jihad',     [31.42, 34.38]],
  ['pij',               [31.42, 34.38]],
  ['golan',             [33.00, 35.75]],
  ['tel aviv',          [32.09, 34.79]],
  ['haifa',             [32.82, 34.99]],
  ['beer sheva',        [31.25, 34.79]],
  ['eilat',             [29.56, 34.95]],
  ['dimona',            [31.07, 35.03]], // Israel nuclear site
  ['jerusalem',         [31.78, 35.22]],
  ['netanyahu',         [31.78, 35.22]],
  ['idf',               [31.50, 34.80]],
  ['mossad',            [31.50, 34.80]],
  ['shin bet',          [31.50, 34.80]],
  ['israel',            [31.50, 34.80]],

  // ── Yemen ─────────────────────────────────────────────────────────────────
  ['taiz',              [13.58, 44.02]],
  ['hajjah',            [15.69, 43.60]],
  ['dhamar',            [14.55, 44.41]],
  ['ibb',               [13.98, 44.18]],
  ['mukalla',           [14.52, 49.12]],
  ['socotra',           [12.46, 53.82]],
  ['aden',              [12.80, 45.03]],
  ['hudaydah',          [14.80, 42.95]],
  ['hodeidah',          [14.80, 42.95]],
  ['marib',             [15.48, 45.33]],
  ['ansarallah',        [15.35, 44.21]],
  ['houthis',           [15.35, 44.21]],
  ['houthi',            [15.35, 44.21]],
  ['sanaa',             [15.35, 44.21]],
  ['sana\'a',           [15.35, 44.21]],
  ['yemen',             [15.91, 47.59]],

  // ── Saudi Arabia ──────────────────────────────────────────────────────────
  ['abha',              [18.22, 42.51]],
  ['jazan',             [16.89, 42.57]],
  ['tabuk',             [28.38, 36.57]],
  ['dhahran',           [26.28, 50.11]],
  ['aramco',            [26.27, 50.18]],
  ['abqaiq',            [25.92, 49.67]], // oil facility target
  ['khurais',           [25.04, 48.76]], // oil facility target
  ['riyadh',            [24.69, 46.72]],
  ['jeddah',            [21.54, 39.17]],
  ['mecca',             [21.39, 39.86]],
  ['medina',            [24.47, 39.61]],
  ['saudi',             [23.89, 45.08]],

  // ── UAE ───────────────────────────────────────────────────────────────────
  ['sharjah',           [25.36, 55.39]],
  ['dubai',             [25.20, 55.27]],
  ['abu dhabi',         [24.45, 54.38]],
  ['uae',               [24.47, 54.37]],

  // ── Qatar ─────────────────────────────────────────────────────────────────
  ['al udeid',          [25.12, 51.31]], // US air base
  ['doha',              [25.29, 51.53]],
  ['qatar',             [25.35, 51.18]],

  // ── Kuwait ────────────────────────────────────────────────────────────────
  ['kuwait city',       [29.38, 47.99]],
  ['kuwait',            [29.31, 47.48]],

  // ── Bahrain ───────────────────────────────────────────────────────────────
  ['fifth fleet',       [26.22, 50.59]], // US 5th Fleet → Manama
  ['manama',            [26.22, 50.59]],
  ['bahrain',           [26.07, 50.56]],

  // ── Oman ──────────────────────────────────────────────────────────────────
  ['sohar',             [24.36, 56.75]],
  ['salalah',           [17.02, 54.10]],
  ['muscat',            [23.61, 58.59]],
  ['oman',              [21.51, 55.92]],

  // ── Jordan ────────────────────────────────────────────────────────────────
  ['tower 22',          [31.81, 38.20]], // US base in Jordan
  ['amman',             [31.95, 35.93]],
  ['aqaba',             [29.53, 35.00]],
  ['jordan',            [31.24, 36.51]],

  // ── Egypt ─────────────────────────────────────────────────────────────────
  ['port said',         [31.26, 32.28]],
  ['ismailia',          [30.59, 32.27]],
  ['sinai',             [29.50, 34.00]],
  ['alexandria',        [31.20, 29.92]],
  ['cairo',             [30.04, 31.23]],
  ['suez canal',        [30.50, 32.35]],
  ['suez',              [29.97, 32.54]],
  ['egypt',             [26.82, 30.80]],

  // ── Turkey ────────────────────────────────────────────────────────────────
  ['incirlik',          [37.00, 35.43]], // US air base
  ['izmir',             [38.42, 27.14]],
  ['ankara',            [39.93, 32.87]],
  ['istanbul',          [41.01, 28.96]],
  ['turkey',            [38.96, 35.24]],
  ['türkiye',           [38.96, 35.24]],

  // ── Pakistan / Afghanistan ─────────────────────────────────────────────────
  ['lahore',            [31.55, 74.34]],
  ['quetta',            [30.19, 67.01]],
  ['islamabad',         [33.72, 73.04]],
  ['peshawar',          [34.01, 71.57]],
  ['karachi',           [24.86, 67.01]],
  ['pakistan',          [30.38, 69.35]],
  ['kandahar',          [31.62, 65.70]],
  ['herat',             [34.35, 62.20]],
  ['jalalabad',         [34.43, 70.45]],
  ['kabul',             [34.53, 69.17]],
  ['taliban',           [33.94, 67.71]],
  ['afghanistan',       [33.94, 67.71]],

  // ── Libya ─────────────────────────────────────────────────────────────────
  ['tripoli, libya',    [32.89, 13.18]],
  ['benghazi',          [32.12, 20.07]],
  ['misrata',           [32.38, 15.09]],
  ['libya',             [26.34, 17.23]],

  // ── Sudan ─────────────────────────────────────────────────────────────────
  ['port sudan',        [19.61, 37.22]],
  ['khartoum',          [15.50, 32.56]],
  ['sudan',             [12.86, 30.22]],

  // ── Azerbaijan / Caucasus ──────────────────────────────────────────────────
  ['baku',              [40.41, 49.87]],
  ['nagorno-karabakh',  [39.82, 46.76]],
  ['azerbaijan',        [40.14, 47.58]],
  ['yerevan',           [40.18, 44.51]],
  ['armenia',           [40.07, 45.04]],

  // ── Sea lanes & chokepoints ───────────────────────────────────────────────
  ['strait of hormuz',  [26.59, 56.26]],
  ['hormuz',            [26.59, 56.26]],
  ['gulf of oman',      [23.00, 58.50]],
  ['persian gulf',      [27.00, 51.00]],
  ['bab el-mandeb',     [12.58, 43.35]],
  ['bab-el-mandeb',     [12.58, 43.35]],
  ['gulf of aden',      [12.50, 47.00]],
  ['red sea',           [20.00, 38.00]],
  ['arabian sea',       [17.00, 65.00]],
  ['mediterranean',     [34.00, 18.00]],
  ['caspian sea',       [41.00, 50.50]],
  ['indian ocean',      [ 5.00, 65.00]],

  // ── Global players — mapped to capital / HQ ───────────────────────────────
  ['pentagon',          [38.87,  -77.06]],
  ['centcom',           [25.20,   55.27]],
  ['nato',              [50.88,    4.42]], // Brussels
  ['washington',        [38.90,  -77.04]],
  ['white house',       [38.90,  -77.04]],
  ['state department',  [38.90,  -77.04]],
  ['london',            [51.51,   -0.13]],
  ['paris',             [48.86,    2.35]],
  ['berlin',            [52.52,   13.40]],
  ['brussels',          [50.85,    4.35]],
  ['geneva',            [46.20,    6.15]],
  ['vienna',            [48.21,   16.37]], // IAEA HQ
  ['iaea',              [48.21,   16.37]],
  ['moscow',            [55.76,   37.62]],
  ['beijing',           [39.91,  116.39]],
  ['new york',          [40.71,  -74.01]],
  ['united nations',    [40.75,  -73.97]],
];

// ── Extract best-matching location from an article ────────────────────────────
function extractLocation(item: FeedItem): { name: string; coords: [number, number] } | null {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  for (const [kw, coords] of LOCATION_MAP) {
    if (text.includes(kw)) {
      return { name: kw.charAt(0).toUpperCase() + kw.slice(1), coords };
    }
  }
  return null;
}

// ── Deterministic coordinate jitter to prevent overlapping circles ─────────────
function jitter(str: string, range = 0.6): [number, number] {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h |= 0;
  }
  const lat = ((h & 0xFFFF) / 0xFFFF - 0.5) * range;
  const lng = (((h >>> 16) & 0xFFFF) / 0xFFFF - 0.5) * range;
  return [lat, lng];
}

// ── Time helper ───────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Leaflet loader — dynamic import keeps it out of the SSR bundle ────────────
async function loadLeaflet() {
  const L = (await import('leaflet')).default;
  // Fix the default icon marker paths that webpack breaks
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: '/marker-icon-2x.png',
    iconUrl:       '/marker-icon.png',
    shadowUrl:     '/marker-shadow.png',
  });
  return L;
}

// ── Aircraft country → icon colour ───────────────────────────────────────────
const COUNTRY_COLORS: Record<string, string> = {
  'United States': '#4a9eff',
  'Israel':        '#7ec8e3',
  'Iran':          '#27ae60',
  'United Kingdom':'#c39bd3',
  'France':        '#85c1e9',
  'Russia':        '#e74c3c',
  'China':         '#f39c12',
  'Saudi Arabia':  '#f7dc6f',
  'UAE':           '#a9cce3',
  'Turkey':        '#e8daef',
};
const AIRCRAFT_DEFAULT_COLOR = 'rgba(255,255,255,0.55)';
const STRATEGIC_COLOR        = '#ff9800';

function aircraftColor(a: Aircraft): string {
  if (a.isStrategic) return STRATEGIC_COLOR;
  return COUNTRY_COLORS[a.country] ?? AIRCRAFT_DEFAULT_COLOR;
}

// Build an SVG directional arrow for use as a Leaflet divIcon
function buildAircraftSVG(heading: number, color: string, size: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"
    style="transform:rotate(${heading}deg);transform-origin:50% 50%;display:block">
    <polygon points="12,2 16,19 12,15 8,19"
      fill="${color}" stroke="rgba(0,0,0,0.55)" stroke-width="1.2"/>
  </svg>`;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
interface MapViewProps {
  items: FeedItem[];
}

const FLIGHT_POLL_MS = 60_000; // re-fetch flights every 60 s (server caches for 5 min)

export default function MapView({ items }: MapViewProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef        = useRef<any>(null);
  const mapReadyRef   = useRef(false);

  // ── Flight layer state ────────────────────────────────────────────────────
  const [flightsOn,      setFlightsOn]      = useState(false);
  const [flights,        setFlights]        = useState<Aircraft[]>([]);
  const [flightStatus,   setFlightStatus]   = useState<'idle'|'loading'|'ok'|'error'>('idle');
  const [flightUpdated,  setFlightUpdated]  = useState<string | null>(null);
  const flightTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Legend collapsed state (useful on small screens) ──────────────────────
  const [legendOpen, setLegendOpen] = useState(true);

  // How many news items have a mappable location?
  const mappedCount = useMemo(
    () => items.filter(i => extractLocation(i) !== null).length,
    [items]
  );

  const strategicCount = useMemo(
    () => flights.filter(f => f.isStrategic).length,
    [flights]
  );

  // ── Fetch flights from our server endpoint ────────────────────────────────
  const loadFlights = useCallback(async () => {
    setFlightStatus('loading');
    try {
      const res  = await fetch('/api/flights');
      const data = await res.json() as {
        aircraft: Aircraft[]; fetchedAt: string; source: string;
      };
      setFlights(data.aircraft ?? []);
      setFlightUpdated(data.fetchedAt ?? null);
      setFlightStatus('ok');
    } catch {
      setFlightStatus('error');
    }
  }, []);

  // ── Toggle flights on/off ─────────────────────────────────────────────────
  useEffect(() => {
    if (flightsOn) {
      loadFlights();
      flightTimerRef.current = setInterval(loadFlights, FLIGHT_POLL_MS);
    } else {
      if (flightTimerRef.current) clearInterval(flightTimerRef.current);
      setFlights([]);
      setFlightStatus('idle');
    }
    return () => { if (flightTimerRef.current) clearInterval(flightTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightsOn]);

  // ── Initialize Leaflet map once ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function init() {
      const L = await loadLeaflet();
      if (cancelled || !containerRef.current || mapReadyRef.current) return;

      const map = L.map(containerRef.current, {
        center:          [27, 47],
        zoom:            4,
        minZoom:         2,
        maxZoom:         12,
        zoomControl:     true,
        preferCanvas:    true,   // better performance for many markers
      });

      // Dark CartoDB tiles — free, no API key required
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          subdomains:  'abcd',
          maxZoom:     20,
        }
      ).addTo(map);

      mapRef.current      = map;
      mapReadyRef.current = true;

      // invalidateSize ensures Leaflet recalculates container dimensions
      // after React finishes painting (needed when inside flex/grid layouts)
      requestAnimationFrame(() => {
        map.invalidateSize();
        paintMarkers(L, map, items);
      });
    }

    init().catch(err => console.error('[FTG MapView] init error:', err));
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-paint news markers when items change ───────────────────────────────
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;
    void loadLeaflet().then(L => {
      if (!mapRef.current) return;
      mapRef.current.invalidateSize();
      paintMarkers(L, mapRef.current, items);
    });
  }, [items]);

  // ── Re-paint flight layer when flights change ─────────────────────────────
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;
    void loadLeaflet().then(L => {
      if (!mapRef.current) return;
      if (flightsOn) {
        paintFlights(L, mapRef.current, flights);
      } else {
        clearFlightLayer(mapRef.current);
      }
    });
  }, [flights, flightsOn]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current      = null;
        mapReadyRef.current = false;
      }
    };
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border)' }}>

      {/* Map container */}
      <div
        ref={containerRef}
        className="ftg-map-container"
        style={{ width: '100%', height: '72vh', minHeight: 440, background: '#0d0c0a' }}
      />

      {/* ── Flights toggle button (top-left) ─────────────────────────────── */}
      <div style={{
        position:  'absolute',
        top:       10,
        left:      10,
        zIndex:    1000,
        display:   'flex',
        flexDirection: 'column',
        gap:       6,
      }}>
        <button
          onClick={() => setFlightsOn(v => !v)}
          style={{
            fontFamily:     'IBM Plex Mono, monospace',
            fontSize:       10,
            letterSpacing:  '0.06em',
            padding:        '5px 10px',
            borderRadius:   3,
            border:         `1px solid ${flightsOn ? STRATEGIC_COLOR : 'rgba(255,255,255,0.18)'}`,
            background:     flightsOn ? 'rgba(255,152,0,0.18)' : 'rgba(13,12,10,0.82)',
            color:          flightsOn ? STRATEGIC_COLOR : 'rgba(255,255,255,0.6)',
            cursor:         'pointer',
            backdropFilter: 'blur(6px)',
            display:        'flex',
            alignItems:     'center',
            gap:            6,
            transition:     'all 0.15s',
          }}
        >
          <span style={{ fontSize: 14 }}>✈</span>
          {flightsOn
            ? flightStatus === 'loading' ? 'Loading…'
              : `${flights.length} aircraft${strategicCount > 0 ? ` · ⚡${strategicCount} strategic` : ''}`
            : 'Live Flights'}
        </button>

        {/* Flight status / last updated */}
        {flightsOn && flightStatus === 'ok' && flightUpdated && (
          <div style={{
            fontFamily:     'IBM Plex Mono, monospace',
            fontSize:       8,
            color:          'rgba(255,255,255,0.35)',
            letterSpacing:  '0.05em',
            background:     'rgba(13,12,10,0.7)',
            padding:        '3px 7px',
            borderRadius:   2,
            backdropFilter: 'blur(4px)',
          }}>
            ADS-B · updated {timeAgo(flightUpdated)} · 60 s refresh
          </div>
        )}
        {flightsOn && flightStatus === 'error' && (
          <div style={{
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: 8,
            color: '#e74c3c',
            letterSpacing: '0.05em',
            background: 'rgba(13,12,10,0.7)',
            padding: '3px 7px',
            borderRadius: 2,
          }}>
            Flight data unavailable
          </div>
        )}
      </div>

      {/* ── Stats overlay (bottom-left) ─────────────────────────────────── */}
      <div style={{
        position:       'absolute',
        bottom:         10,
        left:           10,
        zIndex:         1000,
        background:     'rgba(13,12,10,0.82)',
        border:         '1px solid rgba(255,255,255,0.10)',
        borderRadius:   3,
        padding:        '5px 10px',
        fontFamily:     'IBM Plex Mono, monospace',
        fontSize:       9,
        color:          'rgba(255,255,255,0.45)',
        letterSpacing:  '0.06em',
        backdropFilter: 'blur(6px)',
        pointerEvents:  'none',
      }}>
        {mappedCount} news events · {flightsOn ? `${flights.length} aircraft` : 'flights off'} · click any marker
      </div>

      {/* ── Legend (top-right, collapsible) ─────────────────────────────── */}
      <div style={{
        position:       'absolute',
        top:            10,
        right:          10,
        zIndex:         1000,
        background:     'rgba(13,12,10,0.82)',
        border:         '1px solid rgba(255,255,255,0.10)',
        borderRadius:   3,
        fontFamily:     'IBM Plex Mono, monospace',
        fontSize:       9,
        color:          'rgba(255,255,255,0.5)',
        letterSpacing:  '0.06em',
        backdropFilter: 'blur(6px)',
        minWidth:       90,
      }}>
        {/* Toggle header */}
        <button
          onClick={() => setLegendOpen(v => !v)}
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            gap:            8,
            width:          '100%',
            padding:        '6px 10px',
            background:     'transparent',
            border:         'none',
            cursor:         'pointer',
            color:          'rgba(255,255,255,0.45)',
            fontFamily:     'IBM Plex Mono, monospace',
            fontSize:       9,
            letterSpacing:  '0.08em',
          }}
          aria-label={legendOpen ? 'Collapse legend' : 'Expand legend'}
        >
          <span style={{ textTransform: 'uppercase' }}>Legend</span>
          <span style={{ fontSize: 8, opacity: 0.6 }}>{legendOpen ? '▲' : '▼'}</span>
        </button>

        {/* Collapsible content */}
        {legendOpen && (
          <div style={{
            padding:   '0 10px 8px',
            display:   'flex',
            flexDirection: 'column',
            gap:       4,
            maxHeight: '45vh',
            overflowY: 'auto',
          }}>
            {/* News legend */}
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>News</div>
            {Object.entries(REGION_DOTS).map(([region, color]) => (
              <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ textTransform: 'capitalize' }}>{region.replace('-', ' ')}</span>
              </div>
            ))}

            {/* Flight legend (only show when flights enabled) */}
            {flightsOn && flights.length > 0 && (
              <>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 6, marginBottom: 2 }}>Aircraft</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10 }}>▲</span>
                  <span style={{ color: STRATEGIC_COLOR }}>⚡ Strategic/Military</span>
                </div>
                {Object.entries(COUNTRY_COLORS)
                  .filter(([country]) => flights.some(f => f.country === country && !f.isStrategic))
                  .map(([country, color]) => (
                    <div key={country} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, color }}>▲</span>
                      <span>{country}</span>
                    </div>
                  ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: AIRCRAFT_DEFAULT_COLOR }}>▲</span>
                  <span>Other</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Marker painting (called on init + every items update) ─────────────────────
const MARKER_LAYER_KEY = '__ftg_markers__';

function paintMarkers(L: any, map: any, items: FeedItem[]) {
  // Remove existing marker layer group if present
  if ((map as any)[MARKER_LAYER_KEY]) {
    (map as any)[MARKER_LAYER_KEY].clearLayers();
  } else {
    (map as any)[MARKER_LAYER_KEY] = L.layerGroup().addTo(map);
  }

  const group = (map as any)[MARKER_LAYER_KEY];

  items.forEach(item => {
    const loc = extractLocation(item);
    if (!loc) return;

    const [jLat, jLng] = jitter(item.link || item.title);
    const lat   = loc.coords[0] + jLat;
    const lng   = loc.coords[1] + jLng;
    const color = REGION_DOTS[item.region] || '#7f8c8d';

    const circle = L.circleMarker([lat, lng], {
      radius:      5,
      fillColor:   color,
      color:       color,
      weight:      1,
      opacity:     0.9,
      fillOpacity: 0.65,
    });

    // Escape HTML to prevent XSS in popup
    const safeTitle  = esc(item.title);
    const safeSrc    = esc(item.sourceName);
    const safeLoc    = esc(loc.name);
    const safeLink   = encodeURI(item.link);
    const safeTime   = esc(timeAgo(item.pubDate));

    const popupHTML = `
      <div class="ftg-popup">
        <div class="ftg-popup-source" style="color:${color}">${safeSrc}</div>
        <div class="ftg-popup-title">${safeTitle}</div>
        <div class="ftg-popup-meta">${safeLoc} · ${safeTime}</div>
        <a class="ftg-popup-link" href="${safeLink}" target="_blank" rel="noopener noreferrer">Read →</a>
      </div>
    `;

    circle.bindPopup(popupHTML, { className: 'ftg-leaflet-popup', maxWidth: 260 });
    group.addLayer(circle);
  });
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Flight layer painting ─────────────────────────────────────────────────────
const FLIGHT_LAYER_KEY = '__ftg_flights__';

function paintFlights(L: any, map: any, aircraft: Aircraft[]) {
  // Ensure layer group exists
  if (!(map as any)[FLIGHT_LAYER_KEY]) {
    (map as any)[FLIGHT_LAYER_KEY] = L.layerGroup().addTo(map);
  }
  const group: any = (map as any)[FLIGHT_LAYER_KEY];
  group.clearLayers();

  aircraft.forEach(a => {
    if (typeof a.lat !== 'number' || typeof a.lon !== 'number') return;
    if (a.lat === 0 && a.lon === 0) return;

    const color   = aircraftColor(a);
    const size    = a.isStrategic ? 22 : 16;
    const svgHtml = buildAircraftSVG(a.heading ?? 0, color, size);

    const icon = L.divIcon({
      html:        svgHtml,
      className:   'ftg-aircraft-icon',
      iconSize:    [size, size],
      iconAnchor:  [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });

    const marker = L.marker([a.lat, a.lon], { icon, zIndexOffset: 200 });

    // ── Popup content ───────────────────────────────────────────────────────
    const callsign  = esc(a.callsign  || a.hex || '—');
    const reg       = esc(a.registration || '—');
    const typeCode  = esc(a.typeCode  || '—');
    const country   = esc(a.country   || '—');
    const altStr    = a.altFt > 0  ? esc(altToFL(a.altFt))        : 'GND';
    const spdStr    = a.speedKts > 0 ? `${Math.round(a.speedKts)} kts` : '—';
    const hdgStr    = a.heading  > 0 ? `${Math.round(a.heading)}° ${esc(headingToCompass(a.heading))}` : '—';
    const sqkLabel  = SQUAWK_LABELS[a.squawk] ? ` <b style="color:#e74c3c">${esc(SQUAWK_LABELS[a.squawk])}</b>` : '';
    const sqkStr    = a.squawk ? `${esc(a.squawk)}${sqkLabel}` : '—';
    const strategic = a.isStrategic
      ? `<div style="color:${STRATEGIC_COLOR};font-weight:600;margin-bottom:4px">⚡ ${esc(a.strategicHint || 'Strategic')}</div>`
      : '';

    const popupHTML = `
      <div class="ftg-popup">
        ${strategic}
        <div class="ftg-popup-source" style="color:${color}">${callsign}${reg !== callsign && reg !== '—' ? ` · ${reg}` : ''}</div>
        <div class="ftg-popup-title">${typeCode} · ${country}</div>
        <div class="ftg-popup-meta" style="line-height:1.7">
          <span>Alt: ${altStr}</span> &nbsp;
          <span>Spd: ${spdStr}</span> &nbsp;
          <span>Hdg: ${hdgStr}</span><br/>
          <span>Squawk: ${sqkStr}</span>
        </div>
        <a class="ftg-popup-link"
           href="https://globe.adsbexchange.com/?icao=${esc(a.hex)}"
           target="_blank" rel="noopener noreferrer">Track on ADS-B Exchange →</a>
      </div>
    `;

    marker.bindPopup(popupHTML, { className: 'ftg-leaflet-popup', maxWidth: 280 });
    group.addLayer(marker);
  });
}

function clearFlightLayer(map: any) {
  if ((map as any)[FLIGHT_LAYER_KEY]) {
    (map as any)[FLIGHT_LAYER_KEY].clearLayers();
  }
}
