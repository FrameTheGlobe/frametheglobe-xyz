'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PolymarketEntry, PolyOutcome } from '@/app/api/polymarket/route';

// Injected once — keyframes for the shimmer sweep and the dot blink
const SHIMMER_STYLE = `
@keyframes pm-sweep {
  0%   { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
@keyframes pm-dot {
  0%, 80%, 100% { opacity: 0.2; transform: scale(0.7); }
  40%            { opacity: 1;   transform: scale(1);   }
}
`;

const CAT_META: Record<string, { color: string; bg: string; icon: string }> = {
  NUCLEAR:   { color: '#a855f7', bg: 'rgba(168,85,247,0.10)', icon: '☢' },
  CONFLICT:  { color: '#f97316', bg: 'rgba(249,115,22,0.10)', icon: '⚔' },
  REGIME:    { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  icon: '🏛' },
  DIPLOMACY: { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', icon: '🤝' },
};

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

function pctColor(pct: number): string {
  if (pct >= 70) return '#ef4444';
  if (pct >= 45) return '#f97316';
  if (pct >= 20) return '#eab308';
  return '#22c55e';
}

// ── Outcome row ───────────────────────────────────────────────────────────────
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
        display:      'flex',
        alignItems:   'center',
        gap:          8,
        padding:      '6px 0',
        borderBottom: '1px solid var(--border-light)',
      }}>
        {/* Date / label */}
        <span style={{
          flex:          1,
          fontSize:      11,
          color:         'var(--text-secondary)',
          fontFamily:    'var(--font-mono)',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          whiteSpace:    'nowrap',
        }}>
          {o.label}
        </span>

        {/* Percentage */}
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      14,
          fontWeight:    800,
          color:         col,
          letterSpacing: '-0.01em',
          flexShrink:    0,
          minWidth:      36,
          textAlign:     'right',
        }}>
          {pct}%
        </span>

        {/* Mini bar */}
        <div style={{
          width:        44,
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

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({ ev }: { ev: PolymarketEntry }) {
  const meta  = CAT_META[ev.category] ?? CAT_META.CONFLICT;
  const [hover, setHover] = useState(false);

  const isBig = ev.isBinary || ev.outcomes.length === 1;
  const pct   = isBig ? Math.round((ev.outcomes[0]?.yesPrice ?? 0) * 100) : null;
  const col   = pct !== null ? pctColor(pct) : meta.color;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        border:       `1px solid ${hover ? meta.color + '50' : 'var(--border-light)'}`,
        borderLeft:   `3px solid ${meta.color}`,
        borderRadius: '0 4px 4px 0',
        background:   hover ? meta.bg : 'var(--surface)',
        marginBottom: 6,
        overflow:     'hidden',
        transition:   'all 0.15s ease',
        boxShadow:    hover ? `0 1px 8px ${meta.color}18` : 'none',
      }}
    >
      {/* Title row */}
      <a
        href={ev.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ textDecoration: 'none', display: 'block', padding: '9px 11px 0' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: isBig ? 0 : 6 }}>
          <span style={{
            flex:       1,
            fontSize:   12,
            color:      'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            lineHeight: 1.35,
          }}>
            {ev.eventTitle}
          </span>

          {/* Big number for binary markets */}
          {isBig && pct !== null && (
            <div style={{ flexShrink: 0, textAlign: 'right', lineHeight: 1 }}>
              <div style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      24,
                fontWeight:    900,
                color:         col,
                letterSpacing: '-0.02em',
                textShadow:    pct > 50 ? `0 0 10px ${col}50` : 'none',
              }}>
                {pct}%
              </div>
              <div style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      9,
                color:         'var(--text-muted)',
                letterSpacing: '0.08em',
                textAlign:     'center',
                marginTop:     3,
              }}>
                YES
              </div>
            </div>
          )}
        </div>

        {/* Prob bar for binary */}
        {isBig && pct !== null && (
          <div style={{
            height:       4,
            background:   'var(--border-light)',
            borderRadius: 2,
            overflow:     'hidden',
            margin:       '8px 0 0',
          }}>
            <div style={{
              width:        `${pct}%`,
              height:       '100%',
              background:   `linear-gradient(90deg, ${col}80, ${col})`,
              borderRadius: 2,
              transition:   'width 0.5s ease',
            }} />
          </div>
        )}
      </a>

      {/* Multi-outcome rows */}
      {!isBig && ev.outcomes.length > 0 && (
        <div style={{ padding: '0 11px' }}>
          {ev.outcomes.slice(0, 3).map((o, i) => (
            <OutcomeRow key={i} o={o} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '5px 11px 8px',
        marginTop:      2,
      }}>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      10,
          color:         'var(--text-muted)',
          opacity:       0.65,
          letterSpacing: '0.03em',
        }}>
          {fmtVol(ev.volume)} vol
        </span>
        <span style={{
          fontSize:   10,
          color:      meta.color,
          opacity:    hover ? 1 : 0.45,
          transition: 'opacity 0.15s',
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
        }}>
          ↗ PM
        </span>
      </div>
    </div>
  );
}

// ── Main board ────────────────────────────────────────────────────────────────
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

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const ORDER: PolymarketEntry['category'][] = ['CONFLICT', 'REGIME', 'DIPLOMACY', 'NUCLEAR'];
  const byCategory = data.reduce<Record<string, PolymarketEntry[]>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});
  const presentCats = ORDER.filter(c => byCategory[c]?.length);

  return (
    <div style={{
      border:       '1px solid rgba(168,85,247,0.22)',
      borderRadius: 4,
      overflow:     'hidden',
      fontFamily:   'var(--font-mono)',
      boxShadow:    '0 0 0 1px rgba(168,85,247,0.06)',
    }}>
      <style>{SHIMMER_STYLE}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '9px 11px',
          background:     'linear-gradient(135deg, rgba(168,85,247,0.13) 0%, rgba(168,85,247,0.04) 100%)',
          border:         'none',
          borderBottom:   collapsed ? 'none' : '1px solid rgba(168,85,247,0.18)',
          cursor:         'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: '#a855f7',
            boxShadow:  '0 0 7px #a855f7',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 11, color: '#c084fc', letterSpacing: '0.1em', fontWeight: 800 }}>
            IRAN WAR ODDS
          </span>
          <span style={{
            fontSize:      9,
            color:         '#a855f7',
            border:        '1px solid rgba(168,85,247,0.35)',
            borderRadius:  2,
            padding:       '1px 5px',
            background:    'rgba(168,85,247,0.1)',
            letterSpacing: '0.06em',
          }}>
            POLYMARKET
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!loading && !error && data.length > 0 && (
            <span style={{
              fontSize:     9,
              color:        '#a855f7',
              background:   'rgba(168,85,247,0.12)',
              border:       '1px solid rgba(168,85,247,0.2)',
              borderRadius: 10,
              padding:      '1px 6px',
            }}>
              {data.length}
            </span>
          )}
          {updatedAt && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: 0.55 }}>
              {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <span style={{ fontSize: 10, color: '#a855f7', opacity: 0.7 }}>
            {collapsed ? '▼' : '▲'}
          </span>
        </div>
      </button>

      {!collapsed && (
        <div style={{ padding: '9px 8px 9px', background: 'var(--bg)' }}>

          {loading && (
            <div>
              {/* ── Shimmer sweep bar ─────────────────────────────── */}
              <div style={{
                position:     'relative',
                height:       3,
                background:   'rgba(168,85,247,0.15)',
                borderRadius: 2,
                overflow:     'hidden',
                marginBottom: 12,
              }}>
                <div style={{
                  position:   'absolute',
                  inset:      0,
                  width:      '30%',
                  background: 'linear-gradient(90deg, transparent, #a855f7, #c084fc, transparent)',
                  animation:  'pm-sweep 1.4s ease-in-out infinite',
                }} />
              </div>

              {/* ── Status label with animated dots ───────────────── */}
              <div style={{
                display:       'flex',
                alignItems:    'center',
                gap:           8,
                marginBottom:  14,
                paddingLeft:   2,
              }}>
                <span style={{ fontSize: 10, color: '#a855f7', opacity: 0.8, letterSpacing: '0.08em' }}>
                  SCANNING MARKETS
                </span>
                {/* Bouncing dots */}
                {[0, 0.2, 0.4].map((delay, i) => (
                  <span key={i} style={{
                    display:         'inline-block',
                    width:           4,
                    height:          4,
                    borderRadius:    '50%',
                    background:      '#a855f7',
                    animation:       `pm-dot 1.2s ease-in-out ${delay}s infinite`,
                  }} />
                ))}
              </div>

              {/* ── Skeleton cards ────────────────────────────────── */}
              {[72, 55, 88, 60].map((w, i) => (
                <div key={i} style={{
                  border:       '1px solid var(--border-light)',
                  borderLeft:   '3px solid rgba(168,85,247,0.3)',
                  borderRadius: '0 4px 4px 0',
                  background:   'var(--surface)',
                  padding:      '10px 11px',
                  marginBottom: 6,
                  overflow:     'hidden',
                  position:     'relative',
                }}>
                  {/* Shimmer sheen over card */}
                  <div style={{
                    position:   'absolute',
                    inset:      0,
                    background: 'linear-gradient(90deg, transparent 0%, rgba(168,85,247,0.06) 50%, transparent 100%)',
                    backgroundSize: '200% 100%',
                    animation:  'pm-sweep 1.8s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`,
                  }} />
                  {/* Fake title bar */}
                  <div style={{
                    height:       11,
                    width:        `${w}%`,
                    background:   'var(--border-light)',
                    borderRadius: 3,
                    marginBottom: 10,
                  }} />
                  {/* Fake outcome rows */}
                  {[45, 60].map((rw, j) => (
                    <div key={j} style={{
                      display:      'flex',
                      alignItems:   'center',
                      gap:          8,
                      padding:      '5px 0',
                      borderBottom: j === 0 ? '1px solid var(--border-light)' : 'none',
                    }}>
                      <div style={{ height: 9, width: `${rw}%`, background: 'var(--border-light)', borderRadius: 2 }} />
                      <div style={{ height: 9, width: 28, background: 'var(--border-light)', borderRadius: 2, marginLeft: 'auto' }} />
                      <div style={{ height: 5, width: 44, background: 'var(--border-light)', borderRadius: 3 }} />
                    </div>
                  ))}
                  {/* Fake vol */}
                  <div style={{ height: 8, width: 48, background: 'var(--border-light)', borderRadius: 2, marginTop: 8 }} />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div style={{ padding: '14px 6px', textAlign: 'center' }}>
              <div style={{
                fontSize:      11,
                color:         'var(--text-muted)',
                marginBottom:  10,
                letterSpacing: '0.06em',
                opacity:       0.7,
              }}>
                NO LIVE IRAN MARKETS
              </div>
              <button
                onClick={load}
                style={{
                  fontSize:      10,
                  color:         '#a855f7',
                  border:        '1px solid rgba(168,85,247,0.4)',
                  borderRadius:  3,
                  padding:       '4px 12px',
                  background:    'rgba(168,85,247,0.08)',
                  cursor:        'pointer',
                  letterSpacing: '0.07em',
                  fontFamily:    'var(--font-mono)',
                }}
              >
                ↺ RETRY
              </button>
            </div>
          )}

          {!loading && !error && presentCats.map(cat => {
            const meta = CAT_META[cat];
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                {/* Category label */}
                <div style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           6,
                  marginBottom:  6,
                  paddingBottom: 5,
                  borderBottom:  `1px solid ${meta.color}22`,
                }}>
                  <span style={{ fontSize: 11 }}>{meta.icon}</span>
                  <span style={{
                    fontSize:      10,
                    color:         meta.color,
                    fontWeight:    800,
                    letterSpacing: '0.1em',
                  }}>
                    {cat}
                  </span>
                  <span style={{
                    marginLeft:   'auto',
                    fontSize:     9,
                    color:        meta.color,
                    background:   meta.bg,
                    border:       `1px solid ${meta.color}25`,
                    borderRadius: 10,
                    padding:      '1px 6px',
                    fontWeight:   700,
                  }}>
                    {byCategory[cat].length}
                  </span>
                </div>

                {byCategory[cat].map(ev => <EventCard key={ev.eventId} ev={ev} />)}
              </div>
            );
          })}

          {!loading && !error && data.length > 0 && (
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              paddingTop:     6,
              borderTop:      '1px solid rgba(168,85,247,0.1)',
              fontSize:       9,
              color:          'var(--text-muted)',
              opacity:        0.5,
              letterSpacing:  '0.04em',
            }}>
              <span>via Polymarket · ~5 min</span>
              <span>not financial advice</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
