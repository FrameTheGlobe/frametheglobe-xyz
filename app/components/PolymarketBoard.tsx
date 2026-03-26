'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PolymarketEntry } from '@/app/api/polymarket/route';

const CAT_META: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  NUCLEAR:   { color: '#a855f7', bg: 'rgba(168,85,247,0.08)',  icon: '☢',  label: 'NUCLEAR'   },
  CONFLICT:  { color: '#f97316', bg: 'rgba(249,115,22,0.08)',  icon: '⚔',  label: 'CONFLICT'  },
  REGIME:    { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   icon: '🏛',  label: 'REGIME'    },
  DIPLOMACY: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', icon: '🤝', label: 'DIPLOMACY' },
};

function riskTier(pct: number): { label: string; color: string; glow: boolean } {
  if (pct >= 65) return { label: 'CRITICAL', color: '#ef4444', glow: true  };
  if (pct >= 35) return { label: 'HIGH',     color: '#f97316', glow: true  };
  if (pct >= 15) return { label: 'ELEVATED', color: '#eab308', glow: false };
  if (pct >= 5)  return { label: 'LOW',      color: '#22c55e', glow: false };
  return               { label: 'MINIMAL',  color: '#6b7280', glow: false };
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function MarketCard({ m, rank }: { m: PolymarketEntry; rank: number }) {
  const pct   = Math.round(m.yesPrice * 100);
  const meta  = CAT_META[m.category] ?? CAT_META.CONFLICT;
  const risk  = riskTier(pct);
  const [hover, setHover] = useState(false);

  return (
    <a
      href={m.url}
      target="_blank"
      rel="noopener noreferrer"
      title={`${m.label} — click to view on Polymarket`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display:        'block',
        textDecoration: 'none',
        borderRadius:   4,
        border:         `1px solid ${hover ? meta.color + '50' : 'var(--border-light)'}`,
        borderLeft:     `3px solid ${meta.color}`,
        background:     hover ? meta.bg : 'var(--surface)',
        padding:        '9px 10px 8px',
        marginBottom:   5,
        transition:     'all 0.15s ease',
        boxShadow:      hover && risk.glow ? `0 0 10px ${meta.color}20` : 'none',
        position:       'relative',
      }}
    >
      {/* Rank + category pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      7,
          color:         'var(--text-muted)',
          opacity:       0.5,
          fontWeight:    700,
          letterSpacing: '0.05em',
        }}>
          #{rank}
        </span>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      7,
          color:         meta.color,
          background:    meta.bg,
          border:        `1px solid ${meta.color}40`,
          borderRadius:  2,
          padding:       '0px 4px',
          letterSpacing: '0.08em',
          fontWeight:    700,
        }}>
          {meta.icon} {meta.label}
        </span>
      </div>

      {/* Question + Big % */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
        <span style={{
          flex:       1,
          fontSize:   10,
          color:      'var(--text-primary)',
          lineHeight: 1.4,
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          minWidth:   0,
        }}>
          {m.label}
        </span>
        {/* Probability number */}
        <div style={{
          flexShrink:  0,
          textAlign:   'right',
          lineHeight:  1,
        }}>
          <div style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      22,
            fontWeight:    900,
            color:         meta.color,
            letterSpacing: '-0.03em',
            textShadow:    risk.glow ? `0 0 12px ${meta.color}60` : 'none',
          }}>
            {pct}%
          </div>
          <div style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      7,
            color:         risk.color,
            border:        `1px solid ${risk.color}60`,
            borderRadius:  2,
            padding:       '1px 4px',
            letterSpacing: '0.07em',
            fontWeight:    700,
            marginTop:     3,
            textAlign:     'center',
            background:    `${risk.color}10`,
          }}>
            {risk.label}
          </div>
        </div>
      </div>

      {/* Probability bar */}
      <div style={{
        height:       4,
        background:   'var(--border-light)',
        borderRadius: 2,
        overflow:     'hidden',
        marginBottom: 5,
      }}>
        <div style={{
          width:        `${pct}%`,
          height:       '100%',
          background:   `linear-gradient(90deg, ${meta.color}90, ${meta.color})`,
          borderRadius: 2,
          transition:   'width 0.6s cubic-bezier(0.16,1,0.3,1)',
          boxShadow:    pct > 15 ? `0 0 6px ${meta.color}50` : 'none',
        }} />
      </div>

      {/* Footer: vol + arrow */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      8,
          color:         'var(--text-muted)',
          opacity:       0.65,
          letterSpacing: '0.04em',
        }}>
          vol {fmtVol(m.volume)} USDC
        </span>
        <span style={{
          fontSize:   9,
          color:      meta.color,
          opacity:    hover ? 1 : 0.5,
          transition: 'opacity 0.15s',
        }}>
          ↗
        </span>
      </div>
    </a>
  );
}

export default function PolymarketBoard() {
  const [data,      setData]      = useState<PolymarketEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error,     setError]     = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch('/api/polymarket', { cache: 'no-store' });
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

  // Group by category, order: NUCLEAR first, then CONFLICT, REGIME, DIPLOMACY
  const ORDER: PolymarketEntry['category'][] = ['NUCLEAR', 'CONFLICT', 'REGIME', 'DIPLOMACY'];
  const byCategory = data.reduce<Record<string, PolymarketEntry[]>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});
  const presentCats = ORDER.filter(c => byCategory[c]?.length);

  // Global rank across all categories (sorted by prob desc)
  const rankMap = new Map<string, number>();
  [...data].sort((a, b) => b.yesPrice - a.yesPrice).forEach((m, i) => rankMap.set(m.conditionId, i + 1));

  return (
    <div style={{
      borderRadius:  4,
      overflow:      'hidden',
      fontFamily:    'var(--font-mono)',
      border:        '1px solid rgba(168,85,247,0.25)',
      boxShadow:     '0 0 0 1px rgba(168,85,247,0.08), inset 0 1px 0 rgba(168,85,247,0.06)',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '9px 11px',
          background:     'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(168,85,247,0.04) 100%)',
          border:         'none',
          borderBottom:   collapsed ? 'none' : '1px solid rgba(168,85,247,0.2)',
          cursor:         'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {/* Pulsing dot */}
          <span style={{
            width:      7, height: 7, borderRadius: '50%',
            background: '#a855f7',
            boxShadow:  '0 0 8px #a855f7, 0 0 16px #a855f740',
            flexShrink: 0,
            animation:  'pulse 2s infinite',
          }} />
          <span style={{
            fontSize:      10,
            color:         '#c084fc',
            letterSpacing: '0.12em',
            fontWeight:    800,
          }}>
            IRAN WAR ODDS
          </span>
          <span style={{
            fontSize:      7,
            color:         '#a855f7',
            border:        '1px solid #a855f740',
            borderRadius:  2,
            padding:       '1px 5px',
            letterSpacing: '0.08em',
            background:    'rgba(168,85,247,0.1)',
          }}>
            POLYMARKET
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {!loading && !error && data.length > 0 && (
            <span style={{
              fontSize:   7,
              color:      '#a855f7',
              background: 'rgba(168,85,247,0.12)',
              border:     '1px solid rgba(168,85,247,0.2)',
              borderRadius: 10,
              padding:    '1px 6px',
              letterSpacing: '0.06em',
            }}>
              {data.length} MKTS
            </span>
          )}
          {updatedAt && (
            <span style={{ fontSize: 7, color: 'var(--text-muted)', opacity: 0.55 }}>
              {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <span style={{ fontSize: 9, color: '#a855f7', opacity: 0.7 }}>
            {collapsed ? '▼' : '▲'}
          </span>
        </div>
      </button>

      {!collapsed && (
        <div style={{
          padding:    '10px 8px 10px',
          background: 'var(--bg)',
        }}>

          {/* Loading */}
          {loading && (
            <div style={{
              padding:       '18px 0',
              textAlign:     'center',
              fontSize:      9,
              color:         '#a855f7',
              letterSpacing: '0.12em',
              opacity:       0.7,
            }}>
              ⟳ SCANNING MARKETS…
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div style={{ padding: '12px 6px', textAlign: 'center' }}>
              <div style={{
                fontSize:   9,
                color:      'var(--text-muted)',
                marginBottom: 8,
                letterSpacing: '0.06em',
                opacity:    0.7,
              }}>
                NO LIVE IRAN MARKETS FOUND
              </div>
              <button
                onClick={load}
                style={{
                  fontSize:      8,
                  color:         '#a855f7',
                  border:        '1px solid rgba(168,85,247,0.4)',
                  borderRadius:  3,
                  padding:       '3px 10px',
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

          {/* Category sections */}
          {!loading && !error && presentCats.map(cat => {
            const meta = CAT_META[cat];
            return (
              <div key={cat} style={{ marginBottom: 12 }}>
                {/* Category divider */}
                <div style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:           6,
                  marginBottom:  6,
                  paddingBottom: 5,
                  borderBottom:  `1px solid ${meta.color}25`,
                }}>
                  <span style={{ fontSize: 10 }}>{meta.icon}</span>
                  <span style={{
                    fontSize:      8,
                    color:         meta.color,
                    fontWeight:    800,
                    letterSpacing: '0.12em',
                  }}>
                    {meta.label}
                  </span>
                  <span style={{
                    marginLeft:    'auto',
                    fontSize:      7,
                    color:         meta.color,
                    background:    meta.bg,
                    border:        `1px solid ${meta.color}30`,
                    borderRadius:  10,
                    padding:       '0 5px',
                    fontWeight:    700,
                  }}>
                    {byCategory[cat].length}
                  </span>
                </div>

                {byCategory[cat].map(m => (
                  <MarketCard key={m.conditionId} m={m} rank={rankMap.get(m.conditionId) ?? 0} />
                ))}
              </div>
            );
          })}

          {/* Footer attribution */}
          {!loading && !error && data.length > 0 && (
            <div style={{
              display:       'flex',
              alignItems:    'center',
              justifyContent:'space-between',
              paddingTop:    6,
              borderTop:     '1px solid rgba(168,85,247,0.12)',
              fontSize:      7,
              color:         'var(--text-muted)',
              opacity:       0.5,
              letterSpacing: '0.04em',
            }}>
              <span>via Polymarket · ~5 min refresh</span>
              <span>not financial advice</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
