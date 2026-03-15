'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { SOURCES, REGION_LABELS, Source } from '@/lib/sources';
import type { SourceHealth } from '@/lib/fetcher';
import TopStorylines   from './components/TopStorylines';
import BreakingTicker  from './components/BreakingTicker';
import LiveVideoWidget from './components/LiveVideoWidget';
import RapidResponse   from './components/RapidResponse';
import MacroWatch     from './components/MacroWatch';
import OilTicker      from './components/OilTicker';
import IranWarSection  from './components/IranWarSection';

// MapView uses Leaflet (browser-only) — load with no SSR
const MapView = dynamic(() => import('./components/MapView'), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────
type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  sourceId: string;
  sourceName: string;
  region: string;
  imageUrl?: string;
  sourceColor: string;
};

type LensId =
  | 'all' | 'gaza' | 'lebanon' | 'afghanistan' | 'pakistan'
  | 'nuclear' | 'naval' | 'proxy' | 'domestic'
  | 'oil' | 'commodities' | 'finance' | 'shipping' | 'supply'
  | 'trump' | 'china-pivot' | 'russia-news';

type Theme = 'light' | 'dark';
type ViewMode = 'list' | 'clusters' | 'map';
type SortMode = 'date-desc' | 'date-asc' | 'source';

// A storyline cluster
type Cluster = {
  id: string;
  title: string;
  items: FeedItem[];
  score: number; // For sorting clusters by size/recency
};

// ── Lens definitions ──────────────────────────────────────────────────────────
const LENSES: { id: LensId; label: string; hint: string; keywords: string[] }[] = [
  { id: 'all',         label: 'All Topics',        hint: 'All Middle East war theater stories across every source.',   keywords: [] },
  { id: 'gaza',        label: 'Gaza',              hint: 'Gaza war, genocide, ceasefire, hostages, occupation, UNRWA.', keywords: ['gaza','rafah','khan younis','jabalia','deir al-balah','hamas','idf','ceasefire','hostages','unrwa','genocide','occupation','west bank','displacement','famine','siege','blockade','casualties','airstrike','ground invasion'] },
  { id: 'lebanon',     label: 'Lebanon',           hint: 'Lebanon war, Hezbollah, South Lebanon, Beirut, UNIFIL.',     keywords: ['lebanon','beirut','hezbollah','south lebanon','litani','nasrallah','dahieh','unifil','laf','pager','lebanese army'] },
  { id: 'afghanistan', label: 'Afghanistan',       hint: 'Taliban rule, Kabul, TTP, Haqqani, Afghan conflict.',       keywords: ['afghanistan','afghan','taliban','kabul','kandahar','helmand','panjshir','haqqani','ttp','nrf','islamic emirate','warlord'] },
  { id: 'pakistan',    label: 'Pakistan',          hint: 'TTP attacks, Balochistan, military operations, PTM.',       keywords: ['pakistan','islamabad','rawalpindi','ttp','tehrik-i-taliban','balochistan','bla','ptm','waziristan','khyber','imran khan','pti','pakistan army','pakistan military'] },
  { id: 'nuclear',     label: 'Nuclear',           hint: 'Enrichment, IAEA, centrifuges, breakout.',                  keywords: ['nuclear','uranium','centrifuge','natanz','fordow','iaea','enrichment','jcpoa','snapback'] },
  { id: 'naval',       label: 'Naval / Hormuz',    hint: 'Persian Gulf, Strait of Hormuz, tankers.',                  keywords: ['hormuz','strait of hormuz','persian gulf','tanker','naval','fleet','frigate','destroyer','maritime'] },
  { id: 'proxy',       label: 'Proxy Network',     hint: 'Houthis, Hamas, Hezbollah, axis of resistance.',            keywords: ['houthi','houthis','ansarallah','proxy','yemen','militia','kataib','hashd','pmu','axis of resistance'] },
  { id: 'domestic',    label: 'Iran Domestic',     hint: 'Elections, protests, leadership.',                          keywords: ['parliament','election','protest','supreme leader','khamenei','pezeshkian','raisi','crackdown','dissent'] },
  { id: 'oil',         label: 'Oil Markets',       hint: 'Crude, Brent, WTI, barrels, OPEC+.',                       keywords: ['oil','oil price','brent','wti','barrel','crude','opec','oil output','oil supply'] },
  { id: 'commodities', label: 'Commodities',       hint: 'Metals, food, LNG, and broader commodity impacts.',        keywords: ['commodity','commodities','wheat','grain','gas','lng','metals','fertilizer','natural gas'] },
  { id: 'finance',     label: 'Markets / Finance', hint: 'Stocks, bonds, FX, risk premiums, sanctions.',             keywords: ['market','markets','stocks','equities','bonds','yields','currency','fx','rally','selloff','sanctions','war premium'] },
  { id: 'shipping',    label: 'Shipping',          hint: 'Tankers, freight rates, insurance, chokepoints.',          keywords: ['tanker','freight','shipping','vessel','container','bulk carrier','insurance','suez','red sea','bab el-mandeb'] },
  { id: 'trump',       label: 'Rapid 47',          hint: 'Trump administration, White House response, policy shifts.', keywords: ['trump','white house','rapid 47','vance','maga','administration','executive order','mar-a-lago'] },
  { id: 'china-pivot', label: 'China Pivot',       hint: 'China influence, Beijing, BRICS, Belt & Road.',           keywords: ['china','beijing','xi jinping','brics','belt and road','pla','south china sea','shanghai'] },
  { id: 'russia-news', label: 'Russia Pivot',      hint: 'Russia influence, Moscow, Kremlin, Energy ties.',          keywords: ['russia','moscow','putin','kremlin','lavrov','wagner','ukraine','donbas','gazprom'] },
];

// ── Region colours ─────────────────────────────────────────────────────────────
const REGION_DOTS: Record<string, string> = {
  western:      '#c0392b',
  iranian:      '#27ae60',
  gulf:         '#8e44ad',
  'south-asian':'#2980b9',
  levant:       '#e67e22',
  analysis:     '#16a085',
  osint:        '#f0b429',
  global:       '#7f8c8d',
  china:        '#de2910',
  russia:       '#34495e',
};

// ── Sources grouped by region (module-level, stable) ──────────────────────────
const REGION_GROUPS: [string, typeof SOURCES][] = Object.entries(
  SOURCES.reduce<Record<string, typeof SOURCES>>((acc, s) => {
    (acc[s.region] ||= []).push(s);
    return acc;
  }, {})
);

// ── Pure helpers ──────────────────────────────────────────────────────────────
function itemMatchesLens(item: FeedItem, activeLenses: Set<LensId>): boolean {
  if (activeLenses.size === 0) return true; // empty selection = show all
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return [...activeLenses].some(lensId => {
    const def = LENSES.find(l => l.id === lensId);
    if (!def) return false;
    return def.keywords.some(kw => text.includes(kw));
  });
}

function itemMatchesSearch(item: FeedItem, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  return `${item.title} ${item.summary} ${item.sourceName}`.toLowerCase().includes(lower);
}

// Stop-words to ignore when comparing article titles for clustering
const CLUSTER_STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','as','is','was','are','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might',
  'says','said','over','after','before','into','through','about','against',
  'between','into','during','without','within','along','following','across',
  'up','down','out','off','over','under','again','its','it','this','that',
  'these','those','than','then','so','yet','both','each','more','most',
  'other','some','such','no','nor','not','only','own','same','too','very',
  'can','just','us','new','amid','amid','report','reports','sources',
]);

function titleToKeySet(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !CLUSTER_STOPWORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = [...a].filter(w => b.has(w)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function buildClusters(items: FeedItem[]): Cluster[] {
  // Deduplicate: group articles whose titles share ≥40% Jaccard similarity
  // and were published within 12 hours of each other.
  const SIMILARITY_THRESHOLD = 0.40;
  const TIME_WINDOW_MS = 12 * 60 * 60 * 1000;

  const keySets = items.map(item => titleToKeySet(item.title || ''));
  const assigned = new Array<number>(items.length).fill(-1);
  const clusters: FeedItem[][] = [];

  for (let i = 0; i < items.length; i++) {
    if (assigned[i] !== -1) continue; // already in a cluster

    // Start a new cluster with this item
    const clusterIdx = clusters.length;
    clusters.push([items[i]]);
    assigned[i] = clusterIdx;

    const timeI = new Date(items[i].pubDate).getTime();

    for (let j = i + 1; j < items.length; j++) {
      if (assigned[j] !== -1) continue;

      const timeJ = new Date(items[j].pubDate).getTime();
      if (Math.abs(timeI - timeJ) > TIME_WINDOW_MS) continue; // too far apart in time

      const sim = jaccardSimilarity(keySets[i], keySets[j]);
      if (sim >= SIMILARITY_THRESHOLD) {
        clusters[clusterIdx].push(items[j]);
        assigned[j] = clusterIdx;
      }
    }
  }

  return clusters
    .map((clusterItems, idx) => {
      // Simplistic recency/size score for sorting
      const finalItems = clusterItems.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
      const newestTime = new Date(finalItems[0]?.pubDate || 0).getTime();
      const hoursOld = (Date.now() - newestTime) / (1000 * 60 * 60);
      const recencyMultiplier = Math.max(0.1, 1 - (hoursOld / 48));
      const score = finalItems.length * recencyMultiplier;

      return {
        id:    `cluster-${idx}`,
        title: finalItems[0]?.title || 'Untitled',
        items: finalItems,
        score
      };
    })
    .sort((a, b) => b.score - a.score);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function truncate(text: string, max = 160): string {
  if (!text) return '';
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

function getAgeBadge(dateStr: string): 'breaking' | 'new' | null {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 15) return 'breaking';
  if (mins < 60) return 'new';
  return null;
}

// ── Stat tile (header widget) ──────────────────────────────────────────────────
function StatTile({ icon, value, label, highlight, dim }: {
  icon: string; value: number; label: string; highlight: boolean; dim?: boolean;
}) {
  return (
    <div style={{
      display:       'inline-flex',
      alignItems:    'center',
      gap:           4,
      padding:       '2px 7px',
      borderRadius:  3,
      border:        `1px solid ${highlight ? 'var(--badge-brk-border)' : 'var(--border-light)'}`,
      background:    highlight ? 'var(--badge-brk-bg)' : 'transparent',
      fontFamily:    'var(--font-mono)',
      fontSize:      9,
      letterSpacing: '0.04em',
      color:         highlight ? 'var(--badge-brk-color)' : dim ? 'var(--text-muted)' : 'var(--text-secondary)',
      lineHeight:    1,
    }}>
      <span style={{ fontSize: 10 }}>{icon}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
      <span style={{ opacity: 0.7 }}>{label}</span>
    </div>
  );
}

// ── Region stats bar ───────────────────────────────────────────────────────────
function RegionStatsStrip({ items }: { items: FeedItem[] }) {
  if (!items.length) return null;
  const counts: Record<string, number> = {};
  items.forEach(i => { counts[i.region] = (counts[i.region] || 0) + 1; });
  const entries = Object.entries(counts).filter(([, n]) => n > 0);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, n]) => s + n, 0);

  return (
    <div style={{
      marginBottom: 10,
      padding: '7px 12px',
      borderRadius: 4,
      border: '1px solid var(--border-light)',
      background: 'var(--surface)',
      display: 'flex',
      flexDirection: 'column',
      gap: 5,
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        Live balance by region
      </div>
      {/* Colour bar */}
      <div style={{ display: 'flex', borderRadius: 999, overflow: 'hidden', height: 4, background: 'var(--border-light)' }}>
        {entries.sort((a, b) => b[1] - a[1]).map(([r, n]) => (
          <div key={r} style={{ width: `${(n / total) * 100}%`, background: REGION_DOTS[r] || '#999' }} />
        ))}
      </div>
      {/* Labels */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 12px' }}>
        {entries.sort((a, b) => b[1] - a[1]).map(([r, n]) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: REGION_DOTS[r] || '#999', display: 'inline-block', flexShrink: 0 }} />
            {REGION_LABELS[r as Source['region']] || r} · {n}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Sidebar panel (extracted to avoid inner-component remounts) ────────────────
type SidebarPanelProps = {
  search: string;
  onSearch: (v: string) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
  activeSources: Set<string>;
  onToggleSource: (id: string) => void;
  onAllSources: () => void;
  onNoSources: () => void;
  sourceCountMap: Record<string, number>;
  failedSources: Set<string>;
  pinnedItems: FeedItem[];
  onTogglePin: (item: FeedItem) => void;
  keyForItem: (item: FeedItem) => string;
};

function SidebarPanel({
  search, onSearch, searchRef,
  activeSources, onToggleSource, onAllSources, onNoSources,
  sourceCountMap, failedSources,
  pinnedItems, onTogglePin, keyForItem,
}: SidebarPanelProps) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          id="search-input"
          name="search-input"
          ref={searchRef}
          className="search-input"
          type="search"
          placeholder="Search stories… (press /)"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
      </div>

      {/* Sources header */}
      <div style={{
        fontSize: 9, letterSpacing: '0.15em', color: 'var(--text-muted)',
        textTransform: 'uppercase', marginBottom: 10,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Sources ({SOURCES.length})</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['All', 'None'] as const).map(label => (
            <button
              key={label}
              onClick={label === 'All' ? onAllSources : onNoSources}
              style={{
                fontSize: 8, letterSpacing: '0.06em', color: 'var(--text-muted)',
                background: 'none', border: '1px solid var(--border-light)',
                borderRadius: 2, padding: '1px 6px', cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Sources grouped by region */}
      {REGION_GROUPS.map(([region, srcs]) => (
        <div key={region} style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 8, letterSpacing: '0.1em',
            color: REGION_DOTS[region] || '#999',
            textTransform: 'uppercase', marginBottom: 4,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: REGION_DOTS[region] || '#999', display: 'inline-block', flexShrink: 0 }} />
            {REGION_LABELS[region as Source['region']] || region}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {srcs.map(s => {
              const active = activeSources.has(s.id);
              const count = sourceCountMap[s.id] || 0;
              const failed = failedSources.has(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => onToggleSource(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 8, padding: '4px 7px', borderRadius: 3,
                    border: 'none',
                    background: active ? 'var(--surface-hover)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: active ? (REGION_DOTS[s.region] || '#999') : 'var(--border)',
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 11, letterSpacing: '0.02em',
                      color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontWeight: active ? 500 : 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {s.name}
                    </span>
                    {failed && <span className="source-error-dot" title="Feed failed to load" />}
                  </div>
                  {count > 0 && (
                    <span style={{ fontSize: 10, color: active ? 'var(--text-muted)' : 'var(--border)', flexShrink: 0 }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Region legend */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
          Legend
        </div>
        {Object.entries(REGION_DOTS).map(([r, c]) => (
          <div key={r} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
              {REGION_LABELS[r as Source['region']] || r}
            </span>
          </div>
        ))}
      </div>

      {/* Pinned */}
      {pinnedItems.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
          <div style={{ fontSize: 9, letterSpacing: '0.15em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Pinned ({pinnedItems.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {pinnedItems.map(item => (
              <button
                key={keyForItem(item)}
                onClick={() => onTogglePin(item)}
                style={{
                  border: 'none', background: 'transparent', textAlign: 'left',
                  cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)', padding: '3px 0',
                }}
              >
                <span style={{ fontWeight: 500, color: 'var(--accent)' }}>{item.sourceName}</span>
                <span style={{ color: 'var(--border)' }}> / </span>
                <span>{truncate(item.title, 55)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Feed Status Panel ──────────────────────────────────────────────────────────
// Shows sources that errored on last fetch. Hidden when all feeds are healthy.
const REGION_ORDER = [
  'iranian','middle-east','south-asia','afghanistan','pakistan',
  'china','russia','us','global','crypto',
];

function FeedStatusPanel({ health }: { health: SourceHealth[] }) {
  const [open, setOpen] = useState(false);
  const failed = health.filter(h => !h.ok);
  if (failed.length === 0) return null;

  // Group by region for readability
  const byRegion: Record<string, SourceHealth[]> = {};
  failed.forEach(h => {
    const r = h.region || 'unknown';
    if (!byRegion[r]) byRegion[r] = [];
    byRegion[r].push(h);
  });
  const regions = Object.keys(byRegion).sort(
    (a, b) => REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b)
  );

  return (
    <div style={{
      marginBottom:  10,
      border:        '1px solid var(--border-light)',
      borderTop:     '2px solid #e67e22',
      borderRadius:  '0 0 4px 4px',
      background:    'var(--surface)',
      overflow:      'hidden',
    }}>
      {/* Header — always visible */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '7px 14px',
          background:     'transparent',
          border:         'none',
          cursor:         'pointer',
          textAlign:      'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display:      'inline-block',
            width:        6, height: 6, borderRadius: '50%',
            background:   '#e67e22', flexShrink: 0,
          }} />
          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      10,
            fontWeight:    700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         '#e67e22',
          }}>
            Feed Status
          </span>
          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      9,
            color:         'var(--text-muted)',
            border:        '1px solid var(--border-light)',
            padding:       '1px 6px',
            borderRadius:  2,
          }}>
            {failed.length} of {health.length} sources unavailable
          </span>
        </div>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      9,
          color:         'var(--text-muted)',
          letterSpacing: '0.05em',
        }}>
          {open ? '▼ Collapse' : '▶ Show details'}
        </span>
      </button>

      {/* Detail rows */}
      {open && (
        <div style={{ padding: '2px 14px 12px', borderTop: '1px solid var(--border-light)' }}>
          {regions.map(region => (
            <div key={region} style={{ marginTop: 10 }}>
              <div style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      8,
                fontWeight:    700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color:         'var(--text-muted)',
                marginBottom:  5,
              }}>
                {REGION_LABELS[region as Source['region']] || region}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {byRegion[region].map(h => (
                  <div key={h.id} style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    gap:            8,
                    padding:        '3px 8px',
                    borderRadius:   2,
                    background:     'rgba(231,76,60,0.04)',
                    border:         '1px solid rgba(231,76,60,0.12)',
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize:   10,
                      fontWeight: 500,
                      color:      'var(--text-secondary)',
                    }}>
                      {h.name}
                    </span>
                    <span style={{
                      fontFamily:    'var(--font-mono)',
                      fontSize:      9,
                      color:         '#c93a20',
                      letterSpacing: '0.03em',
                      flexShrink:    0,
                    }}>
                      {h.errorMsg || 'Feed error'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{
            marginTop:     10,
            fontFamily:    'var(--font-mono)',
            fontSize:      8,
            color:         'var(--text-muted)',
            letterSpacing: '0.04em',
          }}>
            Affected sources are served from cache where available. Status updates on next refresh.
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function Home() {
  const [items, setItems]               = useState<FeedItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [lastUpdated, setLastUpdated]   = useState<string | null>(null);
  const [total, setTotal]               = useState(0);
  const [failedCount, setFailedCount]   = useState(0);
  const [sourceHealth, setSourceHealth] = useState<SourceHealth[]>([]);
  const [activeSources, setActiveSources] = useState<Set<string>>(
    new Set(SOURCES.map(s => s.id))
  );
  const [activeLenses, setActiveLenses] = useState<Set<LensId>>(new Set());
  const [activeRegions, setActiveRegions] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode]         = useState<SortMode>('date-desc');
  const [viewMode, setViewMode]         = useState<ViewMode>('list');
  const [pinnedKeys, setPinnedKeys]     = useState<string[]>([]);
  const [search, setSearch]             = useState('');
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [theme, setTheme]               = useState<Theme>('light');
  const [liveStatus, setLiveStatus]     = useState<'connecting' | 'live' | 'polling'>('connecting');
  const [focusedIdx, setFocusedIdx]     = useState<number>(-1);
  const [scrolled, setScrolled]         = useState(false);
  const searchRef                        = useRef<HTMLInputElement>(null);
  // Track when data was last successfully fetched so the visibility handler
  // can skip a re-fetch if the data is still reasonably fresh (< 10 min).
  const lastFetchedAtRef                 = useRef<number>(0);
  const [imageErrors, setImageErrors]    = useState<Set<string>>(new Set());

  // ── Scroll listener for header shadow ─────────────────────────────────────
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  // j/k  — navigate articles  |  o — open focused article
  // /    — focus search       |  Escape — clear search / close sidebar
  // m    — toggle map view    |  1-9 — jump to lens by index
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (e.key === '/' && !inInput) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      if (e.key === 'Escape') {
        if (inInput) { searchRef.current?.blur(); setSearch(''); }
        setSidebarOpen(false);
        return;
      }

      if (inInput) return; // remaining shortcuts don't fire inside inputs

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIdx(i => Math.min(i + 1, 199));
        return;
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIdx(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'o' || e.key === 'Enter') {
        const el = document.querySelector<HTMLAnchorElement>(`[data-article-idx="${focusedIdx}"]`);
        if (el) { e.preventDefault(); el.click(); }
        return;
      }
      if (e.key === 'm') {
        setViewMode(v => v === 'map' ? 'list' : 'map');
        return;
      }
      if (e.key === 's') {
        setViewMode(v => v === 'list' ? 'clusters' : 'list');
        return;
      }
      if (e.key === 'r') {
        fetchNews();
        return;
      }
      // 1 → clear all lenses; 2-9 → toggle specific lens by index
      const digit = parseInt(e.key, 10);
      if (digit >= 1 && digit <= 9) {
        if (digit === 1) {
          setActiveLenses(new Set()); // "1" = show all (clear filters)
          setActiveRegions(new Set());
        } else if (digit - 1 < LENSES.length) {
          const lensId = LENSES[digit - 1].id;
          setActiveLenses(prev => {
            const next = new Set(prev);
            if (next.has(lensId)) next.delete(lensId); else next.add(lensId);
            return next;
          });
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIdx]);

  // ── Theme init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem('ftg_theme') as Theme | null;
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme('dark');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    try { window.localStorage.setItem('ftg_theme', theme); } catch { /* ignore */ }
  }, [theme]);

  // ── Pins persistence ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('ftg_pins');
      if (raw) { const p = JSON.parse(raw); if (Array.isArray(p)) setPinnedKeys(p); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('ftg_pins', JSON.stringify(pinnedKeys)); } catch { /* ignore */ }
  }, [pinnedKeys]);

  // ── Close sidebar when clicking outside (escape key) ─────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Data fetching (manual / fallback) ────────────────────────────────────
  const fetchNews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/news');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setLastUpdated(data.fetchedAt);
      setFailedCount(data.failedSources || 0);
      if (Array.isArray(data.health)) setSourceHealth(data.health);
      lastFetchedAtRef.current = Date.now();
    } catch (err) {
      console.error('[FTG] News fetch error:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── SSE live feed (replaces polling) ─────────────────────────────────────
  useEffect(() => {
    // Trigger initial HTTP load so we have data immediately
    fetchNews();

    if (typeof EventSource === 'undefined') {
      // Browser doesn't support SSE — fall back to polling
      setLiveStatus('polling');
      const t = setInterval(fetchNews, 5 * 60 * 1000);
      return () => clearInterval(t);
    }

    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollFallback:   ReturnType<typeof setInterval>  | null = null;
    // sseRetryTimer: periodically tries to reclaim SSE after falling back to polling
    let sseRetryTimer:  ReturnType<typeof setInterval>  | null = null;
    let attempts = 0;
    let destroyed = false; // set true on cleanup so callbacks don't fire after unmount

    const applyPayload = (data: {
      type: string; items?: FeedItem[]; total?: number;
      fetchedAt?: string; failedSources?: number; health?: SourceHealth[];
    }) => {
      if (data.type !== 'news' || !Array.isArray(data.items)) return;
      setItems(data.items);
      setTotal(data.total ?? 0);
      setLastUpdated(data.fetchedAt ?? null);
      setFailedCount(data.failedSources ?? 0);
      if (Array.isArray(data.health)) setSourceHealth(data.health);
      setLoading(false);
      lastFetchedAtRef.current = Date.now();
    };

    const stopPolling = () => {
      if (pollFallback) { clearInterval(pollFallback); pollFallback = null; }
      if (sseRetryTimer) { clearInterval(sseRetryTimer); sseRetryTimer = null; }
    };

    const connect = () => {
      if (destroyed) return;
      setLiveStatus('connecting');
      es = new EventSource('/api/stream');

      es.addEventListener('open', () => {
        if (destroyed) { es?.close(); return; }
        setLiveStatus('live');
        attempts = 0;
        stopPolling(); // SSE is up — no need for polling fallback anymore
      });

      es.addEventListener('message', (e: MessageEvent) => {
        try { applyPayload(JSON.parse(e.data as string)); } catch { /* ignore */ }
      });

      es.addEventListener('error', () => {
        if (destroyed) return;
        es?.close();
        es = null;
        attempts++;

        if (attempts > 3) {
          // SSE not available — switch to polling and schedule a periodic retry
          setLiveStatus('polling');
          if (!pollFallback) {
            pollFallback = setInterval(fetchNews, 5 * 60 * 1000);
          }
          // Every 2 minutes, try to reconnect SSE (e.g. after a network blip)
          if (!sseRetryTimer) {
            sseRetryTimer = setInterval(() => {
              if (!destroyed && !es) {
                attempts = 0; // reset so we give SSE another 3 chances
                connect();
              }
            }, 2 * 60 * 1000);
          }
        } else {
          // Exponential back-off: 3s → 6s → 9s
          setLiveStatus('connecting');
          reconnectTimer = setTimeout(connect, 3000 * attempts);
        }
      });
    };

    // Also reconnect on browser online event (device woke up, wifi reconnected)
    const handleOnline = () => {
      if (destroyed || es) return; // already connected
      attempts = 0;
      stopPolling();
      fetchNews(); // get fresh data immediately
      connect();
    };
    window.addEventListener('online', handleOnline);

    // Refresh data when the tab becomes visible again — but only if it has been
    // more than 10 minutes since the last successful fetch. This prevents a tab
    // switch from hammering feed providers on every focus event.
    const VISIBILITY_REFETCH_THRESHOLD = 10 * 60 * 1000; // 10 minutes
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && !destroyed) {
        const msSinceLastFetch = Date.now() - lastFetchedAtRef.current;
        if (msSinceLastFetch > VISIBILITY_REFETCH_THRESHOLD) {
          fetchNews();
        }
        if (!es) {
          attempts = 0;
          stopPolling();
          connect();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    connect();

    return () => {
      destroyed = true;
      es?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPolling();
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fetchNews is stable (useCallback with no deps)

  // ── Helpers ───────────────────────────────────────────────────────────────
  const keyForItem = (item: FeedItem) => {
    // Some RSS parsers return '#' or a blank string when no link is available.
    // Treat those as missing so we fall through to a unique composite key.
    const link = item.link && item.link !== '#' && item.link.startsWith('http')
      ? item.link
      : null;
    return link ?? `${item.sourceId}::${item.title}::${item.pubDate}`;
  };

  const togglePin = (item: FeedItem) => {
    const key = keyForItem(item);
    setPinnedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleSource = (id: string) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  // De-duplicate first: some sources (e.g. China Daily) emit multiple items
  // with identical titles and timestamps, and GDELT/syndication can produce
  // the same URL from two different source IDs.
  const filteredBySource = useMemo(() => {
    const seen = new Set<string>();
    return items.filter(i => {
      if (!activeSources.has(i.sourceId)) return false;
      const k = (i.link && i.link !== '#' && i.link.startsWith('http'))
        ? i.link
        : `${i.sourceId}::${i.title}::${i.pubDate}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [items, activeSources]);

  const filteredByLens = useMemo(
    () => filteredBySource.filter(i => itemMatchesLens(i, activeLenses)),
    [filteredBySource, activeLenses]
  );

  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    filteredByLens.forEach(i => set.add(i.region));
    return set;
  }, [filteredByLens]);

  const filteredByRegion = useMemo(
    () => activeRegions.size === 0
      ? filteredByLens
      : filteredByLens.filter(i => activeRegions.has(i.region)),
    [filteredByLens, activeRegions]
  );

  const visibleItems = useMemo(() => {
    const filtered = filteredByRegion.filter(i => itemMatchesSearch(i, search));
    if (sortMode === 'date-asc') return [...filtered].reverse();
    if (sortMode === 'source') return [...filtered].sort((a, b) => a.sourceName.localeCompare(b.sourceName));
    return filtered; // date-desc is default from API
  }, [filteredByRegion, search, sortMode]);

  const pinnedItems = useMemo(
    () => visibleItems.filter(i => pinnedKeys.includes(keyForItem(i))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleItems, pinnedKeys]
  );

  const sourceCountMap = useMemo(
    () => items.reduce<Record<string, number>>((acc, i) => {
      acc[i.sourceId] = (acc[i.sourceId] || 0) + 1;
      return acc;
    }, {}),
    [items]
  );

  // Sources that actually errored on their last fetch (not just empty after keyword filter)
  const failedSources = useMemo(() => {
    const ids = new Set<string>();
    if (sourceHealth.length > 0) {
      // Use real health data when available
      sourceHealth.forEach(h => { if (!h.ok) ids.add(h.id); });
    } else {
      // Fall back to zero-count heuristic on first load before health data arrives
      SOURCES.forEach(s => { if (!sourceCountMap[s.id]) ids.add(s.id); });
    }
    return ids;
  }, [sourceHealth, sourceCountMap]);

  const lensCountMap = useMemo(() => {
    const map = {} as Record<LensId, number>;
    LENSES.forEach(l => {
      map[l.id] = l.id === 'all'
        ? filteredBySource.length
        : filteredBySource.filter(i => itemMatchesLens(i, new Set([l.id]))).length;
    });
    return map;
  }, [filteredBySource]);
  const clusters = useMemo(
    () => buildClusters(visibleItems),
    [visibleItems]
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Mobile sidebar overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <header style={{
        borderBottom: `1px solid ${scrolled ? 'transparent' : 'var(--border)'}`,
        background: 'var(--surface)',
        position: 'sticky',
        top: 0,
        zIndex: 200,
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
        transition: 'box-shadow 0.3s ease, border-color 0.3s ease',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '11px 0 9px', gap: 10 }}>

            {/* Hamburger (mobile only) */}
            <button
              className="icon-btn menu-btn"
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Toggle sidebar"
              title="Sources & filters"
            >
              ☰
            </button>

            {/* Wordmark + badges */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 20,
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  color: 'var(--text-primary)',
                  lineHeight: 1,
                }}>
                  FrameTheGlobeNews
                </h1>

                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                  padding: '2px 6px',
                  borderRadius: 2,
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}>
                  Global Pivot
                </span>

                {/* Live / connection indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    className="live-dot"
                    style={{
                      background: liveStatus === 'live'
                        ? '#27ae60'
                        : liveStatus === 'connecting'
                        ? '#f39c12'
                        : '#7f8c8d',
                    }}
                  />
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: liveStatus === 'live'
                      ? '#27ae60'
                      : liveStatus === 'connecting'
                      ? '#f39c12'
                      : 'var(--text-muted)',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}>
                    {liveStatus === 'live' ? 'Live' : liveStatus === 'connecting' ? 'Connecting…' : 'Polling'}
                  </span>
                </div>

                {/* Trump / Rapid 47 indicator */}
                {(() => {
                  const tCount = items.filter(i => itemMatchesLens(i, new Set(['trump']))).length;
                  return tCount > 0 ? (
                    <div 
                      onClick={() => setActiveLenses(new Set(['trump']))}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 4, 
                        background: 'var(--brand-blue)', 
                        color: '#fff', 
                        padding: '1px 5px', 
                        borderRadius: 3, 
                        cursor: 'pointer',
                        fontSize: 9,
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 900,
                        letterSpacing: '0.05em'
                      }}
                      title={`${tCount} Rapid 47 Response updates`}
                    >
                      <span>47</span>
                      <span style={{ opacity: 0.8, fontSize: 8 }}>•</span>
                      <span>{tCount}</span>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Stats tiles */}
              {loading ? (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4, letterSpacing: '0.04em' }}>
                  Fetching feeds…
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 5, alignItems: 'center' }}>
                  {/* Stories tile */}
                  <StatTile
                    icon="📰"
                    value={total}
                    label="stories"
                    highlight={false}
                  />
                  {/* Breaking tile */}
                  {(() => {
                    const brk = items.filter(i => (Date.now() - new Date(i.pubDate).getTime()) < 30 * 60_000).length;
                    return brk > 0 ? (
                      <StatTile icon="⚡" value={brk} label="breaking" highlight />
                    ) : null;
                  })()}
                  {/* Sources tile */}
                  <StatTile icon="🌍" value={SOURCES.length} label="sources" highlight={false} />
                  {/* Failed tile */}
                  {failedCount > 0 && (
                    <StatTile icon="⚠" value={failedCount} label="down" highlight={false} dim />
                  )}
                  {/* Updated */}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                    updated {lastUpdated ? timeAgo(lastUpdated) : '—'}
                  </span>
                  {/* Keyboard hint */}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--border)', letterSpacing: '0.06em', marginLeft: 4 }}>
                    j/k·o·/·m
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

              {/* X / Twitter */}
              <a
                href="https://x.com/FrameTheGlobe"
                target="_blank"
                rel="noopener noreferrer"
                className="icon-btn"
                title="Follow @FrameTheGlobe on X"
                aria-label="X / Twitter"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.842L2.25 2.25h6.993l4.261 5.633L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
                </svg>
              </a>

              {/* Substack / Newsletter */}
              <a
                href="https://www.frametheglobenews.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="icon-btn"
                title="FrameTheGlobe Newsletter on Substack"
                aria-label="Substack Newsletter"
                style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
                </svg>
              </a>

              {/* Theme toggle */}
              <button
                className="icon-btn"
                onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
                aria-label="Toggle theme"
              >
                {theme === 'light' ? '◑' : '☀'}
              </button>

              {/* Refresh */}
              <button
                onClick={() => fetchNews()}
                disabled={loading}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  color: loading ? 'var(--text-muted)' : 'var(--text-secondary)',
                  background: 'none',
                  border: '1px solid var(--border)',
                  borderRadius: 3,
                  padding: '5px 10px',
                  cursor: loading ? 'default' : 'pointer',
                  textTransform: 'uppercase',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
              >
                {loading ? '●' : '↻'} Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── BREAKING TICKER ────────────────────────────────────────────── */}
      <BreakingTicker items={items} />

      {/* ── BODY ───────────────────────────────────────────────────────── */}
      <div className="page-layout">

        {/* Sidebar */}
        <aside className={`sidebar-col${sidebarOpen ? ' open' : ''}`}>
          <div style={{ position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {!loading && <LiveVideoWidget />}
            <SidebarPanel
              search={search}
              onSearch={setSearch}
              searchRef={searchRef}
              activeSources={activeSources}
              onToggleSource={toggleSource}
              onAllSources={() => setActiveSources(new Set(SOURCES.map(s => s.id)))}
              onNoSources={() => setActiveSources(new Set([SOURCES[0].id]))}
              sourceCountMap={sourceCountMap}
              failedSources={failedSources}
              pinnedItems={pinnedItems}
              onTogglePin={togglePin}
              keyForItem={keyForItem}
            />
          </div>
        </aside>

        {/* Main feed */}
        <main>
          {/* ── Iran War Theater ─────────────────────────────────── */}
          <IranWarSection items={items} sourceCountMap={sourceCountMap} />

          {/* ── Feed Status (only visible when sources are down) ─── */}
          {sourceHealth.length > 0 && <FeedStatusPanel health={sourceHealth} />}

          {/* ── Widgets row ──────────────────────────────────────── */}
          {!loading && items.length > 0 && (
            <div className="widgets-grid" style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
              gap: 14, 
              marginBottom: 14 
            }}>
              <TopStorylines clusters={clusters} limit={4} />
              <RapidResponse 
                items={items} 
                limit={4} 
                onViewAll={() => setActiveLenses(new Set(['trump']))}
              />
              <MacroWatch items={items} limit={4} />
              <OilTicker items={items} />
            </div>
          )}

          <RegionStatsStrip items={visibleItems} />

          {/* ── FILTER + VIEW CONTROLS ─────────────────────────────────────── */}
          <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>

            {/* Top row: lenses + view/sort controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>

              {/* Lens pills (multi-select) */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flex: 1 }}>
                {/* "All" clear button */}
                <button
                  onClick={() => { setActiveLenses(new Set()); setActiveRegions(new Set()); }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 999,
                    border: `1px solid ${activeLenses.size === 0 ? 'transparent' : 'var(--border-light)'}`,
                    background: activeLenses.size === 0 ? 'var(--text-primary)' : 'var(--surface)',
                    color: activeLenses.size === 0 ? 'var(--bg)' : 'var(--text-muted)',
                    boxShadow: activeLenses.size === 0 ? 'var(--shadow-sm)' : 'none',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                    transition: 'background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s',
                  }}
                >
                  All Topics
                  <span style={{ fontSize: 9, opacity: 0.75 }}>{lensCountMap['all'] ?? 0}</span>
                </button>

                {/* Individual topic lenses (skip index 0 = 'all') */}
                {LENSES.slice(1).map(l => {
                  const active = activeLenses.has(l.id);
                  const count  = lensCountMap[l.id] ?? 0;
                  return (
                    <button
                      key={l.id}
                      title={l.hint}
                      onClick={() => setActiveLenses(prev => {
                        const next = new Set(prev);
                        if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                        return next;
                      })}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        padding: '3px 10px',
                        borderRadius: 999,
                        border: `1px solid ${active ? 'transparent' : 'var(--border-light)'}`,
                        background: active ? 'var(--text-primary)' : 'var(--surface)',
                        color: active ? 'var(--bg)' : 'var(--text-muted)',
                        boxShadow: active ? 'var(--shadow-sm)' : 'none',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4,
                        transition: 'background 0.15s, color 0.15s, border-color 0.15s, box-shadow 0.15s',
                        fontWeight: active ? 500 : 400,
                      }}
                    >
                      {l.label}
                      {count > 0 && (
                        <span style={{ fontSize: 9, opacity: 0.7 }}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right cluster: sort + view mode */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {/* Sort control */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {([
                    ['date-desc', '↓ Date'],
                    ['date-asc',  '↑ Date'],
                    ['source',    'Source'],
                  ] as [SortMode, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      onClick={() => setSortMode(mode)}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        letterSpacing: '0.04em',
                        padding: '4px 8px',
                        borderRadius: 3,
                        border: `1px solid ${sortMode === mode ? 'var(--accent)' : 'var(--border-light)'}`,
                        background: sortMode === mode ? 'var(--accent-light)' : 'transparent',
                        color: sortMode === mode ? 'var(--accent)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>

                {/* View mode */}
                {(['list', 'clusters', 'map'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      letterSpacing: '0.04em',
                      padding: '4px 9px',
                      borderRadius: 3,
                      border: `1px solid ${viewMode === mode ? 'transparent' : 'var(--border-light)'}`,
                      background: viewMode === mode ? 'var(--text-primary)' : 'var(--surface)',
                      color: viewMode === mode ? 'var(--bg)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                      boxShadow: viewMode === mode ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {mode === 'list' ? '≡ Stream' : mode === 'clusters' ? '⊞ Storylines' : '⊕ Map'}
                  </button>
                ))}
              </div>
            </div>

            {/* Region quick-filter strip (shown when ≥2 regions have items) */}
            {availableRegions.size >= 2 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 4 }}>
                  Region
                </span>
                {[...availableRegions].sort().map(reg => {
                  const active = activeRegions.has(reg);
                  const dotColor = REGION_DOTS[reg] || '#999';
                  return (
                    <button
                      key={reg}
                      onClick={() => setActiveRegions(prev => {
                        const next = new Set(prev);
                        if (next.has(reg)) next.delete(reg); else next.add(reg);
                        return next;
                      })}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        padding: '2px 8px',
                        borderRadius: 999,
                        border: `1px solid ${active ? dotColor : 'var(--border-light)'}`,
                        background: active ? `${dotColor}18` : 'transparent',
                        color: active ? dotColor : 'var(--text-muted)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                        transition: 'background 0.12s, color 0.12s, border-color 0.12s',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? dotColor : 'var(--border)', flexShrink: 0, display: 'inline-block' }} />
                      {REGION_LABELS[reg as Source['region']] || reg}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Active filter summary + clear */}
            {(activeLenses.size > 0 || activeRegions.size > 0 || search) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.03em', flexWrap: 'wrap' }}>
                <span>{visibleItems.length} stories shown</span>
                {activeLenses.size > 0 && (
                  <span>
                    · lenses: {[...activeLenses].map(id => LENSES.find(l => l.id === id)?.label).filter(Boolean).join(', ')}
                  </span>
                )}
                {activeRegions.size > 0 && (
                  <span>· regions: {[...activeRegions].map(r => REGION_LABELS[r as Source['region']] || r).join(', ')}</span>
                )}
                {search && <span style={{ color: 'var(--accent)' }}>· &ldquo;{search}&rdquo;</span>}
                <button
                  onClick={() => { setActiveLenses(new Set()); setActiveRegions(new Set()); setSearch(''); }}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    color: 'var(--accent)', background: 'none',
                    border: '1px solid var(--accent)', borderRadius: 3,
                    padding: '1px 7px', cursor: 'pointer', letterSpacing: '0.04em',
                    transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  ✕ Clear all
                </button>
              </div>
            )}
          </div>

          {/* ── LOADING skeleton ───────────────────────────────────────── */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    background:   'var(--surface)',
                    padding:      '14px 18px',
                    borderTop:    '1px solid var(--border-light)',
                    borderRight:  '1px solid var(--border-light)',
                    borderBottom: '1px solid var(--border-light)',
                    borderLeft:   '3px solid var(--border)',
                    opacity:      1 - i * 0.07,
                  }}
                >
                  <div className="skeleton" style={{ height: 14, width: `${68 - i * 3}%`, marginBottom: 8 }} />
                  <div className="skeleton" style={{ height: 10, width: '88%', marginBottom: 5, opacity: 0.65 }} />
                  <div className="skeleton" style={{ height: 10, width: '52%', opacity: 0.4 }} />
                </div>
              ))}
            </div>

          /* ── EMPTY state ──────────────────────────────────────────── */
          ) : visibleItems.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)',
              letterSpacing: '0.05em',
            }}>
              {search
                ? `No stories match "${search}" — try a broader term.`
                : 'No stories found. Try a different lens or refresh.'
              }
            </div>

          /* ── STREAM view ──────────────────────────────────────────── */
          ) : viewMode === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {visibleItems.map((item, i) => {
                const badge = getAgeBadge(item.pubDate);
                const isPinned = pinnedKeys.includes(keyForItem(item));
                const isFocused = focusedIdx === i;
                return (
                  <article
                    key={keyForItem(item)}
                    className={`article-card ${isFocused ? 'focused' : ''}`}
                    style={{
                      background:   'var(--surface)',
                      borderTop:    '1px solid var(--border-light)',
                      borderRight:  '1px solid var(--border-light)',
                      borderBottom: '1px solid var(--border-light)',
                      borderLeft:   `3px solid ${REGION_DOTS[item.region] || '#999'}`,
                      padding:      '14px 18px',
                      animation:    `fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(i, 12) * 0.03}s both`,
                    }}
                    onMouseEnter={() => setFocusedIdx(i)}
                  >
                      <div style={{ display: 'flex', gap: 14 }}>
                        {item.imageUrl && !imageErrors.has(item.imageUrl) && (
                          <div style={{
                            width: 100, height: 75, flexShrink: 0,
                            borderRadius: 4, overflow: 'hidden',
                            background: 'var(--border-light)'
                          }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                              src={item.imageUrl} 
                              alt="" 
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                              onError={() => setImageErrors(prev => {
                                const next = new Set(prev);
                                next.add(item.imageUrl!);
                                return next;
                              })}
                            />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Title row */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 5 }}>
                            {badge === 'breaking' && (
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em',
                                textTransform: 'uppercase', flexShrink: 0, marginTop: 2,
                                color: 'var(--badge-brk-color)', background: 'var(--badge-brk-bg)',
                                border: '1px solid var(--badge-brk-border)', padding: '1px 5px', borderRadius: 2,
                                display: 'inline-flex', alignItems: 'center', gap: 4
                              }}>
                                <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--badge-brk-color)', animation: 'pulse-dot 1s infinite' }} />
                                Breaking
                              </span>
                            )}
                            {badge === 'new' && (
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em',
                                textTransform: 'uppercase', flexShrink: 0, marginTop: 2,
                                color: 'var(--badge-new-color)', background: 'var(--badge-new-bg)',
                                border: '1px solid var(--badge-new-border)', padding: '1px 5px', borderRadius: 2,
                              }}>
                                New
                              </span>
                            )}
                            <a
                              href={item.link || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-article-idx={i}
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 16,
                                fontWeight: 700,
                                color: 'var(--text-primary)',
                                textDecoration: 'none',
                                lineHeight: 1.35,
                                flex: 1,
                                textWrap: 'balance',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                            >
                              {item.title}
                            </a>
                          </div>

                          {/* Summary */}
                          {item.summary && (
                            <p style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 13,
                              color: 'var(--text-secondary)',
                              lineHeight: 1.55,
                              fontWeight: 400,
                              marginBottom: 8,
                            }}>
                              {truncate(item.summary)}
                            </p>
                          )}
                        </div>
                      </div>

                    {/* Meta row */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                      flexWrap: 'wrap',
                    }}>
                      <button
                        onClick={() => togglePin(item)}
                        style={{
                          border: 'none', background: 'transparent',
                          cursor: 'pointer', fontSize: 11, padding: 0,
                          color: isPinned ? 'var(--pin-active)' : 'var(--text-muted)',
                          transition: 'color 0.1s',
                        }}
                      >
                        {isPinned ? '★ Unpin' : '☆ Pin'}
                      </button>
                      <span style={{ color: 'var(--border-light)' }}>/</span>
                      <span style={{ color: REGION_DOTS[item.region] || '#999', fontWeight: 600 }}>
                        {item.sourceName}
                      </span>
                      <span style={{ color: 'var(--border-light)' }}>/</span>
                      <span>{REGION_LABELS[item.region as Source['region']] || item.region}</span>
                      <span style={{ color: 'var(--border-light)' }}>/</span>
                      <span>{timeAgo(item.pubDate)}</span>
                    </div>
                  </article>
                );
              })}
            </div>

          /* ── MAP view ─────────────────────────────────────────────── */
          ) : viewMode === 'map' ? (
            <MapView items={visibleItems} />

          /* ── STORYLINES / CLUSTERS view ──────────────────────────── */
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clusters.map(cluster => (
                <article
                  key={cluster.id}
                  className="article-card"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-light)',
                    padding: '14px 18px',
                    animation: 'fadeUp 0.25s ease both',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 12 }}>
                    <h2 style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}>
                      {cluster.title}
                    </h2>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.04em',
                      flexShrink: 0,
                    }}>
                      {cluster.items.length} reports · {new Set(cluster.items.map(i => i.region)).size} regions
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {Object.entries(
                      cluster.items.reduce<Record<string, FeedItem[]>>((acc, item) => {
                        (acc[item.region] ||= []).push(item);
                        return acc;
                      }, {})
                    ).map(([reg, regItems]) => (
                      <div key={reg} style={{ minWidth: 150, flex: 1 }}>
                        <div style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          color: REGION_DOTS[reg] || '#999',
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          marginBottom: 5,
                        }}>
                          {REGION_LABELS[reg as Source['region']] || reg}
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {regItems.map(item => (
                            <li key={keyForItem(item)}>
                              <a
                                href={item.link || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  fontFamily: 'var(--font-body)',
                                  fontSize: 12,
                                  color: 'var(--text-secondary)',
                                  textDecoration: 'none',
                                  transition: 'color 0.1s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                              >
                                <span style={{ fontWeight: 500 }}>{item.sourceName}:</span> {item.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Footer count */}
          {!loading && visibleItems.length > 0 && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '22px 0',
              letterSpacing: '0.05em',
            }}>
              {visibleItems.length} stories · {liveStatus === 'live' ? 'live via SSE' : 'auto-refreshes every 10 min'}
            </div>
          )}
        </main>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: '1px solid var(--border-light)',
        padding: '14px 24px',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-muted)',
        letterSpacing: '0.06em',
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>frametheglobe.xyz</span>

        {/* Social links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a
            href="https://x.com/FrameTheGlobe"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              color: 'var(--text-muted)', textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {/* X / Twitter icon */}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.842L2.25 2.25h6.993l4.261 5.633L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
            @FrameTheGlobe
          </a>

          <span style={{ color: 'var(--border)' }}>·</span>

          <a
            href="https://www.frametheglobenews.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              color: 'var(--text-muted)', textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            {/* Substack icon */}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
            </svg>
            Newsletter
          </a>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>open-source · no tracking · no ads · {SOURCES.length} sources</span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <a
            href="/api/rss"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              color: '#e8a020', textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            title="Subscribe via RSS"
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = '#e8a020')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M6.18 15.64a2.18 2.18 0 0 1 2.18 2.18C8.36 19.01 7.38 20 6.18 20C4.98 20 4 19.01 4 17.82a2.18 2.18 0 0 1 2.18-2.18M4 4.44A15.56 15.56 0 0 1 19.56 20h-2.83A12.73 12.73 0 0 0 4 7.27V4.44m0 5.66a9.9 9.9 0 0 1 9.9 9.9h-2.83A7.07 7.07 0 0 0 4 12.93V10.1z"/>
            </svg>
            RSS Feed
          </a>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span style={{ color: 'var(--border)', fontSize: 8 }}>j/k·o·/·m·r</span>
        </div>
      </footer>
    </div>
  );
}
