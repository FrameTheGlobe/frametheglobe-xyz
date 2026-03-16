'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { SOURCES } from '@/lib/sources';
import IranOilBoard from './IranOilBoard';

// Dynamic import prevents SSR — IranWarCostBoard uses new Date() in state
// which would cause a server/client hydration mismatch.
// The `loading` prop renders a compact skeleton while the JS chunk downloads
// so there's no invisible blank area on first paint.
const IranWarCostBoard = dynamic(() => import('./IranWarCostBoard'), {
  ssr: false,
  loading: () => (
    <div style={{
      background:   'var(--surface)',
      border:       '1px solid var(--border-light)',
      borderTop:    '2px solid #c93a20',
      borderRadius: '0 0 3px 3px',
      marginBottom: 12,
      padding:      '14px 16px',
      display:      'flex',
      flexDirection:'column',
      gap:          10,
    }}>
      <div className="skeleton" style={{ height: 10, width: '55%', borderRadius: 2 }} />
      <div className="skeleton" style={{ height: 38, width: '80%', borderRadius: 2 }} />
      <div className="skeleton" style={{ height: 10, width: '40%', borderRadius: 2 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 28, borderRadius: 3 }} />
          </div>
        ))}
      </div>
    </div>
  ),
});

// ── Types ──────────────────────────────────────────────────────────────────────
type FeedItem = {
  title:      string;
  link:       string;
  pubDate:    string;
  summary:    string;
  sourceId:   string;
  sourceName: string;
  region:     string;
  sourceColor:string;
};

type IranLens = 'all' | 'nuclear' | 'proxy' | 'domestic' | 'naval';

// ── Iran keyword filter ────────────────────────────────────────────────────────
// An article is "Iran content" if it comes from the iranian region,
// OR if its text contains one of these terms.
const IRAN_CONTENT_KEYWORDS = [
  'iran', 'iranian', 'tehran', 'irgc', 'revolutionary guard',
  'khamenei', 'pezeshkian', 'raisi', 'natanz', 'fordow',
  'persian gulf', 'strait of hormuz', 'axis of resistance',
  'iran nuclear', 'iran sanction', 'iran attack', 'iran strike',
  'iran missile', 'iran drone', 'iran oil', 'iran deal',
  'qods force', 'quds force', 'basij',
];

// ── Iran sub-lens definitions ──────────────────────────────────────────────────
const IRAN_LENSES: {
  id: IranLens; label: string; icon: string; keywords: string[]; color: string;
}[] = [
  {
    id:       'all',
    label:    'All Iran',
    icon:     '●',
    keywords: [],
    color:    '#c93a20',
  },
  {
    id:       'nuclear',
    label:    'Nuclear',
    icon:     '⚛',
    keywords: ['nuclear','uranium','centrifuge','natanz','fordow','iaea',
               'enrichment','jcpoa','snapback','breakout','plutonium','arak'],
    color:    '#e67e22',
  },
  {
    id:       'proxy',
    label:    'Proxy Net',
    icon:     '⬡',
    keywords: ['houthi','houthis','ansarallah','hezbollah','pmu','hashd',
               'kataib','axis of resistance','proxy','irgc qods','qods force',
               'quds force','iraq militia'],
    color:    '#8e44ad',
  },
  {
    id:       'domestic',
    label:    'Domestic',
    icon:     '◈',
    keywords: ['khamenei','pezeshkian','parliament','election','protest',
               'rial','sanction','crackdown','dissent','inflation','raisi',
               'mahsa','women','internet','shutdown'],
    color:    '#2980b9',
  },
  {
    id:       'naval',
    label:    'Naval · Hormuz',
    icon:     '⚓',
    keywords: ['hormuz','strait of hormuz','tanker','persian gulf','naval',
               'frigate','seized','maritime','irgc navy','drone ship',
               'mine','chokepoint'],
    color:    '#16a085',
  },
];

// ── Situation fronts ───────────────────────────────────────────────────────────
const IRAN_FRONTS: {
  id: string; label: string; icon: string; keywords: string[];
}[] = [
  {
    id:       'nuclear',
    label:    'Nuclear Track',
    icon:     '⚛',
    keywords: ['nuclear','uranium','natanz','fordow','iaea','enrichment',
               'jcpoa','centrifuge','breakout','snapback','plutonium'],
  },
  {
    id:       'hormuz',
    label:    'Strait · Hormuz',
    icon:     '⚓',
    keywords: ['hormuz','strait','tanker','seizure','maritime',
               'persian gulf','naval','seized','chokepoint'],
  },
  {
    id:       'proxy',
    label:    'Proxy Network',
    icon:     '⬡',
    keywords: ['houthi','ansarallah','hezbollah','pmu','hashd',
               'kataib','axis of resistance','proxy','militia'],
  },
  {
    id:       'domestic',
    label:    'Iran Domestic',
    icon:     '◈',
    keywords: ['khamenei','pezeshkian','parliament','protest',
               'dissent','crackdown','rial','sanction','inflation'],
  },
];

// ── Source groups for the source grid ─────────────────────────────────────────
const IRAN_SOURCE_GROUPS: { label: string; ids: string[] }[] = [
  {
    label: 'Iranian Press',
    ids:   ['mehr','tasnim','iranintl','iranwire','radiofarda','financialtribune'],
  },
  {
    label: 'Intelligence',
    ids:   ['gdelt-iran-conflict','gdelt-iran-nuclear','gdelt-hormuz',
            'reliefweb-iran','almonitor','resp-statecraft'],
  },
  {
    label: 'Regional Eye',
    ids:   ['middleeasteye','aljazeera','aawsat','rudaw','thecradle',
            'warontherocks','mei'],
  },
  {
    label: 'Western Wire',
    ids:   ['reuters','guardian','foreignpolicy','breakingdefense',
            'atlanticcouncil','crisisgroup'],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(pubDate: string): string {
  const ms = Date.now() - new Date(pubDate).getTime();
  const m  = Math.floor(ms / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function isIranContent(item: FeedItem): boolean {
  if (item.region === 'iranian') return true;
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return IRAN_CONTENT_KEYWORDS.some(kw => text.includes(kw));
}

function matchesKeywords(item: FeedItem, keywords: string[]): boolean {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  return keywords.some(kw => text.includes(kw));
}

type StatusInfo = { label: string; color: string; bg: string };

function deriveFrontStatus(iranItems: FeedItem[], keywords: string[]): StatusInfo {
  const now    = Date.now();
  const recent = iranItems.filter(i => {
    const age = now - new Date(i.pubDate).getTime();
    return age < 12 * 3600_000 && matchesKeywords(i, keywords);
  });
  const hot = recent.filter(i =>
    (now - new Date(i.pubDate).getTime()) < 2 * 3600_000
  );

  if (hot.length >= 3)  return { label: 'Escalating', color: '#e74c3c', bg: 'rgba(231,76,60,0.08)'  };
  if (hot.length >= 1)  return { label: 'Active',     color: '#e67e22', bg: 'rgba(230,126,34,0.08)' };
  if (recent.length > 0)return { label: 'Monitoring', color: '#3498db', bg: 'rgba(52,152,219,0.08)' };
  return                         { label: 'Quiet',     color: '#7f8c8d', bg: 'rgba(127,140,141,0.06)'};
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props {
  items:          FeedItem[];
  sourceCountMap: Record<string, number>;
}

export default function IranWarSection({ items, sourceCountMap }: Props) {
  const [collapsed,  setCollapsed]  = useState(false);
  const [iranLens,   setIranLens]   = useState<IranLens>('all');
  const [showAll,    setShowAll]    = useState(false);

  // All Iran-relevant articles from the full feed
  const iranItems = useMemo(
    () => items.filter(isIranContent),
    [items]
  );

  // Sub-lens filtered
  const lensedItems = useMemo(() => {
    if (iranLens === 'all') return iranItems;
    const def = IRAN_LENSES.find(l => l.id === iranLens);
    if (!def) return iranItems;
    return iranItems.filter(i => matchesKeywords(i, def.keywords));
  }, [iranItems, iranLens]);

  // Count per lens (for badges)
  const lensCounts = useMemo(() => {
    const map = {} as Record<IranLens, number>;
    IRAN_LENSES.forEach(l => {
      map[l.id] = l.id === 'all'
        ? iranItems.length
        : iranItems.filter(i => matchesKeywords(i, l.keywords)).length;
    });
    return map;
  }, [iranItems]);

  const displayed = showAll ? lensedItems : lensedItems.slice(0, 18);

  // Date.now() inside useMemo is intentional: refreshes once per displayed-list change.
  // eslint-disable-next-line react-hooks/purity, react-hooks/exhaustive-deps
  const nowMs = useMemo(() => Date.now(), [displayed]);

  const iranSourceCount = SOURCES.filter(s => s.region === 'iranian').length;

  if (items.length === 0) return null;

  return (
    <section
      aria-label="Iran War Theater"
      style={{
        marginBottom: 14,
        border:       '1px solid var(--border-light)',
        borderTop:    '3px solid #c93a20',
        background:   'var(--surface)',
        borderRadius: '0 0 4px 4px',
      }}
    >
      {/* ── Section header ──────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(v => !v)}
        onKeyDown={e => e.key === 'Enter' && setCollapsed(v => !v)}
        style={{
          display:       'flex',
          alignItems:    'center',
          justifyContent:'space-between',
          padding:       '9px 16px',
          borderBottom:  collapsed ? 'none' : '1px solid var(--border-light)',
          cursor:        'pointer',
          userSelect:    'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Red pulse dot */}
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#c93a20', flexShrink: 0,
            boxShadow: '0 0 0 2px rgba(201,58,32,0.18)',
          }} />

          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      11,
            fontWeight:    700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color:         '#c93a20',
          }}>
            Iran War Theater
          </span>

          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      9,
            color:         'var(--text-muted)',
            border:        '1px solid var(--border-light)',
            padding:       '1px 7px',
            borderRadius:  2,
            letterSpacing: '0.05em',
          }}>
            {iranItems.length} stories · {iranSourceCount} direct sources
          </span>
        </div>

        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      9,
          color:         'var(--text-muted)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {collapsed ? '▶ Expand' : '▼ Collapse'}
        </span>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div className="ftg-section-body" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── War Cost Counter ─────────────────────────────────────────── */}
          <IranWarCostBoard />

          {/* ── Crude Oil Price Board ────────────────────────────────────── */}
          <IranOilBoard />

          {/* ── Situation Status ────────────────────────────────────────── */}
          <div>
            <div style={sectionLabel}>Situation Status</div>
            <div style={{
              display:             'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap:                 8,
            }}>
              {IRAN_FRONTS.map(front => {
                const status     = deriveFrontStatus(iranItems, front.keywords);
                const frontItems = iranItems
                  .filter(i => matchesKeywords(i, front.keywords))
                  .slice(0, 2);

                return (
                  <div
                    key={front.id}
                    style={{
                      background:  status.bg,
                      border:      `1px solid ${status.color}33`,
                      borderTop:   `2px solid ${status.color}`,
                      borderRadius: 4,
                      padding:     '10px 12px',
                    }}
                  >
                    {/* Front title + status badge */}
                    <div style={{
                      display:        'flex',
                      justifyContent: 'space-between',
                      alignItems:     'center',
                      marginBottom:   7,
                    }}>
                      <span style={{
                        fontFamily:    'var(--font-mono)',
                        fontSize:      10,
                        fontWeight:    600,
                        color:         'var(--text-secondary)',
                        letterSpacing: '0.04em',
                      }}>
                        {front.icon} {front.label}
                      </span>
                      <span style={{
                        fontFamily:    'var(--font-mono)',
                        fontSize:      8,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color:         status.color,
                        background:    `${status.color}18`,
                        border:        `1px solid ${status.color}44`,
                        padding:       '1px 6px',
                        borderRadius:  2,
                        flexShrink:    0,
                      }}>
                        {status.label}
                      </span>
                    </div>

                    {/* 2 latest headlines for this front */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {frontItems.length > 0 ? frontItems.map(item => (
                        <div
                          key={(item.link && item.link.startsWith('http') ? item.link : null) ?? `${item.sourceId}::${item.title}::${item.pubDate}`}
                          style={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                        >
                          <a
                            href={item.link || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily:    'var(--font-body)',
                              fontSize:      11,
                              color:         'var(--text-primary)',
                              textDecoration:'none',
                              lineHeight:    1.4,
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                          >
                            {trunc(item.title, 80)}
                          </a>
                          <span style={{
                            fontFamily:    'var(--font-mono)',
                            fontSize:      9,
                            color:         item.sourceColor || 'var(--text-muted)',
                            letterSpacing: '0.03em',
                          }}>
                            {item.sourceName} · {timeAgo(item.pubDate)}
                          </span>
                        </div>
                      )) : (
                        <span style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize:   10,
                          color:      'var(--text-muted)',
                          fontStyle:  'italic',
                        }}>
                          No recent reports
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Source Grid ─────────────────────────────────────────────── */}
          <div>
            <div style={sectionLabel}>Sources</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, overflow: 'hidden', minWidth: 0 }}>
              {IRAN_SOURCE_GROUPS.map(group => {
                const groupSources = group.ids
                  .map(id => SOURCES.find(s => s.id === id))
                  .filter(Boolean) as typeof SOURCES;

                return (
                  <div key={group.label} style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minWidth: 0, overflow: 'hidden' }}>
                    <span style={{
                      fontFamily:    'var(--font-mono)',
                      fontSize:      9,
                      color:         'var(--text-muted)',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      flexShrink:    0,
                      minWidth:      90,
                    }}>
                      {group.label}
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, minWidth: 0, flexShrink: 1 }}>
                      {groupSources.map(src => {
                        const count = sourceCountMap[src.id] || 0;
                        return (
                          <span
                            key={src.id}
                            title={`${src.name}${count > 0 ? ` — ${count} articles` : ''}`}
                            style={{
                              fontFamily:   'var(--font-mono)',
                              fontSize:     10,
                              padding:      '2px 9px',
                              borderRadius: 999,
                              border:       `1px solid ${src.color}55`,
                              background:   `${src.color}12`,
                              color:        src.color,
                              display:      'inline-flex',
                              alignItems:   'center',
                              gap:          5,
                              whiteSpace:   'nowrap',
                            }}
                          >
                            {src.name}
                            {count > 0 && (
                              <span style={{ opacity: 0.65, fontSize: 9 }}>{count}</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Sub-Lens Filter ──────────────────────────────────────────── */}
          <div>
            <div style={sectionLabel}>Filter by Theater</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {IRAN_LENSES.map(l => {
                const active = iranLens === l.id;
                const count  = lensCounts[l.id] ?? 0;
                return (
                  <button
                    key={l.id}
                    onClick={() => { setIranLens(l.id); setShowAll(false); }}
                    title={`Show ${l.label} coverage`}
                    style={{
                      fontFamily:    'var(--font-mono)',
                      fontSize:      11,
                      padding:       '4px 13px',
                      borderRadius:  999,
                      border:        `1px solid ${active ? l.color : 'var(--border-light)'}`,
                      background:    active ? `${l.color}18` : 'transparent',
                      color:         active ? l.color : 'var(--text-muted)',
                      cursor:        'pointer',
                      display:       'inline-flex',
                      alignItems:    'center',
                      gap:           6,
                      fontWeight:    active ? 600 : 400,
                      transition:    'all 0.12s',
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{l.icon}</span>
                    {l.label}
                    <span style={{ fontSize: 9, opacity: 0.7 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Article Feed ────────────────────────────────────────────── */}
          <div>
            <div style={{ ...sectionLabel, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                {iranLens === 'all'
                  ? `Latest Iran Coverage — ${lensedItems.length} stories`
                  : `${IRAN_LENSES.find(l => l.id === iranLens)?.label} Coverage — ${lensedItems.length} stories`
                }
              </span>
              {!showAll && lensedItems.length > 18 && (
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 400 }}>
                  showing 18 of {lensedItems.length}
                </span>
              )}
            </div>

            {lensedItems.length === 0 ? (
              <div style={{
                fontFamily:  'var(--font-mono)',
                fontSize:    11,
                color:       'var(--text-muted)',
                padding:     '20px 0',
                textAlign:   'center',
                letterSpacing:'0.04em',
              }}>
                No Iran stories found in current feed. Refresh to update.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {displayed.map(item => {
                  const ageMs     = nowMs - new Date(item.pubDate).getTime();
                  const isBreaking = ageMs < 30 * 60_000;
                  const isNew      = ageMs < 2 * 3600_000;

                  return (
                    <article
                      key={(item.link && item.link !== '#' && item.link.startsWith('http') ? item.link : null) ?? `${item.sourceId}::${item.title}::${item.pubDate}`}
                      style={{
                        borderTop:    '1px solid var(--border-light)',
                        borderRight:  '1px solid var(--border-light)',
                        borderBottom: '1px solid var(--border-light)',
                        borderLeft:   `3px solid ${item.sourceColor || '#c93a20'}`,
                        padding:      '10px 14px',
                        background:   'var(--surface)',
                        borderRadius: '0 3px 3px 0',
                        transition:   'background 0.1s',
                      }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'var(--surface)')}
                    >
                      {/* Title row */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7, marginBottom: 4 }}>
                        {isBreaking && (
                          <span style={{
                            fontFamily:    'var(--font-mono)', fontSize: 7, letterSpacing: '0.1em',
                            textTransform: 'uppercase', flexShrink: 0, marginTop: 3,
                            color: 'var(--badge-brk-color)', background: 'var(--badge-brk-bg)',
                            border: '1px solid var(--badge-brk-border)', padding: '1px 5px', borderRadius: 2,
                          }}>
                            Breaking
                          </span>
                        )}
                        {!isBreaking && isNew && (
                          <span style={{
                            fontFamily:    'var(--font-mono)', fontSize: 7, letterSpacing: '0.1em',
                            textTransform: 'uppercase', flexShrink: 0, marginTop: 3,
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
                          style={{
                            fontFamily:    'var(--font-display)',
                            fontSize:      14,
                            fontWeight:    600,
                            color:         'var(--text-primary)',
                            textDecoration:'none',
                            lineHeight:    1.35,
                            flex:          1,
                            transition:    'color 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                        >
                          {item.title}
                        </a>
                      </div>

                      {/* Summary — hidden on mobile via .ftg-article-summary */}
                      {item.summary && (
                        <p className="ftg-article-summary" style={{
                          fontFamily: 'var(--font-body)',
                          fontSize:   12,
                          color:      'var(--text-secondary)',
                          lineHeight: 1.5,
                          marginBottom: 6,
                        }}>
                          {trunc(item.summary, 200)}
                        </p>
                      )}

                      {/* Meta row */}
                      <div style={{
                        display:    'flex',
                        alignItems: 'center',
                        gap:        7,
                        fontFamily: 'var(--font-mono)',
                        fontSize:   10,
                        color:      'var(--text-muted)',
                        letterSpacing: '0.03em',
                        flexWrap:   'wrap',
                      }}>
                        <span style={{ color: item.sourceColor || '#c93a20', fontWeight: 600 }}>
                          {item.sourceName}
                        </span>
                        <span style={{ color: 'var(--border-light)' }}>/</span>
                        <span style={{ textTransform: 'capitalize' }}>
                          {item.region === 'iranian'    ? 'Iranian Press'
                          : item.region === 'levant'    ? 'Levant'
                          : item.region === 'gulf'      ? 'Gulf / MENA'
                          : item.region === 'analysis'  ? 'Analysis'
                          : item.region === 'osint'     ? 'OSINT'
                          : item.region === 'western'   ? 'Western'
                          : item.region === 'global'    ? 'Global'
                          : item.region}
                        </span>
                        <span style={{ color: 'var(--border-light)' }}>/</span>
                        <span>{timeAgo(item.pubDate)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Show more / show less */}
            {lensedItems.length > 18 && (
              <button
                onClick={() => setShowAll(v => !v)}
                style={{
                  marginTop:     8,
                  width:         '100%',
                  fontFamily:    'var(--font-mono)',
                  fontSize:      10,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color:         '#c93a20',
                  background:    'none',
                  border:        '1px solid rgba(201,58,32,0.3)',
                  borderRadius:  3,
                  padding:       '7px 0',
                  cursor:        'pointer',
                  transition:    'border-color 0.12s, background 0.12s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#c93a20';
                  (e.currentTarget as HTMLButtonElement).style.background  = 'rgba(201,58,32,0.05)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(201,58,32,0.3)';
                  (e.currentTarget as HTMLButtonElement).style.background  = 'none';
                }}
              >
                {showAll
                  ? '▲ Show fewer stories'
                  : `▼ Show all ${lensedItems.length} Iran stories`}
              </button>
            )}
          </div>

        </div>
      )}
    </section>
  );
}

// ── Shared label style ────────────────────────────────────────────────────────
const sectionLabel: React.CSSProperties = {
  fontFamily:    'var(--font-mono)',
  fontSize:      9,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color:         'var(--text-muted)',
  marginBottom:  8,
};
