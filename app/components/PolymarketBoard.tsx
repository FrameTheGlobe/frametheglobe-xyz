'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PolymarketEntry, PolyOutcome } from '@/app/api/polymarket/route';
import { useVisibilityPolling } from '@/lib/use-visibility-polling';

// ── Keyframes injected once ────────────────────────────────────────────────
const KEYFRAMES = `
@keyframes pm-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
@keyframes pm-dot {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.7); }
  40%            { opacity: 1;   transform: scale(1);   }
}
`;

const CAT_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  NUCLEAR:   { color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  icon: '☢',  label: 'NUCLEAR'   },
  CONFLICT:  { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  icon: '⚔',  label: 'CONFLICT'  },
  REGIME:    { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: '🏛',  label: 'REGIME'    },
  DIPLOMACY: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', icon: '🤝', label: 'DIPLOMACY' },
};

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function pctColor(pct: number): string {
  if (pct >= 65) return '#ef4444';
  if (pct >= 40) return '#f97316';
  if (pct >= 18) return '#eab308';
  return '#22c55e';
}

// ── Outcome row inside a card ─────────────────────────────────────────────
function OutcomeRow({ o }: { o: PolyOutcome }) {
  const pct = Math.round(o.yesPrice * 100);
  const col = pctColor(pct);
  return (
    <a
      href={o.slug ? `https://polymarket.com/event/${o.slug}` : 'https://polymarket.com'}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none', display: 'block' }}
    >
      <div style={{
        display:    'flex',
        alignItems: 'center',
        gap:        8,
        padding:    '6px 0',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <span style={{
          flex:       1,
          fontSize:   11,
          color:      'var(--text-secondary)',
          fontFamily: 'var(--font-mono)',
          overflow:   'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {o.label}
        </span>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      13,
          fontWeight:    800,
          color:         col,
          flexShrink:    0,
          minWidth:      34,
          textAlign:     'right',
          letterSpacing: '-0.01em',
        }}>
          {pct}%
        </span>
        <div style={{
          width:        48,
          height:       5,
          background:   'var(--border-light)',
          borderRadius: 3,
          overflow:     'hidden',
          flexShrink:   0,
        }}>
          <div style={{
            width:        `${pct}%`,
            height:       '100%',
            background:   col,
            borderRadius: 3,
            transition:   'width 0.5s ease',
          }} />
        </div>
      </div>
    </a>
  );
}

// ── Individual event card ─────────────────────────────────────────────────
function EventCard({ ev }: { ev: PolymarketEntry }) {
  const meta   = CAT_META[ev.category] ?? CAT_META.CONFLICT;
  const [hover, setHover] = useState(false);
  const isBig  = ev.isBinary || ev.outcomes.length === 1;
  const pct    = isBig ? Math.round((ev.outcomes[0]?.yesPrice ?? 0) * 100) : null;
  const col    = pct !== null ? pctColor(pct) : meta.color;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background:   hover ? meta.bg : 'var(--surface)',
        border:       `1px solid ${hover ? meta.color + '45' : 'var(--border-light)'}`,
        borderTop:    `3px solid ${meta.color}`,
        borderRadius: 6,
        overflow:     'hidden',
        transition:   'all 0.15s ease',
        boxShadow:    hover ? `0 4px 16px ${meta.color}18` : '0 1px 3px rgba(0,0,0,0.04)',
        display:      'flex',
        flexDirection:'column',
      }}
    >
      {/* Card top: category + title */}
      <a
        href={ev.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', display: 'block', padding: '12px 14px 0' }}
      >
        {/* Category chip */}
        <div style={{
          display:      'inline-flex',
          alignItems:   'center',
          gap:          4,
          marginBottom: 8,
          padding:      '2px 7px',
          background:   meta.bg,
          border:       `1px solid ${meta.color}30`,
          borderRadius: 10,
        }}>
          <span style={{ fontSize: 10 }}>{meta.icon}</span>
          <span style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      8,
            fontWeight:    800,
            color:         meta.color,
            letterSpacing: '0.1em',
          }}>
            {meta.label}
          </span>
        </div>

        {/* Title + big % for binary */}
        <div style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'space-between',
          gap:            10,
          marginBottom:   isBig ? 10 : 8,
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontSize:   13,
            fontWeight: 600,
            color:      'var(--text-primary)',
            lineHeight: 1.4,
            flex:       1,
          }}>
            {ev.eventTitle}
          </span>

          {isBig && pct !== null && (
            <div style={{ flexShrink: 0, textAlign: 'right', lineHeight: 1 }}>
              <div style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      30,
                fontWeight:    900,
                color:         col,
                letterSpacing: '-0.03em',
                textShadow:    pct > 50 ? `0 0 14px ${col}55` : 'none',
              }}>
                {pct}%
              </div>
              <div style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      8,
                color:         'var(--text-muted)',
                letterSpacing: '0.08em',
                textAlign:     'center',
                marginTop:     3,
              }}>
                YES PROB
              </div>
            </div>
          )}
        </div>

        {/* Binary prob bar */}
        {isBig && pct !== null && (
          <div style={{
            height:       5,
            background:   'var(--border-light)',
            borderRadius: 3,
            overflow:     'hidden',
            marginBottom: 0,
          }}>
            <div style={{
              width:        `${pct}%`,
              height:       '100%',
              background:   `linear-gradient(90deg, ${col}70, ${col})`,
              borderRadius: 3,
              transition:   'width 0.6s cubic-bezier(0.16,1,0.3,1)',
              boxShadow:    pct > 20 ? `0 0 6px ${col}50` : 'none',
            }} />
          </div>
        )}
      </a>

      {/* Multi-outcome rows */}
      {!isBig && ev.outcomes.length > 0 && (
        <div style={{ padding: '0 14px' }}>
          {ev.outcomes.slice(0, 3).map((o, i) => (
            <OutcomeRow key={i} o={o} />
          ))}
        </div>
      )}

      {/* Card footer */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '8px 14px 10px',
        marginTop:      'auto',
      }}>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      9,
          color:         'var(--text-muted)',
          opacity:       0.7,
          letterSpacing: '0.04em',
        }}>
          {fmtVol(ev.volume)} vol · USDC
        </span>
        <a
          href={ev.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      9,
            color:         meta.color,
            textDecoration:'none',
            opacity:       hover ? 1 : 0.5,
            transition:    'opacity 0.15s',
            fontWeight:    600,
            letterSpacing: '0.04em',
          }}
        >
          Polymarket ↗
        </a>
      </div>
    </div>
  );
}

// ── Skeleton grid while loading ───────────────────────────────────────────
function SkeletonGrid() {
  return (
    <>
      {/* Sweep bar */}
      <div style={{
        position:     'relative',
        height:       3,
        background:   'rgba(168,85,247,0.12)',
        borderRadius: 2,
        overflow:     'hidden',
        marginBottom: 14,
      }}>
        <div style={{
          position:   'absolute',
          inset:      0,
          width:      '25%',
          background: 'linear-gradient(90deg, transparent, #a855f7, #c084fc, transparent)',
          animation:  'pm-sweep 1.4s ease-in-out infinite',
        }} />
      </div>

      {/* Status label */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           7,
        marginBottom:  16,
      }}>
        <span style={{ fontSize: 10, color: '#a855f7', opacity: 0.75, letterSpacing: '0.08em', fontFamily: 'var(--font-mono)' }}>
          SCANNING PREDICTION MARKETS
        </span>
        {[0, 0.2, 0.4].map((d, i) => (
          <span key={i} style={{
            display: 'inline-block', width: 4, height: 4, borderRadius: '50%',
            background: '#a855f7',
            animation: `pm-dot 1.2s ease-in-out ${d}s infinite`,
          }} />
        ))}
      </div>

      {/* Skeleton cards */}
      <div style={{
        display:               'grid',
        gridTemplateColumns:   'repeat(auto-fill, minmax(260px, 1fr))',
        gap:                   12,
      }}>
        {[70, 55, 85, 65, 75, 50].map((w, i) => (
          <div key={i} style={{
            border:       '1px solid var(--border-light)',
            borderTop:    '3px solid rgba(168,85,247,0.3)',
            borderRadius: 6,
            padding:      '12px 14px',
            background:   'var(--surface)',
            position:     'relative',
            overflow:     'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.04), transparent)', animation: `pm-sweep 1.8s ease-in-out ${i * 0.1}s infinite` }} />
            <div className="skeleton" style={{ height: 16, width: 60, borderRadius: 8, marginBottom: 10 }} />
            <div className="skeleton" style={{ height: 12, width: `${w}%`, borderRadius: 2, marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 10, width: `${w - 15}%`, borderRadius: 2, marginBottom: 14 }} />
            <div className="skeleton" style={{ height: 5, width: '100%', borderRadius: 3, marginBottom: 8 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="skeleton" style={{ height: 9, width: 60, borderRadius: 2 }} />
              <div className="skeleton" style={{ height: 9, width: 70, borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────
export default function PolymarketBoard() {
  const [data,      setData]      = useState<PolymarketEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error,     setError]     = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res  = await fetch('/api/polymarket', { cache: 'no-store' });
      if (!res.ok) { setError(true); return; }
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        setData(json);
        setUpdatedAt(new Date());
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useVisibilityPolling(load, 5 * 60 * 1000);

  const ORDER: PolymarketEntry['category'][] = ['CONFLICT', 'REGIME', 'DIPLOMACY', 'NUCLEAR'];
  const byCategory = data.reduce<Record<string, PolymarketEntry[]>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});
  const presentCats = ORDER.filter(c => byCategory[c]?.length);

  return (
    <section style={{
      background:   'var(--bg)',
      border:       '1px solid var(--border-light)',
      borderTop:    '2px solid #9b59b6',
      borderRadius: '0 0 6px 6px',
      fontFamily:   'var(--font-mono)',
      overflow:     'hidden',
    }}>
      <style>{KEYFRAMES}</style>

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="widget-hd" style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 16px',
        borderBottom:   collapsed ? 'none' : undefined,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#9b59b6',
            boxShadow:  '0 0 8px #9b59b6',
            flexShrink: 0,
          }} />
          <span className="widget-hd-title" style={{
            fontFamily:    'var(--font-mono)',
            color:         '#9b59b6',
            textTransform: 'uppercase',
          }}>
            Prediction Markets
          </span>
          <span style={{
            fontSize:      8,
            color:         '#9b59b6',
            border:        '1px solid rgba(155,89,182,0.4)',
            borderRadius:  3,
            padding:       '1px 6px',
            background:    'rgba(155,89,182,0.08)',
            letterSpacing: '0.06em',
          }}>
            POLYMARKET
          </span>
          {!loading && !error && data.length > 0 && (
            <span style={{
              fontSize:      9,
              color:         '#9b59b6',
              background:    'rgba(155,89,182,0.1)',
              border:        '1px solid rgba(155,89,182,0.2)',
              borderRadius:  10,
              padding:       '1px 7px',
              fontWeight:    700,
            }}>
              {data.length} markets live
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {updatedAt && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.6, letterSpacing: '0.05em' }}>
              {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              fontFamily:    'var(--font-mono)',
              fontSize:      11,
              padding:       '3px 8px',
              background:    'var(--bg)',
              color:         'var(--text-muted)',
              border:        '1px solid var(--border-light)',
              borderRadius:  3,
              cursor:        'pointer',
            }}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding: '14px 16px 16px' }}>

          {loading && <SkeletonGrid />}

          {!loading && error && (
            <div style={{ padding: '24px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.07em', opacity: 0.7 }}>
                NO LIVE IRAN MARKETS FOUND
              </div>
              <button
                onClick={load}
                style={{
                  fontSize:      10,
                  color:         '#9b59b6',
                  border:        '1px solid rgba(155,89,182,0.4)',
                  borderRadius:  3,
                  padding:       '5px 14px',
                  background:    'rgba(155,89,182,0.06)',
                  cursor:        'pointer',
                  letterSpacing: '0.07em',
                  fontFamily:    'var(--font-mono)',
                }}
              >
                ↺ Retry
              </button>
            </div>
          )}

          {!loading && !error && presentCats.map(cat => {
            const meta = CAT_META[cat];
            const items = byCategory[cat];
            return (
              <div key={cat} style={{ marginBottom: 20 }}>
                {/* Category divider */}
                <div style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           8,
                  marginBottom:  10,
                  paddingBottom: 7,
                  borderBottom:  `2px solid ${meta.color}18`,
                }}>
                  <span style={{ fontSize: 13 }}>{meta.icon}</span>
                  <span style={{
                    fontFamily:    'var(--font-mono)',
                    fontSize:      9,
                    fontWeight:    900,
                    color:         meta.color,
                    letterSpacing: '0.14em',
                  }}>
                    {meta.label}
                  </span>
                  <div style={{ flex: 1, height: 1, background: `${meta.color}18` }} />
                  <span style={{
                    fontFamily:    'var(--font-mono)',
                    fontSize:      8,
                    color:         meta.color,
                    background:    meta.bg,
                    border:        `1px solid ${meta.color}25`,
                    borderRadius:  10,
                    padding:       '1px 7px',
                    fontWeight:    700,
                  }}>
                    {items.length}
                  </span>
                </div>

                {/* Card grid */}
                <div style={{
                  display:             'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap:                 12,
                }}>
                  {items.map(ev => <EventCard key={ev.eventId} ev={ev} />)}
                </div>
              </div>
            );
          })}

          {/* Attribution */}
          {!loading && !error && data.length > 0 && (
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              paddingTop:     10,
              borderTop:      '1px solid var(--border-light)',
              fontSize:       9,
              color:          'var(--text-muted)',
              opacity:        0.5,
              letterSpacing:  '0.04em',
            }}>
              <span>Data via Polymarket decentralized prediction markets · ~5 min refresh</span>
              <span>Not financial advice</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
