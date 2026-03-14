/**
 * acled.ts
 *
 * Fetches conflict event data from the ACLED (Armed Conflict Location &
 * Event Data) free API. Register for a free key at:
 *   https://developer.acleddata.com/
 *
 * Set these environment variables to enable:
 *   ACLED_API_KEY=your_key_here
 *   ACLED_EMAIL=your_registered_email@example.com
 *
 * If the variables are absent, this module silently returns an empty array
 * so the rest of the app continues working without ACLED.
 */

import { FeedItem } from './fetcher';

// Countries relevant to the Iran war theater
const THEATER_COUNTRIES = [
  'Iran', 'Iraq', 'Syria', 'Lebanon', 'Israel', 'Palestine',
  'Gaza Strip', 'West Bank', 'Yemen', 'Saudi Arabia',
  'United Arab Emirates', 'Bahrain', 'Kuwait', 'Oman', 'Jordan',
].join('|');

type ACLEDEvent = {
  event_id_cnty: string;
  event_date:    string;
  event_type:    string;
  sub_event_type:string;
  actor1:        string;
  actor2:        string;
  country:       string;
  location:      string;
  notes:         string;
  fatalities:    number;
  source:        string;
  source_scale:  string;
};

type ACLEDResponse = {
  status: number;
  count:  number;
  data:   ACLEDEvent[];
};

function countryToRegion(country: string): string {
  const map: Record<string, string> = {
    'Iran':                 'iranian',
    'Iraq':                 'gulf',
    'Syria':                'levant',
    'Lebanon':              'levant',
    'Israel':               'levant',
    'Palestine':            'levant',
    'Gaza Strip':           'levant',
    'West Bank':            'levant',
    'Yemen':                'gulf',
    'Saudi Arabia':         'gulf',
    'United Arab Emirates': 'gulf',
    'Bahrain':              'gulf',
    'Kuwait':               'gulf',
    'Oman':                 'gulf',
    'Jordan':               'gulf',
  };
  return map[country] ?? 'global';
}

function buildTitle(ev: ACLEDEvent): string {
  const actors = ev.actor2 ? `${ev.actor1} vs ${ev.actor2}` : ev.actor1;
  return `${ev.sub_event_type} in ${ev.location}, ${ev.country} — ${actors}`;
}

function buildSummary(ev: ACLEDEvent): string {
  const parts: string[] = [];
  if (ev.notes) parts.push(ev.notes);
  if (ev.fatalities > 0) parts.push(`${ev.fatalities} ${ev.fatalities === 1 ? 'fatality' : 'fatalities'} reported.`);
  parts.push(`Source: ${ev.source} (${ev.source_scale}).`);
  return parts.join(' ');
}

export async function fetchACLED(): Promise<FeedItem[]> {
  const key   = process.env.ACLED_API_KEY;
  const email = process.env.ACLED_EMAIL;

  if (!key || !email) return []; // Not configured — skip silently

  const params = new URLSearchParams({
    key,
    email,
    country:    THEATER_COUNTRIES,
    limit:      '50',
    format:     'json',
    fields:     'event_id_cnty|event_date|event_type|sub_event_type|actor1|actor2|country|location|notes|fatalities|source|source_scale',
  });

  const res = await fetch(`https://api.acleddata.com/acled/read?${params}`, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(12000),
  });

  if (!res.ok) {
    console.error(`[FTG] ACLED API returned ${res.status}`);
    return [];
  }

  const json: ACLEDResponse = await res.json();
  if (!json?.data?.length) return [];

  return json.data.map((ev): FeedItem => ({
    title:       buildTitle(ev),
    link:        'https://acleddata.com/data-export-tool/',
    pubDate:     new Date(ev.event_date).toISOString(),
    summary:     buildSummary(ev),
    sourceId:    'acled',
    sourceName:  'ACLED',
    region:      countryToRegion(ev.country),
    sourceColor: '#e74c3c',
  }));
}
