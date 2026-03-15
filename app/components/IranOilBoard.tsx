'use client';

/**
 * IranOilBoard — Crude Oil Price Display for the Iran War Theater section.
 *
 * Fetches Brent + WTI + Natural Gas from /api/market (Stooq, 15-min delayed).
 * Designed to read like a trading terminal: big bold numbers, directional
 * color coding, brief flash animation on price updates.
 *
 * Polling: every 3 minutes — market data is 15-min delayed, so polling faster
 * than this adds noise without benefit.
 */

import { useState, useEffect, useRef } from 'react';

type PriceData = {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  currency:      string;
};

const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function sign(n: number) {
  return n >= 0 ? '+' : '';
}

export default function IranOilBoard() {
  const [prices,     setPrices]     = useState<PriceData[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(false);
  const [updatedAt,  setUpdatedAt]  = useState<Date | null>(null);
  // Increments on every successful fetch to trigger flash animation
  const [flashGen,   setFlashGen]   = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrices = async () => {
    try {
      const res = await fetch('/api/market');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setPrices(data);
        setError(false);
        setUpdatedAt(new Date());
        setFlashGen(g => g + 1);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    timerRef.current = setInterval(fetchPrices, POLL_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const brent   = prices.find(p => p.symbol === 'CB.F');
  const wti     = prices.find(p => p.symbol === 'CL.F');
  const natgas  = prices.find(p => p.symbol === 'NG.F');

  const upColor   = '#27ae60';
  const downColor = '#c93a20';
  const neutralC  = 'var(--text-muted)';

  const priceColor = (change: number) =>
    change > 0 ? upColor : change < 0 ? downColor : neutralC;

  const arrowIcon = (change: number) => change >= 0 ? '▲' : '▼';

  // Skeleton card
  if (loading && prices.length === 0) {
    return (
      <div style={{
        background: 'var(--surface)',
        border:     '1px solid var(--border-light)',
        borderTop:  '2px solid #c93a20',
        borderRadius: 3,
        padding:    '12px 16px',
        marginBottom: 12,
        display:    'flex',
        alignItems: 'center',
        gap:        16,
      }}>
        {[1, 2].map(i => (
          <div key={i} style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 10, width: '60%', marginBottom: 6, borderRadius: 2 }} />
            <div className="skeleton" style={{ height: 28, width: '80%', borderRadius: 2 }} />
            <div className="skeleton" style={{ height: 9,  width: '50%', marginTop: 6, borderRadius: 2 }} />
          </div>
        ))}
      </div>
    );
  }

  if (error && prices.length === 0) {
    return (
      <div style={{
        background: 'var(--surface)',
        border:     '1px solid var(--border-light)',
        borderTop:  '2px solid #c93a20',
        borderRadius: 3,
        padding:    '10px 16px',
        marginBottom: 12,
        fontFamily: 'var(--font-mono)',
        fontSize:   10,
        color:      'var(--text-muted)',
        textAlign:  'center',
      }}>
        Market data unavailable
      </div>
    );
  }

  const timeLabel = updatedAt
    ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <>
      {/* Keyframes for the price flash */}
      <style>{`
        @keyframes ftg-price-flash {
          0%   { opacity: 0.4; }
          15%  { opacity: 1;   }
          100% { opacity: 1;   }
        }
        .ftg-price-flash { animation: ftg-price-flash 0.6s ease-out; }
      `}</style>

      <div style={{
        background:   'var(--surface)',
        border:       '1px solid var(--border-light)',
        borderTop:    '2px solid #c93a20',
        borderRadius: '0 0 3px 3px',
        marginBottom: 12,
        overflow:     'hidden',
      }}>
        {/* ── Header row ─────────────────────────────────────────────── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '7px 14px',
          borderBottom:   '1px solid var(--border-light)',
          background:     'rgba(201,58,32,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{
              display:         'inline-block',
              width:           6,
              height:          6,
              borderRadius:    '50%',
              background:      '#c93a20',
              boxShadow:       '0 0 6px rgba(201,58,32,0.6)',
              animation:       'pulse 2s infinite',
              flexShrink:      0,
            }} />
            <span style={{
              fontFamily:    'var(--font-mono)',
              fontSize:      10,
              fontWeight:    700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color:         '#c93a20',
            }}>
              Crude Oil · War Pricing
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {timeLabel && (
              <span style={{
                fontFamily:    'var(--font-mono)',
                fontSize:      8,
                color:         'var(--text-muted)',
                letterSpacing: '0.04em',
              }}>
                updated {timeLabel}
              </span>
            )}
            <span style={{
              fontFamily:    'var(--font-mono)',
              fontSize:      8,
              color:         'var(--text-muted)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              border:        '1px solid var(--border-light)',
              padding:       '1px 5px',
              borderRadius:  2,
            }}>
              15m delay · Stooq
            </span>
          </div>
        </div>

        {/* ── Main price board ─────────────────────────────────────── */}
        <div style={{
          display:  'grid',
          gridTemplateColumns: brent && wti ? '1fr 1fr' : '1fr',
          gap:      0,
        }}>
          {[brent, wti].filter(Boolean).map((p, idx) => {
            if (!p) return null;
            const color  = priceColor(p.change);
            const isLast = idx === 1;
            return (
              <div
                key={p.symbol}
                style={{
                  padding:     '14px 16px 12px',
                  borderRight: isLast ? 'none' : '1px solid var(--border-light)',
                  borderBottom: natgas ? '1px solid var(--border-light)' : 'none',
                }}
              >
                {/* Commodity label */}
                <div style={{
                  fontFamily:    'var(--font-mono)',
                  fontSize:      9,
                  fontWeight:    700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color:         'var(--text-muted)',
                  marginBottom:  6,
                }}>
                  {p.name}
                </div>

                {/* Big price */}
                <div
                  key={`${p.symbol}-${flashGen}`}
                  className="ftg-price-flash"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize:   36,
                    fontWeight: 800,
                    lineHeight: 1,
                    color:      'var(--text-primary)',
                    letterSpacing: '-0.02em',
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-muted)', marginRight: 2, verticalAlign: 'top', lineHeight: '44px' }}>$</span>
                  {fmt(p.price)}
                </div>

                {/* Change row */}
                <div style={{
                  display:    'flex',
                  alignItems: 'baseline',
                  gap:        6,
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize:   13,
                    fontWeight: 700,
                    color,
                  }}>
                    {arrowIcon(p.change)}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize:   12,
                    fontWeight: 700,
                    color,
                  }}>
                    {sign(p.change)}{fmt(Math.abs(p.change))}
                  </span>
                  <span style={{
                    fontFamily:  'var(--font-mono)',
                    fontSize:    11,
                    fontWeight:  500,
                    color,
                    opacity:     0.85,
                  }}>
                    ({sign(p.changePercent)}{fmt(p.changePercent)}%)
                  </span>
                  <span style={{
                    fontFamily:    'var(--font-mono)',
                    fontSize:      8,
                    color:         'var(--text-muted)',
                    letterSpacing: '0.04em',
                    marginLeft:    4,
                  }}>
                    USD/bbl
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Natural Gas secondary row ─────────────────────────────── */}
        {natgas && (
          <div style={{
            display:     'flex',
            alignItems:  'center',
            gap:         12,
            padding:     '8px 16px',
            borderTop:   '1px solid var(--border-light)',
            background:  'var(--bg)',
          }}>
            <span style={{
              fontFamily:    'var(--font-mono)',
              fontSize:      9,
              fontWeight:    700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color:         'var(--text-muted)',
              minWidth:      80,
            }}>
              Nat Gas
            </span>
            <span
              key={`NG-${flashGen}`}
              className="ftg-price-flash"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize:   16,
                fontWeight: 800,
                color:      'var(--text-primary)',
              }}
            >
              ${fmt(natgas.price)}
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize:   11,
              fontWeight: 600,
              color:      priceColor(natgas.change),
            }}>
              {arrowIcon(natgas.change)} {sign(natgas.change)}{fmt(Math.abs(natgas.change))} ({sign(natgas.changePercent)}{fmt(natgas.changePercent)}%)
            </span>
            <span style={{
              fontFamily:    'var(--font-mono)',
              fontSize:      8,
              color:         'var(--text-muted)',
              letterSpacing: '0.04em',
            }}>
              USD/MMBtu
            </span>
          </div>
        )}
      </div>
    </>
  );
}
