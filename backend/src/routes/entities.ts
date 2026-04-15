/**
 * GET /api/entities
 * Extract entities from news articles
 * In-memory cache with 1-hour TTL
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────────
type Entity = {
  id: string;
  text: string;
  type: 'person' | 'organization' | 'location' | 'event' | 'weapon' | 'military_unit';
  count: number;
  lastSeen: string;
  relatedEntities?: string[];
};

type EntityExtractionResult = {
  entities: Entity[];
  totalMentions: number;
};

// ── In-memory cache (persists between requests — unlike Vercel lambdas) ──────
let _entityCache: EntityExtractionResult | null = null;
let _cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── Known entities for geopolitical/military context ────────────────────────
const KNOWN_PEOPLE = [
  'Netanyahu', 'Biden', 'Trump', 'Putin', 'Zelenskyy', 'Khamenei', 'Raisi', 'Sinwar',
  'Gallant', 'Hamas', 'Hezbollah', 'IRGC', 'IDF', 'Pentagon', 'CIA', 'Mossad',
  'Blinken', 'Austin', 'Lloyd', 'Kirby', 'Miller', 'Stoltenberg', 'Guterres',
  'Sullivan', 'Borrell', 'Josep', 'Lavrov', 'Shoigu', 'Gerasimov', 'Surovikin',
  'Zaluzhny', 'Syrsky', 'Zelenska', 'Khamas', 'Nasrallah', 'Haniyeh', 'Mashaal',
  'Sinwar', 'Deif', 'Haniyeh', 'Mashaal', 'Al-Thani', 'Abdullah', 'Salman',
  'MbS', 'Crown Prince', 'Sisi', 'Erdogan', 'Macron', 'Scholz', 'Sunak', 'Starmer',
];

const KNOWN_ORGANIZATIONS = [
  'Hamas', 'Hezbollah', 'IRGC', 'IDF', 'Pentagon', 'CIA', 'Mossad', 'MI6', 'DGSE',
  'UN', 'UNSC', 'ICJ', 'ICC', 'IAEA', 'WHO', 'NATO', 'EU', 'OPEC', 'OPEC+',
  'Red Cross', 'Red Crescent', 'Doctors Without Borders', 'MSF', 'UNRWA',
  'Islamic Jihad', 'PIJ', 'PFLP', 'Fatah', 'PLO', 'PA', 'Palestinian Authority',
  'Likud', 'Yisrael Beiteinu', 'Shas', 'Religious Zionist Party', 'Blue and White',
  'Republican', 'Democrat', 'GOP', 'DNC', 'RNC', 'Congress', 'Senate', 'House',
];

const KNOWN_LOCATIONS = [
  'Israel', 'Gaza', 'West Bank', 'Jerusalem', 'Tel Aviv', 'Haifa', 'Ashkelon',
  'Ashdod', 'Beersheba', 'Eilat', 'Netanya', 'Herzliya', 'Rishon LeZion',
  'Lebanon', 'Beirut', 'Tyre', 'Sidon', 'Baalbek', 'Tripoli', 'Litani River',
  'Syria', 'Damascus', 'Aleppo', 'Homs', 'Latakia', 'Tartus', 'Palmyra', 'Golan Heights',
  'Iran', 'Tehran', 'Isfahan', 'Shiraz', 'Mashhad', 'Tabriz', 'Qom', 'Bushehr', 'Natanz', 'Fordow',
  'Yemen', 'Sanaa', 'Aden', 'Hodeidah', 'Marib', 'Red Sea', 'Bab el-Mandeb', 'Strait of Hormuz',
  'Iraq', 'Baghdad', 'Basra', 'Mosul', 'Erbil', 'Kirkuk', 'Anbar',
  'Jordan', 'Amman', 'Aqaba', 'Dead Sea',
  'Egypt', 'Cairo', 'Alexandria', 'Suez Canal', 'Rafah', 'Sinai Peninsula',
  'Saudi Arabia', 'Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina',
  'UAE', 'Dubai', 'Abu Dhabi', 'Sharjah',
  'Qatar', 'Doha',
  'Kuwait', 'Kuwait City',
  'Bahrain', 'Manama',
  'Oman', 'Muscat', 'Salalah',
  'Turkey', 'Ankara', 'Istanbul', 'Izmir',
  'Russia', 'Moscow', 'Saint Petersburg', 'Crimea', 'Sevastopol', 'Donbas', 'Donetsk', 'Luhansk',
  'Ukraine', 'Kyiv', 'Kharkiv', 'Odesa', 'Lviv', 'Mariupol', 'Bakhmut', 'Avdiivka',
  'US', 'USA', 'United States', 'Washington', 'New York', 'California', 'Florida',
  'UK', 'United Kingdom', 'London', 'England', 'Scotland',
  'France', 'Paris', 'Marseille',
  'Germany', 'Berlin', 'Munich',
  'Afghanistan', 'Kabul', 'Kandahar', 'Herat',
  'Pakistan', 'Islamabad', 'Karachi', 'Lahore',
  'India', 'New Delhi', 'Mumbai',
  'China', 'Beijing', 'Shanghai', 'Taiwan',
  'North Korea', 'Pyongyang', 'South Korea', 'Seoul',
];

const KNOWN_WEAPONS = [
  'F-16', 'F-35', 'F-15', 'F-18', 'Apache', 'Chinook', 'Black Hawk',
  'drone', 'UAV', 'loitering munition', 'Shahed', 'Geran', 'Mohajer',
  'missile', 'rocket', 'ballistic missile', 'cruise missile', 'hypersonic',
  'Iron Dome', 'David\'s Sling', 'Arrow', 'Patriot', 'THAAD', 'S-300', 'S-400',
  'HIMARS', 'MLRS', 'artillery', 'howitzer', 'mortar', 'tank', 'APC', 'IFV',
  'Merkava', 'Abrams', 'Leopard', 'Challenger', 'Bradley', 'Stryker',
  'nuclear', 'enriched uranium', 'centrifuge', 'plutonium', 'warhead',
  'chemical weapon', 'biological weapon', 'cluster munition', 'white phosphorus',
];

const KNOWN_EVENTS = [
  'war', 'conflict', 'invasion', 'attack', 'strike', 'airstrike', 'assault',
  'ceasefire', 'truce', 'peace talks', 'negotiations', 'summit', 'conference',
  'election', 'vote', 'referendum', 'protest', 'riot', 'demonstration',
  'explosion', 'blast', 'detonation', 'fire', 'collapse', 'destruction',
  'kidnapping', 'hostage', 'capture', 'arrest', 'detention', 'release',
  'sanctions', 'embargo', 'blockade', 'siege', 'occupation',
];

// ── Entity extraction using regex patterns ────────────────────────────────────
function extractEntitiesFromText(text: string): Entity[] {
  const entities: Entity[] = [];
  const normalizedText = text;
  
  // Extract known people
  KNOWN_PEOPLE.forEach(person => {
    const regex = new RegExp(`\\b${person}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      entities.push({
        id: `person-${person.toLowerCase()}`,
        text: person,
        type: 'person',
        count: matches.length,
        lastSeen: new Date().toISOString(),
      });
    }
  });
  
  // Extract known organizations
  KNOWN_ORGANIZATIONS.forEach(org => {
    const regex = new RegExp(`\\b${org}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      entities.push({
        id: `org-${org.toLowerCase()}`,
        text: org,
        type: 'organization',
        count: matches.length,
        lastSeen: new Date().toISOString(),
      });
    }
  });
  
  // Extract known locations
  KNOWN_LOCATIONS.forEach(loc => {
    const regex = new RegExp(`\\b${loc}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      entities.push({
        id: `location-${loc.toLowerCase()}`,
        text: loc,
        type: 'location',
        count: matches.length,
        lastSeen: new Date().toISOString(),
      });
    }
  });
  
  // Extract weapons
  KNOWN_WEAPONS.forEach(weapon => {
    const regex = new RegExp(`\\b${weapon}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      entities.push({
        id: `weapon-${weapon.toLowerCase()}`,
        text: weapon,
        type: 'weapon',
        count: matches.length,
        lastSeen: new Date().toISOString(),
      });
    }
  });
  
  // Extract events
  KNOWN_EVENTS.forEach(event => {
    const regex = new RegExp(`\\b${event}\\b`, 'gi');
    const matches = normalizedText.match(regex);
    if (matches) {
      entities.push({
        id: `event-${event.toLowerCase()}`,
        text: event,
        type: 'event',
        count: matches.length,
        lastSeen: new Date().toISOString(),
      });
    }
  });
  
  return entities;
}

// ── GET: Extract entities from news articles ────────────────────────────────
router.get('/', (req: Request, res: Response) => {
  const now = Date.now();
  
  // Return cached result if still valid
  if (_entityCache && (now - _cacheTime) < CACHE_TTL) {
    return res.json(_entityCache);
  }
  
  // Fetch news items from the frontend (we'll need to pass them or fetch from RSS)
  // For now, return empty result - this will be populated by the frontend
  // The frontend will send articles to extract entities from
  
  res.json({
    entities: [],
    totalMentions: 0,
  });
});

// ── POST: Extract entities from provided articles ────────────────────────────
router.post('/', (req: Request, res: Response) => {
  const { articles } = req.body as { articles?: Array<{ title: string; summary?: string }> };
  
  if (!articles || !Array.isArray(articles)) {
    return res.status(400).json({ error: 'Invalid articles array' });
  }
  
  const entityMap = new Map<string, Entity>();
  
  articles.forEach(article => {
    const text = `${article.title} ${article.summary || ''}`;
    const entities = extractEntitiesFromText(text);
    
    entities.forEach(entity => {
      const existing = entityMap.get(entity.id);
      if (existing) {
        existing.count += entity.count;
        existing.lastSeen = entity.lastSeen;
      } else {
        entityMap.set(entity.id, entity);
      }
    });
  });
  
  const result: EntityExtractionResult = {
    entities: Array.from(entityMap.values()).sort((a, b) => b.count - a.count),
    totalMentions: Array.from(entityMap.values()).reduce((sum, e) => sum + e.count, 0),
  };
  
  // Update cache
  _entityCache = result;
  _cacheTime = Date.now();
  
  res.json(result);
});

export default router;
