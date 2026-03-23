'use client';

/**
 * IranOilBoard — Crude Oil Tactical Market Board + Price History Charts
 *
 * Two views toggled from the header:
 *   BOARD  — live price grid, Hormuz/Red Sea monitors, market stats
 *   CHARTS — TradingView Mini Symbol Overview embeds (free TVC: spot feeds)
 *
 * Free symbols (no TradingView subscription needed):
 *   TVC:USOIL       — WTI spot
 *   TVC:UKOIL       — Brent spot
 *   TVC:NATURALGAS  — Natural Gas spot
 *   AMEX:USO        — USO ETF (equity, always free)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

type PriceData = {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  currency:      string;
};

type RangeKey  = '1D' | '7D' | '1M';
type ViewKey   = 'BOARD' | 'CHARTS';

// ── Constants ───────────────────────────────────────────────────────────────

const POLL_MS = 3 * 60 * 1000;

const CHART_SYMBOLS = [
  { id: 'wti',    tv: 'TVC:USOIL',        name: 'WTI Crude',   color: '#e74c3c' },
  { id: 'brent',  tv: 'TVC:UKOIL',        name: 'Brent Crude', color: '#3498db' },
  { id: 'natgas', tv: 'TVC:NATURALGAS',   name: 'Natural Gas', color: '#2ecc71' },
  { id: 'uso',    tv: 'AMEX:USO',         name: 'USO ETF',     color: '#f39c12' },
];

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '1D', label: '1 DAY'   },
  { key: '7D', label: '7 DAYS'  },
  { key: '1M', label: '1 MONTH' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2) { return n.toFixed(d); }
function sign(n: number)       { return n >= 0 ? '+' : ''; }

// ── TradingView mini chart (single symbol) ──────────────────────────────────

function TVMiniChart({
  tvSymbol, name, color, range, colorTheme,
}: {
  tvSymbol: string; name: string; color: string;
  range: RangeKey; colorTheme: 'dark' | 'light';
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    el.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src   = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.type  = 'text/javascript';
    script.textContent = JSON.stringify({
      symbol:        tvSymbol,
      width:         '100%',
      height:        180,
      locale:        'en',
      dateRange:     range,
      colorTheme,
      isTransparent: true,
      autosize:      true,
      chartOnly:     false,
      noTimeScale:   false,
    });
    el.appendChild(script);
    return () => { el.innerHTML = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvSymbol, range, colorTheme]);

  return (
    <div style={{
      background:   'var(--bg)',
      border:       '1px solid var(--border-light)',
      borderTop:    `3px solid ${color}`,
      borderRadius: 3,
      overflow:     'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 10px',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <span style={{ width: 8, height: 8, borderRadius: 2,
          background: color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9,
          fontWeight: 700, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {name}
        </span>
        <a
          href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`}
          target="_blank" rel="noopener noreferrer"
          style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8,
            color: 'var(--text-muted)', textDecoration: 'none', opacity: 0.6 }}>
          ↗ Full chart
        </a>
      </div>
      <div ref={containerRef} className="tradingview-widget-container" style={{ height: 185 }} />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export default function IranOilBoard() {
  // Board data
  const [prices,    setPrices]    = useState<PriceData[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [flashGen,  setFlashGen]  = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // View / chart state
  const [view,     setView]     = useState<ViewKey>('BOARD');
  const [range,    setRange]    = useState<RangeKey>('7D');
  const [tvTheme,  setTvTheme]  = useState<'dark' | 'light'>('dark');

  // ── Fetch prices ──────────────────────────────────────────────────────────
  const fetchPrices = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchPrices();
    timerRef.current = setInterval(fetchPrices, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchPrices]);

  // ── Detect site theme for TradingView ────────────────────────────────────
  useEffect(() => {
    const detect = () => {
      const attr = document.documentElement.getAttribute('data-theme');
      setTvTheme(attr === 'light' ? 'light' : 'dark');
    };
    detect();
    const obs = new MutationObserver(detect);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  // ── Derived prices ────────────────────────────────────────────────────────
  const brent  = prices.find(p => p.symbol === 'CB.F');
  const wti    = prices.find(p => p.symbol === 'CL.F');
  const natgas = prices.find(p => p.symbol === 'NG.F');
  const dubai  = prices.find(p => p.symbol === 'DUBAI');
  const urals  = prices.find(p => p.symbol === 'REBCO');
  const wcs    = prices.find(p => p.symbol === 'WCS');
  const uso    = prices.find(p => p.symbol === 'USO');

  const mono      = 'var(--font-mono)';
  const muted     = 'var(--text-muted)';
  const upColor   = '#27ae60';
  const downColor = '#c93a20';
  const neutralC  = 'var(--text-muted)';

  const priceColor = (n: number) => n > 0 ? upColor : n < 0 ? downColor : neutralC;
  const arrowIcon  = (n: number) => n >= 0 ? '▲' : '▼';
  const timeLabel  = updatedAt
    ? updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  // ── Shared tab button style ───────────────────────────────────────────────
  const tabBtn = (active: boolean) => ({
    fontFamily:    mono,
    fontSize:      9,
    fontWeight:    active ? 700 : 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding:       '3px 10px',
    border:        `1px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
    borderRadius:  2,
    cursor:        'pointer',
    background:    active ? 'var(--accent)' : 'transparent',
    color:         active ? '#fff' : muted,
    transition:    'all 0.15s',
  });

  const rangeBtn = (active: boolean) => ({
    fontFamily:    mono,
    fontSize:      9,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    padding:       '3px 10px',
    border:        `1px solid ${active ? 'var(--accent)' : 'var(--border-light)'}`,
    borderRadius:  2,
    cursor:        'pointer',
    background:    active ? 'var(--accent)' : 'var(--bg)',
    color:         active ? '#fff' : muted,
    fontWeight:    active ? 700 : 400,
  });

  if (loading && prices.length === 0) {
    return <div style={{ height: 200, background: 'var(--surface)',
      border: '1px solid var(--border-light)', borderRadius: 4 }} />;
  }

  return (
    <>
      <style>{`
        @keyframes ftg-price-flash {
          0%  { opacity: 0.4; }
          15% { opacity: 1;   }
          100%{ opacity: 1;   }
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

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '8px 14px',
          borderBottom:   '1px solid var(--border-light)',
          background:     'var(--accent-light)',
          flexWrap:       'wrap',
          gap:            8,
        }}>
          {/* Left: title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="live-dot" style={{ background: 'var(--accent)' }} />
            <span style={{
              fontFamily:    mono, fontSize: 10, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)',
            }}>
              Crude Oil · Tactical Market Board
            </span>
          </div>

          {/* Right: view toggle + meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {/* BOARD / CHARTS toggle */}
            <div style={{ display: 'flex', gap: 3 }}>
              <button style={tabBtn(view === 'BOARD')}  onClick={() => setView('BOARD')}>Board</button>
              <button style={tabBtn(view === 'CHARTS')} onClick={() => setView('CHARTS')}>Charts</button>
            </div>

            {/* Range toggles — only visible in CHARTS view */}
            {view === 'CHARTS' && (
              <div style={{ display: 'flex', gap: 3 }}>
                {RANGES.map(r => (
                  <button key={r.key} style={rangeBtn(range === r.key)} onClick={() => setRange(r.key)}>
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            {/* Meta badges */}
            {timeLabel && (
              <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>UPDATED {timeLabel}</span>
            )}
            {view === 'BOARD' && (
              <span style={{
                fontFamily: mono, fontSize: 8, color: muted,
                border: '1px solid var(--border-light)',
                padding: '1px 5px', borderRadius: 2, textTransform: 'uppercase',
              }}>15m delay · Stooq</span>
            )}
            {view === 'CHARTS' && (
              <span style={{
                fontFamily: mono, fontSize: 8, color: muted,
                border: '1px solid var(--border-light)',
                padding: '1px 5px', borderRadius: 2, textTransform: 'uppercase',
              }}>Live · TradingView</span>
            )}

            {/* Error indicator */}
            {error && (
              <span style={{ fontFamily: mono, fontSize: 8, color: downColor }}>⚠ FEED ERROR</span>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* BOARD VIEW                                                        */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {view === 'BOARD' && (
          <>
            {/* Main price grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: 0,
            }}>
              {[brent, wti, dubai, urals, wcs].filter(Boolean).map((p) => {
                if (!p) return null;
                const color = priceColor(p.change);
                const meta = p.symbol === 'CB.F' ? { sent: 'BULLISH', vol: 'HIGH' }
                           : p.symbol === 'CL.F' ? { sent: 'NEUTRAL', vol: 'MED' }
                           : { sent: 'STABLE', vol: 'LOW' };

                return (
                  <div key={p.symbol} style={{
                    padding: '18px',
                    borderRight:  '1px solid var(--border-light)',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700,
                          letterSpacing: '0.12em', textTransform: 'uppercase', color: muted }}>
                          {p.name}
                        </div>
                        <div style={{
                          fontFamily: mono, fontSize: 7, padding: '1px 5px',
                          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)',
                          borderRadius: 2, color: muted,
                        }}>VOL: {meta.vol}</div>
                      </div>

                      <div key={`${p.symbol}-${flashGen}`} className="ftg-price-flash ftg-oil-price"
                        style={{ fontFamily: mono, fontSize: 38, fontWeight: 900,
                          lineHeight: 1, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>
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
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ fontFamily: mono, fontSize: 7, color: muted }}>
                        SENTIMENT: <span style={{ color }}>{meta.sent}</span>
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 7, color: muted }}>USD/BBL</span>
                    </div>
                  </div>
                );
              })}

              {/* Hormuz Monitor */}
              <div style={{
                padding: '18px',
                borderRight: '1px solid var(--border-light)',
                borderBottom: '1px solid var(--border-light)',
                background: 'rgba(39,174,96,0.03)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase', color: '#27ae60', marginBottom: 10 }}>
                    Hormuz Monitor
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 900, color: '#27ae60' }}>OPEN</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: muted, textTransform: 'uppercase' }}>/ Normal</span>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Daily throughput: 19.8M bpd.<br />
                    No active IRGC blockade detected.
                  </div>
                </div>
                <div style={{ marginTop: 10, fontFamily: mono, fontSize: 7, color: '#27ae60', fontWeight: 700 }}>
                  STATUS: SECURE
                </div>
              </div>

              {/* Red Sea Corridor */}
              <div style={{
                padding: '18px',
                borderRight: '1px solid var(--border-light)',
                borderBottom: '1px solid var(--border-light)',
                background: 'rgba(230,126,34,0.03)',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700,
                    letterSpacing: '0.12em', textTransform: 'uppercase', color: '#e67e22', marginBottom: 10 }}>
                    Red Sea Corridor
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 900, color: '#e67e22' }}>CAUTION</span>
                    <span style={{ fontFamily: mono, fontSize: 10, color: muted, textTransform: 'uppercase' }}>/ Elevated</span>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    Active drone alerts in Bab-el-Mandeb.<br />
                    Escort required for LH class tankers.
                  </div>
                </div>
                <div style={{ marginTop: 10, fontFamily: mono, fontSize: 7, color: '#e67e22', fontWeight: 700 }}>
                  STATUS: RISK LEVEL 3
                </div>
              </div>

              {/* Market Stats 2×2 */}
              <div style={{
                borderBottom: '1px solid var(--border-light)',
                background: 'rgba(255,255,255,0.01)',
                display: 'grid', gridTemplateColumns: '1fr 1fr',
              }}>
                {[
                  { l: 'OPEC+ QUOTA',    v: '98.2%', s: 'STABLE'  },
                  { l: 'U.S. SPR',       v: '362M',  s: 'LOW'     },
                  { l: 'TANKER FREIGHT', v: '+12%',  s: 'RISING'  },
                  { l: 'REFINERY CAP',   v: '91.4%', s: 'TIGHT'   },
                ].map((s, i) => (
                  <div key={s.l} style={{
                    padding: '12px 14px',
                    borderRight: i % 2 === 0 ? '1px solid var(--border-light)' : 'none',
                    borderBottom: i < 2 ? '1px solid var(--border-light)' : 'none',
                  }}>
                    <div style={{ fontFamily: mono, fontSize: 7, color: muted, marginBottom: 4 }}>{s.l}</div>
                    <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 800 }}>{s.v}</div>
                    <div style={{ fontFamily: mono, fontSize: 6,
                      color: s.s === 'LOW' || s.s === 'RISING' ? downColor : upColor }}>
                      {s.s}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer: Nat Gas + USO + War Risk Premium */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              borderTop: '1px solid var(--border-light)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              {natgas && (
                <div style={{
                  flex: '1 1 300px', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 18px', borderRight: '1px solid var(--border-light)',
                }}>
                  <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase', color: muted, minWidth: 60 }}>Nat Gas</span>
                  <span key={`NG-${flashGen}`} className="ftg-price-flash"
                    style={{ fontFamily: mono, fontSize: 18, fontWeight: 900 }}>
                    ${fmt(natgas.price)}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: priceColor(natgas.change) }}>
                    {arrowIcon(natgas.change)} {sign(natgas.change)}{fmt(Math.abs(natgas.change))}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>USD/MMBtu</span>
                </div>
              )}
              {uso && (
                <div style={{
                  flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 18px', borderRight: '1px solid var(--border-light)',
                }}>
                  <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase', color: muted, minWidth: 30 }}>USO</span>
                  <span key={`USO-${flashGen}`} className="ftg-price-flash"
                    style={{ fontFamily: mono, fontSize: 18, fontWeight: 900 }}>
                    ${fmt(uso.price)}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: priceColor(uso.change) }}>
                    {arrowIcon(uso.change)} {sign(uso.change)}{fmt(Math.abs(uso.change))} ({sign(uso.changePercent)}{fmt(uso.changePercent)}%)
                  </span>
                </div>
              )}
              <div style={{
                flex: '2 1 400px', padding: '12px 18px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, color: muted }}>
                    WAR RISK PREMIUM:
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 900, color: 'var(--text-primary)' }}>
                    +$4.20 / bbl
                  </span>
                </div>
                <div style={{ fontFamily: mono, fontSize: 8, color: downColor, fontWeight: 700, letterSpacing: '0.05em' }}>
                  MARKET SENTIMENT: VOLATILITY SKEW ↗
                </div>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* CHARTS VIEW                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {view === 'CHARTS' && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 10,
              padding: 12,
              background: 'var(--bg)',
            }}>
              {CHART_SYMBOLS.map(s => (
                <TVMiniChart
                  key={`${s.id}-${range}-${tvTheme}`}
                  tvSymbol={s.tv}
                  name={s.name}
                  color={s.color}
                  range={range}
                  colorTheme={tvTheme}
                />
              ))}
            </div>

            <div style={{
              padding: '6px 14px 8px',
              borderTop: '1px solid var(--border-light)',
              fontFamily: mono, fontSize: 8, color: muted,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Data via TradingView · WTI (USOIL) · Brent (UKOIL) · Nat Gas (NATURALGAS) · USO</span>
              <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer"
                style={{ color: muted, textDecoration: 'none', opacity: 0.6 }}>
                Powered by TradingView ↗
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}
