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
import DailyBriefing, { BriefCluster } from './components/DailyBriefing';
import CrossSourceComparison, { CompItem } from './components/CrossSourceComparison';
import IntelTimeline from './components/IntelTimeline';

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
  | 'trump' | 'china-pivot' | 'russia-news' | 'epstein';

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
  { id: 'epstein',     label: 'Epstein Files',     hint: 'Jeffrey Epstein document releases, EFTA files, Ghislaine Maxwell, investigations.', keywords: ['epstein','jeffrey epstein','ghislaine','maxwell','efta','epstein files','lolita express','little saint james','sex trafficking','pedophile network','jmail','epstein documents','epstein emails','epstein estate','epstein network'] },
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

// Pre-built map: lensId → its LENSES definition (avoids LENSES.find on every item)
const LENS_MAP = Object.fromEntries(LENSES.map(l => [l.id, l])) as Record<LensId, typeof LENSES[0]>;

// Pre-built single-id Sets for the lensCountMap computation.
// Created once at module load — never recreated inside useMemo loops.
const SINGLE_LENS_SETS: Partial<Record<LensId, Set<LensId>>> = Object.fromEntries(
  LENSES.filter(l => l.id !== 'all').map(l => [l.id, new Set([l.id]) as Set<LensId>])
);

// ── Pure helpers ──────────────────────────────────────────────────────────────
function itemMatchesLens(item: FeedItem, activeLenses: Set<LensId>): boolean {
  if (activeLenses.size === 0) return true; // empty selection = show all
  const text = `${item.title} ${item.summary}`.toLowerCase();
  // Iterate Set directly — no intermediate array allocation from spread.
  for (const lensId of activeLenses) {
    const def = LENS_MAP[lensId];
    if (def && def.keywords.some(kw => text.includes(kw))) return true;
  }
  return false;
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

// Hoisted regex constants — compiled once at module load, not per call.
const RE_NON_ALNUM = /[^a-z0-9\s]/g;
const RE_WHITESPACE = /\s+/;

function titleToKeySet(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(RE_NON_ALNUM, '')
      .split(RE_WHITESPACE)
      .filter(w => w.length > 2 && !CLUSTER_STOPWORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  // Count intersection without spreading either Set into a temporary array.
  let intersection = 0;
  a.forEach(w => { if (b.has(w)) intersection++; });
  const union = a.size + b.size - intersection; // |A∪B| = |A| + |B| - |A∩B|
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
  sourceHealth: SourceHealth[];
  sourceCountMap: Record<string, number>;
  failedSources: Set<string>;
  pinnedItems: FeedItem[];
  onTogglePin: (item: FeedItem) => void;
  keyForItem: (item: FeedItem) => string;
};

function SidebarPanel({
  search, onSearch, searchRef,
  activeSources, onToggleSource, onAllSources, onNoSources,
  sourceCountMap, failedSources, sourceHealth,
  pinnedItems, onTogglePin, keyForItem,
}: SidebarPanelProps) {
  const [healthOpen, setHealthOpen] = useState(false);
  const failedHealth  = sourceHealth.filter(h => !h.ok);
  const isAllHealthy  = sourceHealth.length > 0 && failedHealth.length === 0;
  const total         = sourceHealth.length || SOURCES.length;

  return (
    <div style={{ fontFamily: 'var(--font-mono)' }}>

      {/* ── Feed Status (always visible) ──────────────────────────────── */}
      <div style={{
        marginBottom: 14,
        border:       '1px solid var(--border-light)',
        borderRadius: 3,
        overflow:     'hidden',
      }}>
        {/* Status header — clickable when there are failures */}
        <button
          onClick={() => failedHealth.length > 0 && setHealthOpen(v => !v)}
          style={{
            width:          '100%',
            display:        'flex',
            alignItems:     'center',
            gap:            7,
            padding:        '7px 10px',
            background:     isAllHealthy
              ? 'rgba(39,174,96,0.06)'
              : failedHealth.length > 0
                ? 'rgba(231,76,60,0.06)'
                : 'var(--surface-hover)',
            border:         'none',
            cursor:         failedHealth.length > 0 ? 'pointer' : 'default',
            textAlign:      'left',
          }}
        >
          <span style={{
            width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
            background: isAllHealthy ? '#27ae60'
              : failedHealth.length > 0 ? '#c93a20'
              : 'var(--text-muted)',
          }} />
          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      9,
            fontWeight:    600,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            color: isAllHealthy ? '#27ae60'
              : failedHealth.length > 0 ? '#c93a20'
              : 'var(--text-muted)',
            flex: 1,
          }}>
            {sourceHealth.length === 0
              ? 'Feed Status'
              : isAllHealthy
                ? `All ${total} sources online`
                : `${failedHealth.length} of ${total} sources down`}
          </span>
          {failedHealth.length > 0 && (
            <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>
              {healthOpen ? '▲' : '▼'}
            </span>
          )}
        </button>

        {/* Expanded failure list */}
        {healthOpen && failedHealth.length > 0 && (() => {
          const byRegion: Record<string, SourceHealth[]> = {};
          failedHealth.forEach(h => {
            const r = h.region || 'unknown';
            if (!byRegion[r]) byRegion[r] = [];
            byRegion[r].push(h);
          });
          return (
            <div style={{ padding: '6px 10px 8px', borderTop: '1px solid var(--border-light)' }}>
              {Object.entries(byRegion).map(([region, sources]) => (
                <div key={region} style={{ marginBottom: 8 }}>
                  <div style={{
                    fontSize: 7, letterSpacing: '0.14em', textTransform: 'uppercase',
                    color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700,
                  }}>
                    {REGION_LABELS[region as Source['region']] || region}
                  </div>
                  {sources.map(h => (
                    <div key={h.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 6, marginBottom: 3,
                    }}>
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {h.name}
                      </span>
                      <span style={{ fontSize: 8, color: '#c93a20', flexShrink: 0 }}>
                        {h.errorMsg || 'Error'}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 4 }}>
                Cached data served where available.
              </div>
            </div>
          );
        })()}
      </div>

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

// ── Feed Loading Screen ────────────────────────────────────────────────────────
// Replaces the generic skeleton during initial page load. Uses mission-ops
// language and animated progress to tell the reader exactly what's happening.

const LOADING_REGIONS = [
  'Iran','Gaza','Lebanon','Afghanistan',
  'Pakistan','China','Russia','US','Middle East','Global',
];

const LOADING_MESSAGES = [
  'ESTABLISHING SECURE FEED CONNECTIONS',
  'Querying Iranian state media…',
  'Scanning GDELT conflict database…',
  'Pulling Middle East wire services…',
  'Indexing war theater developments…',
  'Cross-referencing South Asia sources…',
  'Aggregating open-source intelligence…',
  'Scanning maritime & energy feeds…',
  'Pulling diplomatic channel updates…',
  'Indexing proxy network activity…',
  'Cross-referencing CENTCOM region…',
  'Scanning Hormuz chokepoint feeds…',
  'Calibrating relevance filters…',
  'Sorting by recency…',
  'WAR THEATER READY',
];

function FeedLoadingScreen({ sourceCount, isDone }: { sourceCount: number; isDone: boolean }) {
  const [msgIdx,    setMsgIdx]    = useState(0);
  const [regionIdx, setRegionIdx] = useState(-1);
  const [dots,      setDots]      = useState('');

  // Cycle through status messages — hold at second-to-last until isDone,
  // so the screen never falsely shows "WAR THEATER READY" on a timer.
  useEffect(() => {
    const maxIdx = isDone ? LOADING_MESSAGES.length - 1 : LOADING_MESSAGES.length - 2;
    const t = setInterval(() => {
      setMsgIdx(i => Math.min(i + 1, maxIdx));
    }, 380);
    return () => clearInterval(t);
  }, [isDone]);

  // When real data arrives, jump immediately to the final message.
  useEffect(() => {
    if (isDone) setMsgIdx(LOADING_MESSAGES.length - 1);
  }, [isDone]);

  // Light up region chips one by one
  useEffect(() => {
    if (regionIdx >= LOADING_REGIONS.length - 1) return;
    const t = setTimeout(() => setRegionIdx(i => i + 1), 340);
    return () => clearTimeout(t);
  }, [regionIdx]);

  // Blinking cursor dots
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length < 3 ? d + '.' : ''), 420);
    return () => clearInterval(t);
  }, []);

  // Progress bar: CSS animation fills to ~88% over ~5s then holds
  const total = sourceCount || SOURCES.length;
  const msg   = LOADING_MESSAGES[msgIdx];
  // isFinal is driven by real load state, not by the message timer.
  const isFinal = isDone;

  return (
    <>
      <style>{`
        @keyframes ftg-bar-fill {
          0%   { width: 0%; }
          30%  { width: 35%; }
          60%  { width: 60%; }
          85%  { width: 82%; }
          100% { width: 88%; }
        }
        .ftg-progress-bar {
          animation: ftg-bar-fill 5s cubic-bezier(0.15, 0.5, 0.3, 1) forwards;
        }
        .ftg-progress-bar-done {
          width: 100%;
          transition: width 0.4s ease;
        }
        @keyframes ftg-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        .ftg-cursor { animation: ftg-blink 1s step-end infinite; }
      `}</style>

      <div style={{
        border:       '1px solid var(--border-light)',
        borderTop:    '3px solid #c93a20',
        borderRadius: '0 0 4px 4px',
        background:   'var(--surface)',
        padding:      '28px 28px 24px',
        marginBottom: 10,
        fontFamily:   'var(--font-mono)',
      }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#c93a20', flexShrink: 0,
            boxShadow:  '0 0 0 3px rgba(201,58,32,0.18)',
            animation:  'pulse 1.5s infinite',
          }} />
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: '#c93a20',
          }}>
            FrameTheGlobe · Intelligence Feed
          </span>
          <span style={{
            fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em',
            border: '1px solid var(--border-light)', padding: '1px 7px', borderRadius: 2,
            marginLeft: 'auto',
          }}>
            {total} sources · {LOADING_REGIONS.length} regions
          </span>
        </div>

        {/* Big status line */}
        <div style={{
          fontSize: 13, fontWeight: 600, letterSpacing: '0.06em',
          color: isFinal ? '#27ae60' : 'var(--text-secondary)',
          minHeight: 20, marginBottom: 16,
          transition: 'color 0.3s',
        }}>
          {msg}
          {!isFinal && <span className="ftg-cursor" style={{ color: 'var(--accent)', marginLeft: 2 }}>█</span>}
        </div>

        {/* Progress bar */}
        <div style={{
          height: 4, background: 'var(--border-light)',
          borderRadius: 2, overflow: 'hidden', marginBottom: 18,
        }}>
          <div
            className={isFinal ? 'ftg-progress-bar-done' : 'ftg-progress-bar'}
            style={{
              height: '100%',
              background: isFinal
                ? '#27ae60'
                : 'linear-gradient(90deg, #c93a20, #e67e22)',
              borderRadius: 2,
            }}
          />
        </div>

        {/* Region chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22 }}>
          {LOADING_REGIONS.map((r, i) => {
            const lit = i <= regionIdx;
            return (
              <span
                key={r}
                style={{
                  fontFamily:    'var(--font-mono)',
                  fontSize:      9,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding:       '2px 8px',
                  borderRadius:  2,
                  border:        `1px solid ${lit ? '#c93a2055' : 'var(--border-light)'}`,
                  background:    lit ? 'rgba(201,58,32,0.06)' : 'transparent',
                  color:         lit ? '#c93a20' : 'var(--text-muted)',
                  transition:    'background 0.3s, color 0.3s, border-color 0.3s',
                }}
              >
                {r}
              </span>
            );
          })}
        </div>

        {/* Sub-message */}
        <div style={{
          fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.05em',
        }}>
          Feeds are fetched on-demand and cached · typical load 3–6 s · {dots || '…'}
        </div>
      </div>

      {/* Ghost skeleton cards below — give the page a sense of incoming content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, opacity: 0.4 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            background:  'var(--surface)',
            padding:     '14px 18px',
            borderTop:   '1px solid var(--border-light)',
            borderRight: '1px solid var(--border-light)',
            borderBottom:'1px solid var(--border-light)',
            borderLeft:  '3px solid var(--border)',
            opacity:     1 - i * 0.16,
          }}>
            <div className="skeleton" style={{ height: 13, width: `${70 - i * 4}%`, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 9,  width: '85%', marginBottom: 5, opacity: 0.6 }} />
            <div className="skeleton" style={{ height: 9,  width: '45%', opacity: 0.35 }} />
          </div>
        ))}
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function Home() {
  const [items, setItems]               = useState<FeedItem[]>([]);
  const [loading, setLoading]           = useState(true);
  // Controls the loading screen visibility independently so we can show
  // the green "WAR THEATER READY" completion flash before unmounting.
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [loadingDone, setLoadingDone]             = useState(false);
  const loadingScreenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  // ── Addict-loop features ──────────────────────────────────────────────
  const [readKeys, setReadKeys]               = useState<Set<string>>(new Set());
  const [lastVisitTime, setLastVisitTime]     = useState<number>(0);
  const [newCount, setNewCount]               = useState(0);
  const [watchlistKeywords, setWatchlistKeywords] = useState<string[]>([]);
  const [watchlistInput, setWatchlistInput]   = useState('');
  const [expandedComparisons, setExpandedComparisons] = useState<Set<string>>(new Set());
  const [briefingOpen, setBriefingOpen]       = useState(true);
  const [briefingDismissed, setBriefingDismissed] = useState(false);
  const [hasMounted, setHasMounted]               = useState(false);
  const [missionTime, setMissionTime]             = useState<string | null>(null);

  // ── Mission Timer (Client-only to avoid hydration mismatch) ──────────────
  useEffect(() => {
    setHasMounted(true);
    const update = () => setMissionTime(new Date().toISOString().slice(11, 19));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Debounce search ───────────────────────────────────────────────────────
  // Avoids re-running the O(n) itemMatchesSearch filter on every keystroke.
  // The displayed value (search) updates immediately; the value that feeds
  // the useMemo (debouncedSearch) settles 200ms after the user stops typing.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

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

  // ── Loading screen lifecycle ───────────────────────────────────────────────
  // When loading flips true (initial load or refresh): reset the screen.
  // When loading flips false (data arrived): show green completion for 650ms then hide.
  useEffect(() => {
    if (loading) {
      if (loadingScreenTimerRef.current) clearTimeout(loadingScreenTimerRef.current);
      setShowLoadingScreen(true);
      setLoadingDone(false);
    } else {
      setLoadingDone(true);
      loadingScreenTimerRef.current = setTimeout(() => setShowLoadingScreen(false), 650);
    }
    return () => {
      if (loadingScreenTimerRef.current) clearTimeout(loadingScreenTimerRef.current);
    };
  }, [loading]);

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

  // ── Read/unread persistence ───────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('ftg_read');
      if (raw) { const r = JSON.parse(raw); if (Array.isArray(r)) setReadKeys(new Set(r)); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // Keep only most recent 500 read keys to avoid unbounded growth
      const arr = [...readKeys].slice(-500);
      window.localStorage.setItem('ftg_read', JSON.stringify(arr));
    } catch { /* ignore */ }
  }, [readKeys]);

  // ── Last-visit timestamp (for new-story counter) ──────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem('ftg_last_visit');
      const ts = saved ? parseInt(saved, 10) : 0;
      setLastVisitTime(ts);
      // Save current time as the last-visit time so next visit sees a delta
      const handleHide = () => {
        try { window.localStorage.setItem('ftg_last_visit', String(Date.now())); } catch { /* ignore */ }
      };
      document.addEventListener('visibilitychange', handleHide);
      return () => document.removeEventListener('visibilitychange', handleHide);
    } catch { /* ignore */ }
  }, []);

  // ── Watchlist persistence ─────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('ftg_watchlist');
      if (raw) { const w = JSON.parse(raw); if (Array.isArray(w)) setWatchlistKeywords(w); }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { window.localStorage.setItem('ftg_watchlist', JSON.stringify(watchlistKeywords)); } catch { /* ignore */ }
  }, [watchlistKeywords]);

  // ── Briefing dismissed-today persistence ──────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const today = new Date().toDateString();
      const dismissed = window.localStorage.getItem('ftg_briefing_dismissed');
      if (dismissed === today) setBriefingDismissed(true);
    } catch { /* ignore */ }
  }, []);

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
  // Wrapped in useCallback so the stable references prevent unnecessary
  // re-renders of child components that receive them as props.
  const keyForItem = useCallback((item: FeedItem) => {
    // Some RSS parsers return '#' or a blank string when no link is available.
    // Treat those as missing so we fall through to a unique composite key.
    const link = item.link && item.link !== '#' && item.link.startsWith('http')
      ? item.link
      : null;
    return link ?? `${item.sourceId}::${item.title}::${item.pubDate}`;
  }, []); // pure function — no external dependencies

  const togglePin = useCallback((item: FeedItem) => {
    const key = keyForItem(item);
    setPinnedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  }, [keyForItem]);

  const itemsCount = items.length;

  // ── INTEL TIMELINE DATA (GDELT + CRITICAL) ─────────────────────────
  const intelEvents = useMemo(() => {
    // Filter for GDELT or other "ops" / conflict style items
    const opsItems = items.filter(item => 
      item.sourceId.includes('gdelt') || 
      item.sourceId === 'liveleak-osint' ||
      item.title.toLowerCase().includes('strike') ||
      item.title.toLowerCase().includes('explosion') ||
      item.title.toLowerCase().includes('intercept') ||
      item.title.toLowerCase().includes('attack')
    );

    return opsItems.slice(0, 15).map(item => ({
      id: item.link + item.pubDate,
      location: item.region ? item.region.toUpperCase() : 'OPERATIONAL',
      subLocation: item.sourceName,
      status: (item.title.toLowerCase().includes('strike') || item.title.toLowerCase().includes('attack') || item.title.toLowerCase().includes('nuclear')) ? 'CRITICAL' : 'ELEVATED' as any,
      timestamp: new Date(item.pubDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateHeader: new Date(item.pubDate).toLocaleDateString([], { month: 'short', day: 'numeric' }),
      description: item.title
    }));
  }, [items]);

  const toggleSource = useCallback((id: string) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); }
      else next.add(id);
      return next;
    });
  }, []); // uses only the setter — stable forever

  const viewAllByKeyword = useCallback((kw: string) => {
    setSearch(kw);
    setActiveLenses(new Set());
    setActiveRegions(new Set());
  }, [setSearch, setActiveLenses, setActiveRegions]);

  const selectAllSources = useCallback(
    () => setActiveSources(new Set(SOURCES.map(s => s.id))),
    []
  );
  const selectNoSources = useCallback(
    () => setActiveSources(new Set([SOURCES[0].id])),
    []
  );

  // ── Derived data ──────────────────────────────────────────────────────────
  // De-duplicate first: some sources (e.g. China Daily) emit multiple items
  // with identical titles and timestamps, and GDELT/syndication can produce
  // the same URL from two different source IDs.
  const markRead = useCallback((key: string) => {
    setReadKeys(prev => { const next = new Set(prev); next.add(key); return next; });
  }, []);

  const addWatchword = useCallback((word: string) => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) return;
    setWatchlistKeywords(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    setWatchlistInput('');
  }, []);

  const removeWatchword = useCallback((word: string) => {
    setWatchlistKeywords(prev => prev.filter(k => k !== word));
  }, []);

  const toggleComparison = useCallback((key: string) => {
    setExpandedComparisons(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const dismissBriefing = useCallback(() => {
    setBriefingDismissed(true);
    setBriefingOpen(false);
    try { window.localStorage.setItem('ftg_briefing_dismissed', new Date().toDateString()); } catch { /* ignore */ }
  }, []);

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
    const filtered = filteredByRegion.filter(i => itemMatchesSearch(i, debouncedSearch));
    if (sortMode === 'date-asc') return [...filtered].reverse();
    if (sortMode === 'source') return [...filtered].sort((a, b) => a.sourceName.localeCompare(b.sourceName));
    return filtered;
  }, [filteredByRegion, debouncedSearch, sortMode]);

  const pinnedItems = useMemo(
    () => visibleItems.filter(i => pinnedKeys.includes(keyForItem(i))),
    [visibleItems, pinnedKeys, keyForItem]
  );

  const sourceCountMap = useMemo(
    () => items.reduce<Record<string, number>>((acc, i) => {
      acc[i.sourceId] = (acc[i.sourceId] || 0) + 1;
      return acc;
    }, {}),
    [items]
  );

  const failedSources = useMemo(() => {
    const ids = new Set<string>();
    if (sourceHealth.length > 0) {
      sourceHealth.forEach(h => { if (!h.ok) ids.add(h.id); });
    } else {
      SOURCES.forEach(s => { if (!sourceCountMap[s.id]) ids.add(s.id); });
    }
    return ids;
  }, [sourceHealth, sourceCountMap]);

  const lensCountMap = useMemo(() => {
    const map = {} as Record<LensId, number>;
    LENSES.forEach(l => {
      map[l.id] = l.id === 'all'
        ? filteredBySource.length
        : filteredBySource.filter(i => itemMatchesLens(i, SINGLE_LENS_SETS[l.id]!)).length;
    });
    return map;
  }, [filteredBySource]);

  const clusters = useMemo(
    () => buildClusters(visibleItems),
    [visibleItems]
  );

  // ── New-story counter (items newer than last visit) ──────────────────────
  useEffect(() => {
    if (!lastVisitTime || loading) return;
    const count = items.filter(i => new Date(i.pubDate).getTime() > lastVisitTime).length;
    setNewCount(count);
  }, [items, lastVisitTime, loading]);

  // ── Coverage map: how many sources cover same event ───────────────────────
  const coverageMap = useMemo(() => {
    const map = new Map<string, number>();
    clusters.forEach(cluster => {
      const sources = new Set(cluster.items.map(i => i.sourceId));
      cluster.items.forEach(item => {
        const key = item.link || `${item.sourceId}::${item.title}`;
        map.set(key, sources.size);
      });
    });
    return map;
  }, [clusters]);

  // ── Developing stories: cluster has 3+ items AND activity in last 2h ─────
  const developingSet = useMemo(() => {
    const TWO_HOURS = 2 * 3600_000;
    const set = new Set<string>();
    clusters.forEach(cluster => {
      if (cluster.items.length < 3) return;
      const hasRecent = cluster.items.some(i =>
        Date.now() - new Date(i.pubDate).getTime() < TWO_HOURS
      );
      if (!hasRecent) return;
      cluster.items.forEach(i => set.add(i.link || `${i.sourceId}::${i.title}`));
    });
    return set;
  }, [clusters]);

  // ── Surprising consensus: Western + (China/Russia/Iranian) same cluster ───
  const surprisingSet = useMemo(() => {
    const WESTERN = new Set(['western']);
    const COUNTER  = new Set(['china', 'russia', 'iranian']);
    const set = new Set<string>();
    clusters.forEach(cluster => {
      if (cluster.items.length < 2) return;
      const regions = new Set(cluster.items.map(i => i.region));
      const hasWest = [...regions].some(r => WESTERN.has(r));
      const hasCounter = [...regions].some(r => COUNTER.has(r));
      if (!hasWest || !hasCounter) return;
      cluster.items.forEach(i => set.add(i.link || `${i.sourceId}::${i.title}`));
    });
    return set;
  }, [clusters]);

  // ── Watchlist matches ─────────────────────────────────────────────────────
  const watchlistMatches = useMemo(() => {
    if (!watchlistKeywords.length) return [];
    const lower = watchlistKeywords.map(k => k.toLowerCase());
    return visibleItems.filter(item => {
      const text = `${item.title} ${item.summary}`.toLowerCase();
      return lower.some(kw => text.includes(kw));
    });
  }, [visibleItems, watchlistKeywords]);

  // ── Comparison map: per item key → sibling items in same cluster ──────────
  const comparisonMap = useMemo(() => {
    const map = new Map<string, CompItem[]>();
    clusters.forEach(cluster => {
      if (cluster.items.length < 2) return;
      const compItems: CompItem[] = cluster.items.map(i => ({
        sourceName: i.sourceName,
        sourceColor: i.sourceColor,
        region: i.region,
        title: i.title,
        summary: i.summary,
        link: i.link,
        pubDate: i.pubDate,
      }));
      cluster.items.forEach(i => {
        const key = i.link || `${i.sourceId}::${i.title}`;
        map.set(key, compItems);
      });
    });
    return map;
  }, [clusters]);

  // ── Brief clusters for daily briefing ─────────────────────────────────────
  const briefClusters = useMemo((): BriefCluster[] => {
    return clusters.slice(0, 8).map(cluster => ({
      id: cluster.id,
      title: cluster.title,
      sourceCount: new Set(cluster.items.map(i => i.sourceId)).size,
      regionCount: new Set(cluster.items.map(i => i.region)).size,
      regions: [...new Set(cluster.items.map(i => i.region))],
      latestPubDate: cluster.items[0]?.pubDate || '',
      topItems: cluster.items.slice(0, 3).map(i => ({
        sourceName: i.sourceName,
        sourceColor: i.sourceColor,
        title: i.title,
        link: i.link,
      })),
    }));
  }, [clusters]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', position: 'relative' }}>
      {/* Tactical visual layer */}
      <div className="scanline-overlay" />

      {/* Mobile sidebar overlay */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden
      />

      {/* ── ELITE MISSION HUD HEADER ────────────────────────────────────────── */}
      <header className="command-header-hud" style={{ 
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--bg)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: 'var(--shadow-md)',
        height: 'auto',
        minHeight: 100
      }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <div className="scanning-bar" />
            
            {/* Top Tactical Metadata - Higher Contrast */}
            <div style={{
              borderBottom: '1px solid var(--border)',
              padding: '8px 25px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              letterSpacing: '0.12em',
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              fontWeight: 700
            }}>
              <div style={{ display: 'flex', gap: 30 }}>
                <span>NODE: <span style={{ color: 'var(--accent)', fontWeight: 800 }}>HORMUZ-SECTOR-7</span></span>
                <span>STATE: <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>ENCRYPTED</span></span>
              </div>
              <div style={{ display: 'flex', gap: 25 }}>
                <span className="hud-glitch-active" style={{ color: 'var(--accent)', fontWeight: 900 }}>SECURITY: LEVEL 5</span>
                <span>VER: <span style={{ color: 'var(--text-primary)', fontWeight: 800 }}>5.2.10</span></span>
              </div>
            </div>

            {/* Central Newspaper Identity */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              padding: '18px 0 12px 0',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg)'
            }}>
                <h1 className="glitch-text" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{
                  fontSize: 38, 
                  fontWeight: 900, 
                  cursor: 'pointer', 
                  fontFamily: 'var(--font-display)', 
                  color: 'var(--text-primary)', 
                  letterSpacing: '-0.03em',
                  textTransform: 'uppercase',
                  lineHeight: 0.85,
                  textAlign: 'center'
                }}>
                  FRAME<span style={{ color: 'var(--accent)' }}>THEGLOBE</span>
                  <span style={{ display: 'block', fontSize: 13, letterSpacing: '0.45em', color: 'var(--accent)', marginTop: 8, fontWeight: 700 }}>
                    INTELLIGENCE OPS // GLOBAL MONITORING
                  </span>
                </h1>
            </div>

            {/* Bottom HUD Command Row */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '10px 25px',
              background: 'var(--surface)',
              borderBottom: '4px double var(--border)'
            }}>
              {/* Left Comms Block */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <span className="hud-mini-label" style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '0.12em' }}>COMM LINK</span>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: loading ? 'var(--neon-amber)' : 'var(--neon-green)', fontSize: 13, fontWeight: 900 }}>{loading ? 'SYNCING' : 'ONLINE'}</span>
                      <div className={!loading ? "live-dot hud-glitch-active" : ""} style={{ width: 6, height: 6, background: loading ? 'var(--neon-amber)' : 'var(--neon-green)' }} />
                   </div>
                </div>
                <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <a href="https://x.com/FrameTheGlobe" target="_blank" className="icon-btn" title="X WIRE" style={{ transform: 'scale(0.9)', color: 'var(--text-primary)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.842L2.25 2.25h6.993l4.261 5.633L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg></a>
                  <a href="https://www.frametheglobenews.com/" target="_blank" className="icon-btn" title="SUBSTACK" style={{ transform: 'scale(0.9)', color: 'var(--text-primary)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/></svg></a>
                  <a href="https://www.threads.com/@echoesofstreet" target="_blank" className="icon-btn" title="THREADS" style={{ transform: 'scale(0.9)', color: 'var(--text-primary)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm6.842 12.345c-.02.16-.05.33-.1.49-.31 1.06-.9 1.94-1.73 2.68a4.912 4.912 0 01-3.12 1.205c-.16.01-.32 0-.48-.01-.92-.05-1.79-.3-2.6-.78-.18-.11-.3-.09-.45.05-.33.29-.7.54-1.1.75-.44.23-.9.41-1.39.52a4.404 4.404 0 01-2.4-.15c-.45-.13-.86-.34-1.23-.62-.71-.54-1.14-1.26-1.24-2.15-.06-.55 0-1.1.19-1.62.3-.84.83-1.52 1.54-2.07.35-.27.75-.49 1.17-.66.11-.04.16-.1.17-.21.1-.73.34-1.41.69-2.05.4-.71.93-1.3 1.6-1.77.63-.43 1.34-.65 2.11-.68.61-.02 1.22.04 1.81.21.94.26 1.71.74 2.31 1.48.57.7.9 1.5 1 2.39.04.3.06.61.05.91-.01.31-.02.62-.05.93-.03.44.07.75.46.96.48.24.87.59 1.14 1.07.18.32.28.67.28 1.03.02.48-.12.91-.35 1.32z"/>
                    </svg>
                  </a>
                </div>
              </div>

              {/* Right Temporal Block */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                   <span className="hud-mini-label" style={{ fontSize: 11, color: 'var(--text-primary)', fontWeight: 800, letterSpacing: '0.12em' }}>MISSION CHRONO</span>
                   <span style={{ fontSize: 18, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontWeight: 900 }}>
                      {hasMounted ? (missionTime || '--:--:--') : '--:--:--'}
                      <span style={{ fontSize: 11, color: 'var(--accent)', marginLeft: 4, fontWeight: 900 }}>UTC</span>
                   </span>
                 </div>
                 <div style={{ width: 1, height: 24, background: 'var(--border)' }} />
                 <div style={{ display: 'flex', gap: 10 }}>
                    <button className="icon-btn" onClick={() => setTheme(ts => ts === 'light' ? 'dark' : 'light')} title="SYSTEM MODE" style={{ transform: 'scale(1.1)' }}>
                      {(hasMounted && theme === 'light') ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                        </svg>
                      ) : (hasMounted && theme === 'dark') ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="5"></circle>
                          <line x1="12" y1="1" x2="12" y2="3"></line>
                          <line x1="12" y1="21" x2="12" y2="23"></line>
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                          <line x1="1" y1="12" x2="3" y2="12"></line>
                          <line x1="21" y1="12" x2="23" y2="12"></line>
                          <line x1="4.22" y1="18.36" x2="5.64" y2="19.78"></line>
                          <line x1="18.36" y1="4.22" x2="19.78" y2="5.64"></line>
                        </svg>
                      ) : (
                        <div style={{ width: 18, height: 18, opacity: 0.2 }} />
                      )}
                    </button>
                    <button 
                      onClick={() => fetchNews()} 
                      disabled={loading}
                      className="icon-btn"
                      style={{ background: 'var(--accent)', color: '#fff', fontSize: 9, fontFamily: 'var(--font-mono)', padding: '0 15px', width: 'auto', fontWeight: 900, height: 32, borderRadius: 0, border: 'none' }}
                    >
                      {loading ? 'REBOOT...' : 'SYSTEM REBOOT'}
                    </button>
                 </div>
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
              onAllSources={selectAllSources}
              onNoSources={selectNoSources}
              sourceCountMap={sourceCountMap}
              failedSources={failedSources}
              sourceHealth={sourceHealth}
              pinnedItems={pinnedItems}
              onTogglePin={togglePin}
              keyForItem={keyForItem}
            />

            {/* ── Keyword Watchlist ───────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                ⚑ Watchlist
              </div>
              <div style={{ display: 'flex', gap: 5 }}>
                <input
                  value={watchlistInput}
                  onChange={e => setWatchlistInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addWatchword(watchlistInput); }}
                  placeholder="Add keyword…"
                  style={{
                    flex: 1, fontFamily: 'var(--font-mono)', fontSize: 11,
                    background: 'var(--bg)', border: '1px solid var(--border)',
                    borderRadius: 3, padding: '5px 8px', color: 'var(--text-primary)',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => addWatchword(watchlistInput)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11, padding: '5px 10px',
                    background: 'var(--accent)', color: '#fff', border: 'none',
                    borderRadius: 3, cursor: 'pointer',
                  }}
                >+</button>
              </div>
              {watchlistKeywords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {watchlistKeywords.map(kw => (
                    <span key={kw} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontFamily: 'var(--font-mono)', fontSize: 10,
                      background: 'rgba(243,156,18,0.12)', border: '1px solid rgba(243,156,18,0.35)',
                      color: '#f39c12', padding: '2px 7px', borderRadius: 999,
                    }}>
                      {kw}
                      <button onClick={() => removeWatchword(kw)} style={{
                        border: 'none', background: 'transparent', cursor: 'pointer',
                        color: '#f39c12', fontSize: 12, lineHeight: 1, padding: 0,
                      }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              {watchlistKeywords.length === 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                  Track any term — &ldquo;ceasefire&rdquo;, &ldquo;Natanz&rdquo;, &ldquo;IAEA&rdquo;…
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main feed */}
        <main className="ftg-main">
          {/* ── Iran War Theater ─────────────────────────────────── */}
          <IranWarSection 
            items={items} 
            sourceCountMap={sourceCountMap} 
            brief={<IntelTimeline events={intelEvents} />}
          />

          {/* ── Widgets row (TopStorylines, RapidResponse, Macro, Oil) ── */}
          <div className="ftg-widgets-section">
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
          </div>

          <RegionStatsStrip items={visibleItems} />

          {/* ── DAILY BRIEFING ─────────────────────────────────────────────── */}
          {!loading && briefClusters.length > 0 && !briefingDismissed && briefingOpen && (
            <DailyBriefing
              clusters={briefClusters}
              onDismiss={dismissBriefing}
            />
          )}

          {/* ── WATCHLIST ALERT STRIP ──────────────────────────────────────── */}
          {watchlistMatches.length > 0 && watchlistKeywords.length > 0 && (
            <div style={{
              background: 'rgba(243,156,18,0.08)',
              border: '1px solid rgba(243,156,18,0.35)',
              borderLeft: '3px solid #f39c12',
              borderRadius: 3,
              padding: '10px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              animation: 'fadeUp 0.3s ease both',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#f39c12', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                  ⚑ Watchlist — {watchlistMatches.length} match{watchlistMatches.length !== 1 ? 'es' : ''}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                  {watchlistKeywords.map(k => `"${k}"`).join(' · ')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {watchlistMatches.slice(0, 5).map(item => {
                  const key = item.link || `${item.sourceId}::${item.title}`;
                  return (
                    <a key={key} href={item.link || undefined} target="_blank" rel="noopener noreferrer"
                      onClick={() => markRead(key)}
                      style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-primary)', textDecoration: 'none', lineHeight: 1.4 }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}>
                      <span style={{ color: item.sourceColor, fontFamily: 'var(--font-mono)', fontSize: 10, marginRight: 6 }}>{item.sourceName}</span>
                      {item.title}
                    </a>
                  );
                })}
                {watchlistMatches.length > 5 && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                    +{watchlistMatches.length - 5} more — activate the lens to see all
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── FILTER + VIEW CONTROLS ─────────────────────────────────────── */}
          <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>

            {/* Top row: lenses + view/sort controls */}
            <div className="ftg-filter-top-row">

              {/* Lens pills (multi-select) */}
              <div className="ftg-lens-pills" style={{ display: 'flex', flexWrap: 'wrap', gap: 5, flex: 1 }}>
                {/* "All" clear button */}
                <button
                  className="ftg-filter-pill"
                  onClick={() => { setActiveLenses(new Set()); setActiveRegions(new Set()); }}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
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
                  <span style={{ fontSize: 10, opacity: 0.75 }}>{lensCountMap['all'] ?? 0}</span>
                </button>

                {/* Individual topic lenses (skip index 0 = 'all') */}
                {LENSES.slice(1).map(l => {
                  const active = activeLenses.has(l.id);
                  const count  = lensCountMap[l.id] ?? 0;
                  return (
                    <button
                      key={l.id}
                      className="ftg-filter-pill"
                      title={l.hint}
                      onClick={() => setActiveLenses(prev => {
                        const next = new Set(prev);
                        if (next.has(l.id)) next.delete(l.id); else next.add(l.id);
                        return next;
                      })}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
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
                        <span style={{ fontSize: 10, opacity: 0.7 }}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Right cluster: sort + view mode */}
              <div className="ftg-controls-row" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {/* Sort control */}
                <div style={{ display: 'flex', gap: 3 }}>
                  {([
                    ['date-desc', '↓ Date'],
                    ['date-asc',  '↑ Date'],
                    ['source',    'Source'],
                  ] as [SortMode, string][]).map(([mode, label]) => (
                    <button
                      key={mode}
                      className="ftg-sort-btn"
                      onClick={() => setSortMode(mode)}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
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
                      fontSize: 12,
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
              <div className="ftg-region-strip" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginRight: 4 }}>
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
                        fontSize: 11,
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.03em', flexWrap: 'wrap' }}>
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

          {/* ── LOADING screen ─────────────────────────────────────────── */}
          {showLoadingScreen ? (
            <FeedLoadingScreen sourceCount={SOURCES.length} isDone={loadingDone} />

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
                const itemKey = item.link || `${item.sourceId}::${item.title}`;
                const isRead = readKeys.has(itemKey);
                const coverageCount = coverageMap.get(itemKey) ?? 1;
                const isDeveloping = developingSet.has(itemKey);
                const hasCrossConsensus = surprisingSet.has(itemKey);
                const compSiblings = comparisonMap.get(itemKey);
                const compExpanded = expandedComparisons.has(itemKey);
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
                      padding:      '16px 22px',
                      animation:    `fadeUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(i, 12) * 0.03}s both`,
                      opacity: isRead ? 0.6 : 1,
                      transition: 'opacity 0.2s',
                    }}
                    onMouseEnter={() => setFocusedIdx(i)}
                  >
                      <div style={{ display: 'flex', gap: 14 }}>
                        {item.imageUrl && !imageErrors.has(item.imageUrl) && (
                          <div className="ftg-article-thumbnail" style={{
                            width: 100, height: 75, flexShrink: 0,
                            borderRadius: 4, overflow: 'hidden',
                            background: 'var(--border-light)'
                          }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.imageUrl}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              width={100}
                              height={75}
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
                                fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em',
                                textTransform: 'uppercase', flexShrink: 0, marginTop: 2,
                                color: 'var(--badge-brk-color)', background: 'var(--badge-brk-bg)',
                                border: '1px solid var(--badge-brk-border)', padding: '2px 8px', borderRadius: 2,
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
                            {isDeveloping && (
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em',
                                textTransform: 'uppercase', flexShrink: 0, marginTop: 2,
                                color: '#27ae60', background: 'rgba(39,174,96,0.1)',
                                border: '1px solid rgba(39,174,96,0.35)', padding: '1px 5px', borderRadius: 2,
                              }}>
                                ↑ Developing
                              </span>
                            )}
                            {hasCrossConsensus && (
                              <span
                                title="Western and counter-narrative sources both covering this"
                                style={{
                                  fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em',
                                  textTransform: 'uppercase', flexShrink: 0, marginTop: 2,
                                  color: '#9b59b6', background: 'rgba(155,89,182,0.1)',
                                  border: '1px solid rgba(155,89,182,0.35)', padding: '1px 5px', borderRadius: 2,
                                }}>
                                ⚑ Cross-divide
                              </span>
                            )}
                            {coverageCount > 2 && (
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.06em',
                                flexShrink: 0, marginTop: 3,
                                color: 'var(--text-muted)',
                              }}>
                                ● {coverageCount} sources
                              </span>
                            )}
                            <a
                              href={item.link || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              data-article-idx={i}
                              className="ftg-article-title"
                              onClick={() => markRead(itemKey)}
                              style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 20,
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
                            <p className="ftg-article-summary" style={{
                              fontFamily: 'var(--font-body)',
                              fontSize: 14,
                              color: 'var(--text-secondary)',
                              lineHeight: 1.6,
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
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      letterSpacing: '0.03em',
                      flexWrap: 'wrap',
                    }}>
                      <button
                        onClick={() => togglePin(item)}
                        style={{
                          border: 'none', background: 'transparent',
                          cursor: 'pointer', fontSize: 13, padding: 0,
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
                      {compSiblings && compSiblings.length > 1 && (
                        <>
                          <span style={{ color: 'var(--border-light)' }}>/</span>
                          <button
                            onClick={() => toggleComparison(itemKey)}
                            style={{
                              border: 'none', background: 'transparent', cursor: 'pointer',
                              fontFamily: 'var(--font-mono)', fontSize: 11, padding: 0,
                              color: compExpanded ? 'var(--accent)' : 'var(--text-muted)',
                              transition: 'color 0.1s',
                            }}
                          >
                            {compExpanded ? '× close' : `⊞ ${compSiblings.length} views`}
                          </button>
                        </>
                      )}
                    </div>
                    {compExpanded && compSiblings && (
                      <CrossSourceComparison
                        items={compSiblings}
                        onClose={() => toggleComparison(itemKey)}
                      />
                    )}
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

                  {/* ── Story arc timeline ─────────────────────────────── */}
                  {(() => {
                    const sorted = [...cluster.items].sort(
                      (a, b) => new Date(a.pubDate).getTime() - new Date(b.pubDate).getTime()
                    );
                    if (sorted.length < 2) return null;
                    const oldestMs = new Date(sorted[0].pubDate).getTime();
                    const newestMs = new Date(sorted[sorted.length - 1].pubDate).getTime();
                    const span = newestMs - oldestMs || 1;
                    return (
                      <div style={{ position: 'relative', height: 30, marginBottom: 10 }}>
                        {/* Rail */}
                        <div style={{
                          position: 'absolute', left: 8, right: 8, top: 7,
                          height: 1, background: 'var(--border-light)',
                        }} />
                        {/* Dots — one per article ordered by time */}
                        {sorted.map((item, idx) => {
                          const frac = (new Date(item.pubDate).getTime() - oldestMs) / span;
                          const dotColor = REGION_DOTS[item.region] || '#999';
                          return (
                            <div
                              key={idx}
                              title={`${item.sourceName}: ${item.title}`}
                              style={{
                                position: 'absolute',
                                top: 3,
                                left: `calc(8px + ${frac.toFixed(4)} * (100% - 16px))`,
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: dotColor,
                                border: '1px solid var(--surface)',
                                transform: 'translateX(-50%)',
                                cursor: 'default',
                                zIndex: 1,
                              }}
                            />
                          );
                        })}
                        {/* Oldest / newest labels */}
                        <span style={{
                          position: 'absolute', left: 8, top: 17,
                          fontFamily: 'var(--font-mono)', fontSize: 9,
                          color: 'var(--text-muted)', whiteSpace: 'nowrap',
                        }}>
                          {timeAgo(sorted[0].pubDate)}
                        </span>
                        <span style={{
                          position: 'absolute', right: 8, top: 17,
                          fontFamily: 'var(--font-mono)', fontSize: 9,
                          color: 'var(--text-muted)', whiteSpace: 'nowrap',
                        }}>
                          {timeAgo(sorted[sorted.length - 1].pubDate)}
                        </span>
                      </div>
                    );
                  })()}

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

        {/* ── THIRD COLUMN: STRATEGIC INTEL ─────────────────────────── */}
        <aside className="intel-column" style={{
          position: 'sticky',
          top: '24px',
          height: 'calc(100vh - 48px)',
          overflowY: 'auto',
          paddingRight: '4px',
          scrollbarWidth: 'thin'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            padding: '16px 20px',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
              paddingBottom: 8,
              borderBottom: '1px solid var(--border-light)'
            }}>
              <h2 style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'var(--accent)',
                margin: 0
              }}>
                Strategic Brief
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div className="live-dot" />
                <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Live</span>
              </div>
            </div>

            <IntelTimeline events={intelEvents} />

            {intelEvents.length > 0 && (
              <div style={{
                marginTop: 20,
                padding: '10px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: 4,
                border: '1px dashed var(--border)',
                textAlign: 'center'
              }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  SCANNING GDELT & GCAPTAIN SENSORS
                </span>
              </div>
            )}
          </div>
        </aside>
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
