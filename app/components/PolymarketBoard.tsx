'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PolymarketEntry } from '@/app/api/polymarket/route';

const CATEGORY_COLOR: Record<string, string> = {
  REGIME:   '#e74c3c',
  CONFLICT: '#e67e22',
  NUCLEAR:  '#9b59b6',
};

const CATEGORY_ICON: Record<string, string> = {
  REGIME:   '🏛️',
  CONFLICT: '✈️',
  NUCLEAR:  '☢️',
};

function ProbBar({ yes, category }: { yes: number; category: string }) {
  const pct   = Math.round(yes * 100);
  const color = CATEGORY_COLOR[category] ?? '#3498db';
  const risk  = pct >= 60 ? 'CRITICAL' : pct >= 30 ? 'ELEVATED' : pct >= 10 ? 'MODERATE' : 'LOW';
  const riskColor = pct >= 60 ? '#e74c3c' : pct >= 30 ? '#e67e22' : pct >= 10 ? '#f1c40f' : '#2ecc71';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      22,
          fontWeight:    700,
          color,
          letterSpacing: '-0.02em',
        }}>
          {pct}%
        </span>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      9,
          color:         riskColor,
          letterSpacing: '0.1em',
          fontWeight:    600,
          padding:       '2px 6px',
          border:        `1px solid ${riskColor}`,
          borderRadius:  3,
        }}>
          {risk}
        </span>
      </div>
      <div style={{
        height:       6,
        background:   'var(--border-light)',
        borderRadius: 3,
        overflow:     'hidden',
      }}>
        <div style={{
          width:        `${pct}%`,
          height:       '100%',
          background:   color,
          borderRadius: 3,
          transition:   'width 0.6s ease',
          boxShadow:    pct > 20 ? `0 0 8px ${color}60` : 'none',
        }} />
      </div>
    </div>
  );
}

export default function PolymarketBoard() {
  const [data,      setData]      = useState<PolymarketEntry[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/polymarket', { cache: 'no-store' });
      if (!res.ok) return;
      setData(await res.json());
      setUpdatedAt(new Date());
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(id);
  }, [load]);

  const byCategory = data.reduce<Record<string, PolymarketEntry[]>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});

  const categoryOrder = ['REGIME', 'CONFLICT', 'NUCLEAR'];

  return (
    <section style={{
      background:   'var(--bg)',
      border:       '1px solid var(--border-light)',
      borderTop:    '2px solid #9b59b6',
      borderRadius: '0 0 6px 6px',
      marginBottom: 12,
      fontFamily:   'var(--font-mono)',
    }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 16px',
        borderBottom:   collapsed ? 'none' : '1px solid var(--border-light)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: '#9b59b6',
            boxShadow:  '0 0 6px #9b59b6',
            display:    'inline-block',
          }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', fontWeight: 600 }}>
            PREDICTION MARKETS · IRAN WAR THEATER
          </span>
          <span style={{
            fontSize:    9,
            color:       '#9b59b6',
            letterSpacing: '0.08em',
            padding:     '1px 6px',
            border:      '1px solid #9b59b6',
            borderRadius: 3,
          }}>
            POLYMARKET
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {updatedAt && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
              UPDATED {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', fontSize: 11, padding: '2px 6px',
            }}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {loading && (
            <div style={{ color: 'var(--text-muted)', fontSize: 10, letterSpacing: '0.08em' }}>
              Loading prediction market data…
            </div>
          )}

          {!loading && categoryOrder.map(cat => {
            const markets = byCategory[cat];
            if (!markets?.length) return null;
            const color = CATEGORY_COLOR[cat];
            const icon  = CATEGORY_ICON[cat];

            return (
              <div key={cat}>
                {/* Category label */}
                <div style={{
                  display:      'flex',
                  alignItems:   'center',
                  gap:          6,
                  marginBottom: 10,
                }}>
                  <span style={{ fontSize: 12 }}>{icon}</span>
                  <span style={{
                    fontSize:      9,
                    color,
                    letterSpacing: '0.12em',
                    fontWeight:    700,
                  }}>
                    {cat}
                  </span>
                  <div style={{ flex: 1, height: 1, background: `${color}30` }} />
                </div>

                {/* Market cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {markets.map(m => (
                    <div key={m.conditionId} style={{
                      background:   'var(--surface)',
                      border:       '1px solid var(--border-light)',
                      borderLeft:   `3px solid ${CATEGORY_COLOR[m.category]}`,
                      borderRadius: '0 4px 4px 0',
                      padding:      '10px 12px',
                    }}>
                      {/* Question */}
                      <div style={{
                        fontSize:     12,
                        color:        'var(--text-primary)',
                        lineHeight:   1.4,
                        marginBottom: 8,
                        fontFamily:   'var(--font-body)',
                        fontWeight:   500,
                      }}>
                        {m.label}
                      </div>

                      {/* Probability bar */}
                      <ProbBar yes={m.yesPrice} category={m.category} />

                      {/* Footer */}
                      <div style={{
                        display:       'flex',
                        alignItems:    'center',
                        justifyContent:'space-between',
                        marginTop:     8,
                      }}>
                        <span style={{
                          fontSize:      9,
                          color:         'var(--text-muted)',
                          letterSpacing: '0.06em',
                        }}>
                          VOL ${m.volume >= 1_000_000
                            ? `${(m.volume / 1_000_000).toFixed(1)}M`
                            : m.volume >= 1_000
                              ? `${(m.volume / 1_000).toFixed(0)}K`
                              : m.volume.toFixed(0)} USDC
                        </span>
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize:      9,
                            color:         '#9b59b6',
                            letterSpacing: '0.06em',
                            textDecoration:'none',
                          }}
                        >
                          POLYMARKET ↗
                        </a>
                      </div>

                      {/* Description */}
                      <div style={{
                        fontSize:   10,
                        color:      'var(--text-muted)',
                        lineHeight: 1.5,
                        marginTop:  6,
                        fontFamily: 'var(--font-body)',
                        opacity:    0.75,
                      }}>
                        {m.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Attribution */}
          <div style={{
            fontSize:      9,
            color:         'var(--text-muted)',
            letterSpacing: '0.05em',
            opacity:       0.6,
            borderTop:     '1px solid var(--border-light)',
            paddingTop:    8,
          }}>
            Data via Polymarket — decentralized prediction markets · ~5 min refresh · Not financial advice
          </div>
        </div>
      )}
    </section>
  );
}
