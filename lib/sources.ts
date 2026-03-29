export type Source = {
  id: string;
  name: string;
  url: string;
  region: 'western' | 'iranian' | 'gulf' | 'south-asian' | 'global' | 'osint' | 'levant' | 'analysis' | 'china' | 'russia';
  color: string;
  /** Skip the Iran keyword filter — source is already topically filtered */
  prefiltered?: boolean;
  /** Fetch sequentially with delay (used for rate-sensitive APIs like GDELT) */
  sequential?: boolean;
};

export const SOURCES: Source[] = [
  // ── Western ──────────────────────────────────────────────────────────────
  // reuters: blocked cloud IPs (fetch failed) — removed
  // apnews: HTTP 403 — removed
  { id: 'bbc',             name: 'BBC World',              url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                   region: 'western',     color: '#bb1919' },
  { id: 'guardian',        name: 'The Guardian',           url: 'https://www.theguardian.com/world/middleeast/rss',              region: 'western',     color: '#005689' },
  { id: 'aljazeera',       name: 'Al Jazeera English',     url: 'https://www.aljazeera.com/xml/rss/all.xml',                    region: 'western',     color: '#f7941e' },
  { id: 'foreignpolicy',   name: 'Foreign Policy',         url: 'https://foreignpolicy.com/feed/',                              region: 'western',     color: '#e74c3c' },
  { id: 'breakingdefense', name: 'Breaking Defense',       url: 'https://breakingdefense.com/feed/',                            region: 'western',     color: '#7f8c8d' },

  // ── Levant — Israel ───────────────────────────────────────────────────────
  // ynetnews: HTTP 404 — removed
  // haaretz: HTTP 404 — removed
  // plus972: HTTP 403 — removed
  { id: 'timesofisrael',   name: 'Times of Israel',        url: 'https://www.timesofisrael.com/feed/',                          region: 'levant',      color: '#e67e22' },
  { id: 'jpost',           name: 'Jerusalem Post',         url: 'https://www.jpost.com/rss/rssfeedsheadlines.aspx',             region: 'levant',      color: '#d35400' },

  // ── Levant — Palestine / Gaza ─────────────────────────────────────────────
  // wafa: HTTP 404 — removed
  { id: 'palchronicle',    name: 'Palestine Chronicle',    url: 'https://www.palestinechronicle.com/feed/',                     region: 'levant',      color: '#27ae60', prefiltered: true },
  { id: 'electronicintifada', name: 'Electronic Intifada', url: 'https://electronicintifada.net/rss.xml',                      region: 'levant',      color: '#1e8449', prefiltered: true },
  { id: 'mondoweiss',      name: 'Mondoweiss',             url: 'https://mondoweiss.net/feed/',                                 region: 'levant',      color: '#145a32', prefiltered: true },

  // ── Levant — Lebanon ──────────────────────────────────────────────────────
  // lorienttoday: HTTP 404 — removed
  // naharnet: XML parse error — removed
  // nna-lebanon: HTTP 403 — removed

  // ── Iranian / Iran-adjacent ───────────────────────────────────────────────
  // mehr: timeout — removed
  // financialtribune: timeout — removed
  // tasnim: timeout / parse error — removed
  // radiofarda: HTTP 404 — removed
  // iranwire: XML parse error — removed
  // iranintl: XML parse error — removed

  // ── Gulf / MENA ───────────────────────────────────────────────────────────
  // arabnews: HTTP 403 — removed
  // gulfnews: HTTP 404 — removed
  // thenational: HTTP 404 — removed
  // rudaw: HTTP 404 — removed
  // alarabiya: HTTP 403 — removed
  // aawsat: HTTP 404 — removed
  { id: 'middleeasteye',   name: 'Middle East Eye',        url: 'https://www.middleeasteye.net/rss',                            region: 'gulf',        color: '#7d3c98' },

  // ── South Asia — Pakistan ──────────────────────────────────────────────────
  // samaa: XML parse error — removed
  // expresstribune: HTTP 403 — removed
  // geo: XML parse error — removed
  { id: 'dawn',            name: 'Dawn (PK)',               url: 'https://www.dawn.com/feeds/latest-news',                       region: 'south-asian', color: '#2980b9' },
  { id: 'ary',             name: 'ARY News (PK)',           url: 'https://arynews.tv/feed/',                                     region: 'south-asian', color: '#3498db' },
  { id: 'thenews',         name: 'The News Intl (PK)',      url: 'https://www.thenews.com.pk/rss/1/1',                           region: 'south-asian', color: '#1a5276' },

  // ── South Asia — Afghanistan ───────────────────────────────────────────────
  // tolonews: HTTP 404 — removed
  // khaama: XML parse error — removed
  { id: 'pajhwok',         name: 'Pajhwok Afghan News',    url: 'https://pajhwok.com/en/feed/',                                 region: 'south-asian', color: '#d35400', prefiltered: true },

  // ── South Asia — India ─────────────────────────────────────────────────────
  // theprint: XML parse error (attribute without value) — removed

  // ── Analysis / Think-tanks ────────────────────────────────────────────────
  // mei: HTTP 403 — removed
  // thecradle: HTTP 404 — removed
  { id: 'warontherocks',   name: 'War on the Rocks',       url: 'https://warontherocks.com/feed/',                              region: 'analysis',    color: '#16a085' },
  { id: 'crisisgroup',     name: 'ICG / Crisis Group',     url: 'https://www.crisisgroup.org/rss.xml',                          region: 'analysis',    color: '#2ecc71' },
  { id: 'atlanticcouncil', name: 'Atlantic Council',       url: 'https://www.atlanticcouncil.org/feed/',                        region: 'analysis',    color: '#27ae60' },
  { id: 'almonitor',       name: 'Al-Monitor',             url: 'https://www.al-monitor.com/rss',                               region: 'analysis',    color: '#0e6655' },
  { id: 'resp-statecraft', name: 'Responsible Statecraft', url: 'https://responsiblestatecraft.org/feed/',                      region: 'analysis',    color: '#1d8348' },

  // ── OSINT / Independent ───────────────────────────────────────────────────
  // antiwar: HTTP 404 — removed
  // liveleak-osint: XML parse error — removed
  { id: 'dropsite',        name: 'DropSite News',          url: 'https://www.dropsitenews.com/feed',                            region: 'osint',       color: '#f1c40f' },
  { id: 'bellingcat',      name: 'Bellingcat',             url: 'https://www.bellingcat.com/feed/',                             region: 'osint',       color: '#f39c12' },
  { id: 'theintercept',    name: 'The Intercept',          url: 'https://theintercept.com/feed/?lang=en',                       region: 'osint',       color: '#e67e22' },
  { id: 'propublica',      name: 'ProPublica',             url: 'https://www.propublica.org/feeds/propublica/main',             region: 'osint',       color: '#5d6d7e' },
  { id: 'middleeastmonitor', name: 'Middle East Monitor',  url: 'https://www.middleeastmonitor.com/feed/',                      region: 'osint',       color: '#f0b429', prefiltered: true },
  { id: 'mintpress',       name: 'MintPress News',         url: 'https://www.mintpressnews.com/feed/',                          region: 'osint',       color: '#d4ac0d', prefiltered: true },

  // ── Global Markets & Logistics ────────────────────────────────────────────
  // eurasiareview: HTTP 403 — removed
  // naturalgasworld: XML parse error — removed
  // zerohedge-geo: feed not recognized as RSS — removed
  { id: 'oilprice',        name: 'OilPrice.com',           url: 'https://oilprice.com/rss/main',                                region: 'global',      color: '#f39c12' },
  { id: 'gcaptain',        name: 'gCaptain (Shipping)',     url: 'http://feeds.feedburner.com/gcaptain',                         region: 'global',      color: '#16a085' },
  { id: 'energymonitor',   name: 'Energy Monitor',         url: 'https://www.energymonitor.ai/feed/',                           region: 'global',      color: '#f1c40f' },
  { id: 'zerohedge',       name: 'ZeroHedge',              url: 'http://feeds.feedburner.com/zerohedge/feed',                   region: 'global',      color: '#000000', prefiltered: true },

  // ── GDELT Project ─────────────────────────────────────────────────────────
  // Reduced from 8 to 4 queries. Marked sequential=true so fetcher dispatches
  // them one-at-a-time with a 1.5 s gap — avoids 429 rate limiting.
  // gdelt-iran-nuclear: overlap with iran-conflict — removed
  // gdelt-lebanon: overlap with proxies — removed
  // gdelt-afghanistan / gdelt-pakistan: covered by reliefweb — removed
  {
    id: 'gdelt-iran-conflict',
    name: 'GDELT · Iran Conflict',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=iran+military+OR+irgc+OR+iran+strike+OR+iran+attack&mode=artlist&format=rss&maxrecords=25&timespan=6h&sort=DateDesc',
    region: 'global', color: '#e74c3c', prefiltered: true, sequential: true,
  },
  {
    id: 'gdelt-proxies',
    name: 'GDELT · Proxy Network',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=houthi+attack+OR+hezbollah+attack+OR+hamas+attack+OR+ansarallah&mode=artlist&format=rss&maxrecords=25&timespan=6h&sort=DateDesc',
    region: 'global', color: '#27ae60', prefiltered: true, sequential: true,
  },
  {
    id: 'gdelt-gaza',
    name: 'GDELT · Gaza War',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=gaza+war+OR+rafah+OR+idf+gaza+OR+gaza+ceasefire+OR+gaza+humanitarian&mode=artlist&format=rss&maxrecords=25&timespan=6h&sort=DateDesc',
    region: 'global', color: '#2ecc71', prefiltered: true, sequential: true,
  },
  {
    id: 'gdelt-hormuz',
    name: 'GDELT · Hormuz / Shipping',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=strait+hormuz+OR+red+sea+tanker+OR+iran+oil+sanctions+OR+persian+gulf+naval&mode=artlist&format=rss&maxrecords=20&timespan=12h&sort=DateDesc',
    region: 'global', color: '#2980b9', prefiltered: true, sequential: true,
  },

  // ── UN / Humanitarian ─────────────────────────────────────────────────────
  // unrwa: HTTP 403 — removed
  {
    id: 'un-news-mideast',
    name: 'UN News · Middle East',
    url: 'https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml',
    region: 'global', color: '#1a6ea8', prefiltered: true,
  },
  {
    id: 'reliefweb-afghanistan',
    name: 'ReliefWeb · Afghanistan',
    url: 'https://reliefweb.int/updates/rss.xml?primary_country=13',
    region: 'global', color: '#e8a020', prefiltered: true,
  },
  {
    id: 'reliefweb-iran',
    name: 'ReliefWeb · Iran',
    url: 'https://reliefweb.int/updates/rss.xml?primary_country=254',
    region: 'global', color: '#e8a020', prefiltered: true,
  },
  {
    id: 'reliefweb-palestine',
    name: 'ReliefWeb · Palestine',
    url: 'https://reliefweb.int/updates/rss.xml?primary_country=201',
    region: 'global', color: '#e8a020', prefiltered: true,
  },
  {
    id: 'reliefweb-lebanon',
    name: 'ReliefWeb · Lebanon',
    url: 'https://reliefweb.int/updates/rss.xml?primary_country=141',
    region: 'global', color: '#e8a020', prefiltered: true,
  },
  {
    id: 'reliefweb-mideast',
    name: 'ReliefWeb · MENA',
    url: 'https://reliefweb.int/updates/rss.xml?primary_country=109',
    region: 'global', color: '#e8a020', prefiltered: true,
  },

  // ── Wikinews ──────────────────────────────────────────────────────────────
  {
    id: 'wikinews',
    name: 'Wikinews · World',
    url: 'https://en.wikinews.org/w/index.php?title=Special:NewPages&feed=rss',
    region: 'global', color: '#888888',
  },

  // ── China ─────────────────────────────────────────────────────────────────
  // globaltimes: HTTP 404 — removed
  // rfa: HTTP 404 — removed
  // caixin: HTTP 403 — removed
  // sixthtone: HTTP 404 — removed
  { id: 'xinhua',          name: 'Xinhua News Agency',     url: 'https://www.xinhuanet.com/english/rss/worldrss.xml',           region: 'china',       color: '#de2910' },
  { id: 'scmp',            name: 'SCMP (Politics)',         url: 'https://www.scmp.com/rss/2/feed',                              region: 'china',       color: '#ffcc00' },
  { id: 'asiatimes',       name: 'Asia Times',             url: 'https://asiatimes.com/feed/',                                  region: 'china',       color: '#2c3e50' },

  // ── Russia ────────────────────────────────────────────────────────────────
  { id: 'tass',            name: 'TASS (English)',          url: 'https://tass.com/rss/v2.xml',                                  region: 'russia',      color: '#1f355e' },
  { id: 'rtnews',          name: 'RT News',                 url: 'https://www.rt.com/rss/news/',                                 region: 'russia',      color: '#1f355e' },
  { id: 'sputnik',         name: 'Sputnik Globe',           url: 'https://sputnikglobe.com/export/rss2/archive/index.xml',       region: 'russia',      color: '#e67e22' },
  { id: 'moscowtimes',     name: 'The Moscow Times',        url: 'https://www.themoscowtimes.com/rss/news',                      region: 'russia',      color: '#333333' },
  {
    id: 'unsc-press',
    name: 'UN Security Council',
    url: 'https://www.un.org/press/en/rss.xml',
    region: 'global', color: '#1a6ea8',
  },
];

export const REGION_LABELS: Record<Source['region'], string> = {
  western:       'Western',
  iranian:       'Iranian',
  gulf:          'Gulf / MENA',
  'south-asian': 'South Asia (Pak · Afghan)',
  levant:        'Israel · Palestine · Lebanon',
  analysis:      'Analysis',
  osint:         'OSINT',
  global:        'Markets & Logistics',
  china:         'China',
  russia:        'Russia',
};
