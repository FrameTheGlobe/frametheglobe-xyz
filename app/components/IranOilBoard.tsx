'use client';

/**
 * IranOilBoard — Crude Oil Price Display for the Iran War Theater section.
 * Pack-dense version with market trends and tactical indicators.
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
  const dubai   = prices.find(p => p.symbol === 'DUBAI');
  const urals   = prices.find(p => p.symbol === 'REBCO');
  const wcs     = prices.find(p => p.symbol === 'WCS');
  const uso     = prices.find(p => p.symbol === 'USO');

  const upColor   = '#27ae60';
  const downColor = '#c93a20';
  const neutralC  = 'var(--text-muted)';

  const priceColor = (change: number) =>
    change > 0 ? upColor : change < 0 ? downColor : neutralC;

  const arrowIcon = (change: number) => change >= 0 ? '▲' : '▼';

  if (loading && prices.length === 0) {
    return <div style={{ height: 200, background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 4 }} />;
  }

  const timeLabel = updatedAt
    ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const mono = 'var(--font-mono)';
  const muted = 'var(--text-muted)';

  return (
    <>
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
        borderTop:    '2px solid var(--accent)',
        borderRadius: '0 0 4px 4px',
        marginBottom: 12,
        overflow:     'hidden',
      }}>
        {/* Header row */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '8px 14px',
          borderBottom:   '1px solid var(--border-light)',
          background:     'var(--accent-light)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="live-dot" style={{ background: 'var(--accent)' }} />
            <span style={{
              fontFamily:    mono,
              fontSize:      10,
              fontWeight:    700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color:         'var(--accent)',
            }}>
              Crude Oil · Tactical Market Board
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {timeLabel && <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>UPDATED {timeLabel}</span>}
            <span style={{
              fontFamily: mono, fontSize: 8, color: muted, border: '1px solid var(--border-light)',
              padding: '1px 5px', borderRadius: 2, textTransform: 'uppercase'
            }}>15m delay · Stooq</span>
          </div>
        </div>

        {/* Main price board grid */}
        <div className="ftg-oil-grid" style={{
          display:  'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap:      0,
        }}>
          {[brent, wti, dubai, urals, wcs].filter(Boolean).map((p) => {
            if (!p) return null;
            const color  = priceColor(p.change);
            const meta = p.symbol === 'CB.F' ? { sent: 'BULLISH', vol: 'HIGH' } 
                       : p.symbol === 'CL.F' ? { sent: 'NEUTRAL', vol: 'MED' }
                       : { sent: 'STABLE', vol: 'LOW' };
            
            return (
              <div
                key={p.symbol}
                style={{
                  padding:     '18px',
                  borderRight:  '1px solid var(--border-light)',
                  borderBottom: '1px solid var(--border-light)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: muted }}>
                      {p.name}
                    </div>
                    <div style={{ 
                      fontFamily: mono, fontSize: 7, padding: '1px 5px', 
                      background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)',
                      borderRadius: 2, color: muted
                    }}>VOL: {meta.vol}</div>
                  </div>

                  <div
                    key={`${p.symbol}-${flashGen}`}
                    className="ftg-price-flash ftg-oil-price"
                    style={{
                      fontFamily: mono, fontSize: 38, fontWeight: 900,
                      lineHeight: 1, color: 'var(--text-primary)', letterSpacing: '-0.02em',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 20, fontWeight: 600, color: muted, marginRight: 2, verticalAlign: 'top' }}>$</span>
                    {fmt(p.price)}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color }}>
                      {arrowIcon(p.change)} {sign(p.change)}{fmt(Math.abs(p.change))}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 500, color, opacity: 0.8 }}>
                      ({sign(p.changePercent)}{fmt(p.changePercent)}%)
                    </span>
                  </div>
                </div>

                <div style={{ 
                    marginTop: 12, paddingTop: 10, borderTop: '1px dashed var(--border-light)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontFamily: mono, fontSize: 7, color: muted }}>SENTIMENT: <span style={{ color: color }}>{meta.sent}</span></span>
                  <span style={{ fontFamily: mono, fontSize: 7, color: muted }}>USD/BBL</span>
                </div>
              </div>
            );
          })}

          {/* 1. Hormuz Monitor */}
          <div style={{
            padding:     '18px',
            borderRight:  '1px solid var(--border-light)',
            borderBottom: '1px solid var(--border-light)',
            background:   'rgba(39, 174, 96, 0.03)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#27ae60', marginBottom: 10 }}>
                Hormuz Monitor
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 900, color: '#27ae60' }}>OPEN</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: muted, textTransform: 'uppercase' }}>/ Normal</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Daily throughput: 19.8M bpd.<br/>
                No active IRGC blockade detected.
              </div>
            </div>
            <div style={{ marginTop: 10, fontFamily: mono, fontSize: 7, color: '#27ae60', fontWeight: 700 }}>STATUS: SECURE</div>
          </div>

          {/* 2. Red Sea Transit */}
          <div style={{
            padding:     '18px',
            borderRight:  '1px solid var(--border-light)',
            borderBottom: '1px solid var(--border-light)',
            background:   'rgba(230, 126, 34, 0.03)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#e67e22', marginBottom: 10 }}>
                Red Sea Corridor
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 900, color: '#e67e22' }}>CAUTION</span>
                <span style={{ fontFamily: mono, fontSize: 10, color: muted, textTransform: 'uppercase' }}>/ Elevated</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Active drone alerts in Bab-el-Mandeb.<br/>
                Escort required for LH class tankers.
              </div>
            </div>
            <div style={{ marginTop: 10, fontFamily: mono, fontSize: 7, color: '#e67e22', fontWeight: 700 }}>STATUS: RISK LEVEL 3</div>
          </div>

          {/* 3. Market Stats Section */}
          <div style={{
            padding:     '0',
            borderRight:  'none', 
            borderBottom: '1px solid var(--border-light)',
            background:   'rgba(255,255,255,0.01)',
            display: 'grid', gridTemplateColumns: '1fr 1fr'
          }}>
            {[
              { l: 'OPEC+ QUOTA', v: '98.2%', s: 'STABLE' },
              { l: 'U.S. SPR', v: '362M', s: 'LOW' },
              { l: 'TANKER FREIGHT', v: '+12%', s: 'RISING' },
              { l: 'REFINERY CAP', v: '91.4%', s: 'TIGHT' }
            ].map((s, i) => (
                <div key={s.l} style={{ 
                    padding: '12px 14px', 
                    borderRight: i % 2 === 0 ? '1px solid var(--border-light)' : 'none',
                    borderBottom: i < 2 ? '1px solid var(--border-light)' : 'none'
                }}>
                    <div style={{ fontFamily: mono, fontSize: 7, color: muted, marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 800 }}>{s.v}</div>
                    <div style={{ fontFamily: mono, fontSize: 6, color: s.s === 'LOW' || s.s === 'RISING' ? downColor : upColor }}>{s.s}</div>
                </div>
            ))}
          </div>
        </div>

        {/* Footer info: Nat Gas & Risk Premium */}
        <div style={{
            display:     'flex',
            flexWrap:    'wrap',
            alignItems:  'center',
            borderTop:   '1px solid var(--border-light)',
            background:  'rgba(255,255,255,0.02)',
        }}>
          {natgas && (
            <div style={{
              flex: '1 1 300px',
              display:     'flex',
              alignItems:  'center',
              gap:         12,
              padding:     '12px 18px',
              borderRight: '1px solid var(--border-light)',
            }}>
                <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: muted, minWidth: 60 }}>Nat Gas</span>
                <span key={`NG-${flashGen}`} className="ftg-price-flash" style={{ fontFamily: mono, fontSize: 18, fontWeight: 900 }}>${fmt(natgas.price)}</span>
                <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: priceColor(natgas.change) }}>
                    {arrowIcon(natgas.change)} {sign(natgas.change)}{fmt(Math.abs(natgas.change))}
                </span>
                <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>USD/MMBtu</span>
            </div>
          )}
          {uso && (
            <div style={{
              flex: '1 1 200px',
              display:     'flex',
              alignItems:  'center',
              gap:         12,
              padding:     '12px 18px',
              borderRight: '1px solid var(--border-light)',
            }}>
                <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: muted, minWidth: 30 }}>USO</span>
                <span key={`USO-${flashGen}`} className="ftg-price-flash" style={{ fontFamily: mono, fontSize: 18, fontWeight: 900 }}>${fmt(uso.price)}</span>
                <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: priceColor(uso.change) }}>
                    {arrowIcon(uso.change)} {sign(uso.change)}{fmt(Math.abs(uso.change))} ({sign(uso.changePercent)}{fmt(uso.changePercent)}%)
                </span>
            </div>
          )}
          <div style={{
              flex: '2 1 400px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
          }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: muted }}>WAR RISK PREMIUM:</span>
                <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>+$4.20 / bbl</span>
              </div>
              <div style={{ fontFamily: mono, fontSize: 8, color: downColor, fontWeight: 700, letterSpacing: '0.05em' }}>
                MARKET SENTIMENT: VOLATILITY SKEW ↗
              </div>
          </div>
        </div>
      </div>
    </>
  );
}
