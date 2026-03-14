export type Source = {
  id: string;
  name: string;
  url: string;
  region: 'western' | 'iranian' | 'gulf' | 'south-asian' | 'global' | 'osint' | 'levant' | 'analysis';
  color: string;
  /** Skip the Iran keyword filter — source is already topically filtered */
  prefiltered?: boolean;
  /** Source fetched via a custom API handler, not RSS */
  fetchType?: 'rss' | 'acled';
};

export const SOURCES: Source[] = [
  // ── Western ──────────────────────────────────────────────────────────
  { id: 'reuters',        name: 'Reuters',               url: 'https://feeds.reuters.com/reuters/topNews',                     region: 'western',  color: '#c0392b' },
  { id: 'bbc',            name: 'BBC World',              url: 'https://feeds.bbci.co.uk/news/world/rss.xml',                   region: 'western',  color: '#bb1919' },
  { id: 'guardian',       name: 'The Guardian',           url: 'https://www.theguardian.com/world/middleeast/rss',              region: 'western',  color: '#005689' },
  { id: 'aljazeera',      name: 'Al Jazeera English',     url: 'https://www.aljazeera.com/xml/rss/all.xml',                    region: 'western',  color: '#f7941e' },
  { id: 'foreignpolicy',  name: 'Foreign Policy',         url: 'https://foreignpolicy.com/feed/',                              region: 'western',  color: '#e74c3c' },
  { id: 'breakingdefense',name: 'Breaking Defense',       url: 'https://breakingdefense.com/feed/',                            region: 'western',  color: '#7f8c8d' },
  { id: 'reuters-markets',name: 'Reuters Markets',        url: 'http://feeds.reuters.com/news/usmarkets',                      region: 'western',  color: '#95a5a6' },
  { id: 'apnews',         name: 'AP News',                url: 'https://rsshub.app/apnews/topics/world-news',                  region: 'western',  color: '#d35400' },

  // ── Levant / Israel ──────────────────────────────────────────────────
  { id: 'timesofisrael',  name: 'Times of Israel',        url: 'https://www.timesofisrael.com/feed/',                          region: 'levant',   color: '#e67e22' },
  { id: 'jpost',          name: 'Jerusalem Post',         url: 'https://www.jpost.com/rss/rssfeedsheadlines.aspx',             region: 'levant',   color: '#d35400' },
  { id: 'ynetnews',       name: 'Ynet News (IL)',         url: 'https://www.ynetnews.com/category/3082/rss',                   region: 'levant',   color: '#c0392b' },
  { id: 'haaretz',        name: 'Haaretz English',        url: 'https://www.haaretz.com/srv/haaretz-en.rss',                   region: 'levant',   color: '#f39c12' },

  // ── Iranian / Iran-adjacent ──────────────────────────────────────────
  { id: 'mehr',           name: 'Mehr News Agency',       url: 'https://en.mehrnews.com/rss',                                  region: 'iranian',  color: '#27ae60' },
  { id: 'financialtribune',name:'Financial Tribune',      url: 'https://financialtribune.com/rss',                             region: 'iranian',  color: '#16a085' },
  { id: 'tasnim',         name: 'Tasnim News (IRGC)',      url: 'https://www.tasnimnews.ir/en/rss',                             region: 'iranian',  color: '#c0392b' },
  { id: 'radiofarda',     name: 'Radio Farda (RFE/RL)',    url: 'https://en.radiofarda.com/api/zpiqmeipm',                      region: 'iranian',  color: '#2980b9' },
  { id: 'iranwire',       name: 'IranWire',               url: 'https://iranwire.com/feed/',                                   region: 'iranian',  color: '#8e44ad' },
  { id: 'iranintl',       name: 'Iran International',     url: 'https://www.iranintl.com/en/rss',                              region: 'iranian',  color: '#1abc9c' },

  // ── Gulf / MENA ──────────────────────────────────────────────────────
  { id: 'arabnews',       name: 'Arab News',              url: 'https://www.arabnews.com/rss.xml',                             region: 'gulf',     color: '#8e44ad' },
  { id: 'gulfnews',       name: 'Gulf News',              url: 'https://gulfnews.com/rss/world',                               region: 'gulf',     color: '#9b59b6' },
  { id: 'thenational',    name: 'The National (UAE)',      url: 'https://www.thenationalnews.com/rss/world',                    region: 'gulf',     color: '#6c3483' },
  { id: 'middleeasteye',  name: 'Middle East Eye',        url: 'https://www.middleeasteye.net/rss',                            region: 'gulf',     color: '#7d3c98' },
  { id: 'rudaw',          name: 'Rudaw',                  url: 'https://www.rudaw.net/english/rss',                            region: 'gulf',     color: '#d35400' },
  { id: 'alarabiya',      name: 'Al Arabiya English',     url: 'https://english.alarabiya.net/tools/rss',                      region: 'gulf',     color: '#8e44ad' },
  { id: 'aawsat',         name: 'Asharq Al-Awsat',        url: 'https://english.aawsat.com/home/rss',                          region: 'gulf',     color: '#5b2c6f' },

  // ── South Asian ───────────────────────────────────────────────────────
  { id: 'dawn',           name: 'Dawn (PK)',              url: 'https://www.dawn.com/feeds/latest-news',                       region: 'south-asian', color: '#2980b9' },
  { id: 'samaa',          name: 'Samaa News',             url: 'https://www.samaa.tv/feed/',                                   region: 'south-asian', color: '#1abc9c' },
  { id: 'ary',            name: 'ARY News',               url: 'https://arynews.tv/feed/',                                     region: 'south-asian', color: '#3498db' },
  { id: 'theprint',       name: 'The Print (IN)',         url: 'https://theprint.in/feed/',                                    region: 'south-asian', color: '#e74c3c' },

  // ── Analysis / Think-tanks ───────────────────────────────────────────
  { id: 'warontherocks',  name: 'War on the Rocks',       url: 'https://warontherocks.com/feed/',                              region: 'analysis', color: '#16a085' },
  { id: 'mei',            name: 'Middle East Institute',  url: 'https://www.mei.edu/rss.xml',                                  region: 'analysis', color: '#1abc9c' },
  { id: 'crisisgroup',    name: 'ICG / Crisis Group',     url: 'https://www.crisisgroup.org/rss.xml',                          region: 'analysis', color: '#2ecc71' },
  { id: 'atlanticcouncil',name: 'Atlantic Council',       url: 'https://www.atlanticcouncil.org/feed/',                        region: 'analysis', color: '#27ae60' },

  // ── OSINT ─────────────────────────────────────────────────────────────
  { id: 'dropsite',       name: 'DropSite News',          url: 'https://www.dropsitenews.com/feed',                            region: 'osint',    color: '#f1c40f' },
  { id: 'bellingcat',     name: 'Bellingcat',             url: 'https://www.bellingcat.com/feed/',                             region: 'osint',    color: '#f39c12' },

  // ── Global Markets & Logistics ───────────────────────────────────────
  { id: 'oilprice',       name: 'OilPrice.com',           url: 'https://oilprice.com/rss/main',                                region: 'global',   color: '#f39c12' },
  { id: 'gcaptain',       name: 'gCaptain (Shipping)',     url: 'http://feeds.feedburner.com/gcaptain',                         region: 'global',   color: '#16a085' },
  { id: 'eurasiareview',  name: 'Eurasia Review',         url: 'https://www.eurasiareview.com/feed/',                          region: 'global',   color: '#9b59b6' },
  { id: 'naturalgasworld',name: 'Natural Gas World',      url: 'https://www.naturalgasworld.com/feed/',                        region: 'global',   color: '#e67e22' },
  { id: 'energymonitor',  name: 'Energy Monitor',         url: 'https://www.energymonitor.ai/feed/',                           region: 'global',   color: '#f1c40f' },

  // ── GDELT Project (free, no key needed) ─────────────────────────────────────
  // GDELT monitors 100+ languages across print, broadcast, and web news.
  // These queries are pre-filtered for Iran theater topics, so we skip
  // the keyword filter and take the full result set.
  {
    id: 'gdelt-iran-conflict',
    name: 'GDELT · Iran Conflict',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=iran+military+OR+irgc+OR+iran+strike+OR+iran+attack&mode=artlist&format=rss&maxrecords=25&timespan=6h&sort=DateDesc',
    region: 'global', color: '#e74c3c', prefiltered: true,
  },
  {
    id: 'gdelt-iran-nuclear',
    name: 'GDELT · Nuclear / Diplomacy',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=iran+nuclear+OR+iaea+iran+OR+iran+uranium+OR+jcpoa+iran&mode=artlist&format=rss&maxrecords=20&timespan=12h&sort=DateDesc',
    region: 'global', color: '#8e44ad', prefiltered: true,
  },
  {
    id: 'gdelt-proxies',
    name: 'GDELT · Proxy Network',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=houthi+attack+OR+hezbollah+attack+OR+hamas+attack+OR+ansarallah&mode=artlist&format=rss&maxrecords=25&timespan=6h&sort=DateDesc',
    region: 'global', color: '#27ae60', prefiltered: true,
  },
  {
    id: 'gdelt-hormuz',
    name: 'GDELT · Hormuz / Shipping',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc?query=strait+hormuz+OR+red+sea+tanker+OR+iran+oil+sanctions+OR+persian+gulf+naval&mode=artlist&format=rss&maxrecords=20&timespan=12h&sort=DateDesc',
    region: 'global', color: '#2980b9', prefiltered: true,
  },

  // ── ACLED (free key required — set ACLED_API_KEY + ACLED_EMAIL in .env) ─────
  // Fetched via a custom handler rather than RSS; shown in the sidebar
  // so users can toggle it on/off like any other source.
  {
    id: 'acled',
    name: 'ACLED (Conflict Events)',
    url: '',           // fetched via lib/acled.ts, not RSS
    region: 'global', color: '#e74c3c',
    prefiltered: true,
    fetchType: 'acled',
  },

  // ── UN / Humanitarian ────────────────────────────────────────────────────────
  {
    id: 'un-news-mideast',
    name: 'UN News · Middle East',
    url: 'https://news.un.org/feed/subscribe/en/news/region/middle-east/feed/rss.xml',
    region: 'global', color: '#1a6ea8', prefiltered: true,
  },
  {
    id: 'reliefweb-iran',
    name: 'ReliefWeb · Iran Crisis',
    url: 'https://reliefweb.int/updates/rss.xml?primary_country=254',
    region: 'global', color: '#e8a020', prefiltered: true,
  },
  {
    id: 'reliefweb-mideast',
    name: 'ReliefWeb · MENA',
    url: 'https://reliefweb.int/updates/rss.xml?primary_country=141',
    region: 'global', color: '#e8a020', prefiltered: true,
  },

  // ── Wikinews (free, Wikipedia-quality editorial) ─────────────────────────────
  {
    id: 'wikinews',
    name: 'Wikinews · World',
    url: 'https://en.wikinews.org/w/index.php?title=Special:NewPages&feed=rss',
    region: 'global', color: '#888888',
  },

  // ── Additional OSINT / Conflict tracking ─────────────────────────────────────
  {
    id: 'liveleak-osint',
    name: 'Liveuamap · Middle East',
    url: 'https://liveuamap.com/rss',
    region: 'osint', color: '#e67e22', prefiltered: true,
  },
  {
    id: 'unsc-press',
    name: 'UN Security Council',
    url: 'https://www.un.org/press/en/rss.xml',
    region: 'global', color: '#1a6ea8',
  },
];

export const REGION_LABELS: Record<Source['region'], string> = {
  western:      'Western',
  iranian:      'Iranian',
  gulf:         'Gulf / MENA',
  'south-asian':'South Asian',
  levant:       'Levant / Israel',
  analysis:     'Analysis',
  osint:        'OSINT',
  global:       'Markets & Logistics',
};
