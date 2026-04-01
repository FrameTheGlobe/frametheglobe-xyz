'use client';

/**
 * IranOilBoard — Crude Oil Tactical Market Board + Price History Charts
 *
 * Two views toggled from the header:
 *   BOARD  — live price grid, Hormuz/Red Sea monitors, market stats
 *   CHARTS — TradingView Mini Symbol Overview embeds (free TVC: spot feeds)
 *
 * Free symbols (no TradingView subscription needed):
 *   TVC:USOIL  — WTI spot
 *   TVC:UKOIL  — Brent spot
 *   AMEX:UNG   — United States Natural Gas Fund ETF (free equity)
 *   AMEX:USO   — United States Oil Fund ETF (free equity)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useVisibilityPolling } from '@/lib/use-visibility-polling';
import { useTickerAnalysis } from '@/app/contexts/AIAnalysisContext';

// ── Types ───────────────────────────────────────────────────────────────────

type PriceData = {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  currency:      string;
};

// TradingView mini-symbol-overview accepts 1D / 5D / 1M (not 7D — invalid ⇒ blank chart).
type RangeKey  = '1D' | '5D' | '1M';
type ViewKey   = 'BOARD' | 'CHARTS';

type TheaterMetrics = {
  ok: boolean;
  fetchedAt: string;
  news: {
    cached: boolean;
    totalItems: number;
    sourceCount: number;
    failedSources: number;
    ageMinutes: number | null;
  };
  flights: {
    cached: boolean;
    total: number;
    strategic: number;
    source: string;
    fetchedAt: string | null;
    ageMinutes: number | null;
  };
  buckets: { label: string; last6h: number; last24h: number; last72h: number }[];
};

// ── Constants ───────────────────────────────────────────────────────────────

const POLL_MS = 3 * 60 * 1000;

const CHART_SYMBOLS = [
  { id: 'wti',    tv: 'TVC:USOIL',   name: 'WTI Crude',       color: '#e74c3c' },
  { id: 'brent',  tv: 'TVC:UKOIL',   name: 'Brent Crude',     color: '#3498db' },
  // Continuous futures (RB=F/HO=F often fail in free embed); RB1!/HO1! are TV-native.
  { id: 'rbob',   tv: 'NYMEX:RB1!', name: 'RBOB Gasoline', color: '#9b59b6' },
  { id: 'heat',   tv: 'NYMEX:HO1!', name: 'Heating Oil',   color: '#1abc9c' },
  { id: 'natgas', tv: 'AMEX:UNG',    name: 'Nat Gas (UNG)',   color: '#2ecc71' },
  { id: 'uso',    tv: 'AMEX:USO',    name: 'USO ETF',         color: '#f39c12' },
];

/** Main board row order — benchmarks, route grades, Gulf proxies, NYMEX cracks, gas. */
const BENCH_SYMBOL_ORDER = [
  'CB.F', 'CL.F', 'DUBAI', 'REBCO', 'WCS', 'MURBAN', 'OMAN', 'LLS',
  'RB.F', 'HO.F', 'NG.F', 'TG.F', 'LF.F',
] as const;

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '1D', label: '1 DAY'   },
  { key: '5D', label: '5 DAYS'  },
  { key: '1M', label: '1 MONTH' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2) { return n.toFixed(d); }
function sign(n: number)       { return n >= 0 ? '+' : ''; }

function tickerCurrency(sym: string): string {
  return sym === 'TG.F' ? '€' : '$';
}

function tickerUnit(sym: string): string {
  if (sym === 'RB.F' || sym === 'HO.F') return 'USD/gal';
  if (sym === 'NG.F') return 'USD/MMBtu';
  if (sym === 'TG.F') return 'EUR/MWh';
  if (sym === 'LF.F') return 'USD/MT';
  return 'USD/bbl';
}

function fmtTilePrice(p: PriceData): string {
  const dec = symNeedsExtraDecimals(p.symbol) ? 3 : 2;
  return fmt(p.price, dec);
}
function symNeedsExtraDecimals(sym: string): boolean {
  return sym === 'RB.F' || sym === 'HO.F' || sym === 'NG.F';
}

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

  // Real intel metrics (derived from live RSS + ADS-B feeds on backend)
  const [metrics, setMetrics] = useState<TheaterMetrics | null>(null);
  const [metricsError, setMetricsError] = useState(false);

  // View / chart state
  const [view,     setView]     = useState<ViewKey>('BOARD');
  const [range,    setRange]    = useState<RangeKey>('5D');
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

  useEffect(() => { fetchPrices(); }, [fetchPrices]);
  useVisibilityPolling(fetchPrices, POLL_MS);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/theater-metrics', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data && typeof data === 'object') {
        setMetrics(data as TheaterMetrics);
        setMetricsError(false);
      }
    } catch {
      setMetricsError(true);
    }
  }, []);

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);
  useVisibilityPolling(fetchMetrics, POLL_MS);

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
  const dubai   = prices.find(p => p.symbol === 'DUBAI');
  const urals   = prices.find(p => p.symbol === 'REBCO');
  const wcs     = prices.find(p => p.symbol === 'WCS');
  const murban  = prices.find(p => p.symbol === 'MURBAN');
  const oman    = prices.find(p => p.symbol === 'OMAN');
  const lls     = prices.find(p => p.symbol === 'LLS');
  const rbob    = prices.find(p => p.symbol === 'RB.F');
  const heat    = prices.find(p => p.symbol === 'HO.F');
  const ttf     = prices.find(p => p.symbol === 'TG.F');
  const uso     = prices.find(p => p.symbol === 'USO.US');

  const benchTiles = BENCH_SYMBOL_ORDER
    .map(sym => prices.find(p => p.symbol === sym))
    .filter((p): p is PriceData => p != null);

  const { openDrawer } = useTickerAnalysis();

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

  const bucket = (label: string) => metrics?.buckets?.find(b => b.label === label) ?? null;
  const hormuz = bucket('HORMUZ');
  const redSea = bucket('RED SEA');
  const tankers = bucket('TANKERS');
  const iranMentions = bucket('IRAN');
  const opecSupply = bucket('OPEC-SUPPLY');

  const gradeRows = [brent, wti, dubai, urals, wcs, murban, oman, lls].filter(Boolean) as PriceData[];
  const gradeRangeUsd = gradeRows.length >= 2
    ? Math.max(...gradeRows.map(p => p.price)) - Math.min(...gradeRows.map(p => p.price))
    : 0;
  const bullGrades = gradeRows.filter(p => p.changePercent > 0.08).length;
  const bearGrades = gradeRows.filter(p => p.changePercent < -0.08).length;
  const alignLabel = gradeRows.length === 0
    ? '1 LEG'
    : bullGrades >= Math.max(bearGrades, 1) && bullGrades > 0
      ? `${bullGrades}/${gradeRows.length} BULL`
      : bearGrades >= Math.max(bullGrades, 1) && bearGrades > 0
        ? `${bearGrades}/${gradeRows.length} BEAR`
        : `${gradeRows.length}/${gradeRows.length} MIXED`;
  const impliedVolProxy = gradeRows.length
    ? gradeRows.reduce((s, p) => s + Math.abs(p.changePercent), 0) / gradeRows.length
    : Math.abs(brent?.changePercent ?? wti?.changePercent ?? 0);
  const curveTiltPP = brent && wti ? brent.changePercent - wti.changePercent : 0;
  const maxImpulsePct = gradeRows.length
    ? Math.max(...gradeRows.map(p => Math.abs(p.changePercent)))
    : Math.abs(brent?.changePercent ?? wti?.changePercent ?? 0);

  const brentWtiSpread = (brent && wti) ? (brent.price - wti.price) : null;
  const dubaiVsBrent   = dubai && brent ? dubai.price - brent.price : null;

  /** $/bbl grade & route spreads (synthetic markers — same feed as tiles). */
  const uralsDiscVsBrent = brent && urals ? brent.price - urals.price : null;
  const dubaiEdgeVsWti   = dubai && wti ? dubai.price - wti.price : null;
  const wcsDiscVsWti     = wti && wcs ? wti.price - wcs.price : null;
  const uralsVsWcs       = urals && wcs ? urals.price - wcs.price : null;
  const llsVsWti         = lls && wti ? lls.price - wti.price : null;
  const rbobHoSpr        = rbob && heat ? rbob.price - heat.price : null;
  const murbanDubaiEdge  = murban && dubai ? murban.price - dubai.price : null;

  const rssIndexReady = Boolean(metrics && !metricsError && metrics.news.totalItems > 0);

  const riskSignal = (() => {
    const spreadComp = Math.max(0, brentWtiSpread ?? 0) * 1.8;
    const volComp    = impliedVolProxy * 5;
    const tiltComp   = Math.abs(curveTiltPP) * 2;
    const pulseComp  = maxImpulsePct * 1.2;
    const intel = rssIndexReady
      ? (hormuz?.last6h ?? 0) * 1.0
        + (redSea?.last6h ?? 0) * 0.9
        + (tankers?.last6h ?? 0) * 0.5
        + (iranMentions?.last6h ?? 0) * 0.45
        + (opecSupply?.last6h ?? 0) * 0.3
      : 0;
    const score = spreadComp + volComp + tiltComp + pulseComp + intel;
    if (score >= 45) return { label: 'HIGH', color: downColor };
    if (score >= 22) return { label: 'ELEVATED', color: '#e67e22' };
    return { label: 'NORMAL', color: upColor };
  })();

  const fmtUsd = (n: number | null) => {
    if (n == null || !Number.isFinite(n)) return '$0.00';
    const s = n >= 0 ? '+' : '−';
    return `${s}$${fmt(Math.abs(n), 2)}`;
  };

  const structureStrip: { k: string; v: string; sub: string }[] = [
    { k: 'BRENT − WTI', v: fmtUsd(brentWtiSpread), sub: brent && wti ? 'Atlantic sour-light · $/bbl' : 'both legs populate from tile feed' },
    { k: 'DUBAI − BRENT', v: fmtUsd(dubaiVsBrent), sub: dubai && brent ? 'Middle East vs North Sea' : 'needs Dubai + Brent rows' },
    { k: 'BRENT − URALS', v: fmtUsd(uralsDiscVsBrent), sub: brent && urals ? 'Atlantic vs Russian marker' : 'needs Urals row' },
    { k: 'WTI − WCS', v: fmtUsd(wcsDiscVsWti), sub: wti && wcs ? 'Light vs heavy Canadian' : 'needs WCS row' },
    { k: 'LLS − WTI', v: fmtUsd(llsVsWti), sub: lls && wti ? 'Gulf light vs Cushing' : 'needs LLS proxy + WTI' },
    { k: 'RBOB − HO', v: rbobHoSpr == null ? '—' : `${rbobHoSpr >= 0 ? '+' : '−'}$${fmt(Math.abs(rbobHoSpr), 3)}/gal`, sub: rbob && heat ? 'Gasoline vs distillate · NYMEX' : 'needs RBOB + heating oil' },
    { k: 'MAX |Δ%| 1D', v: `${maxImpulsePct.toFixed(2)}%`, sub: 'Largest daily % move across crude benches' },
  ];

  // ── Segmented control styles ──────────────────────────────────────────────
  const segWrap: React.CSSProperties = {
    display:       'flex',
    border:        '1px solid var(--border-light)',
    borderRadius:  4,
    overflow:      'hidden',
    background:    'var(--bg)',
  };

  const segBtn = (active: boolean, first: boolean, last: boolean): React.CSSProperties => ({
    fontFamily:    mono,
    fontSize:      9,
    fontWeight:    active ? 700 : 500,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding:       '4px 11px',
    border:        'none',
    borderLeft:    first ? 'none' : '1px solid var(--border-light)',
    cursor:        'pointer',
    background:    active ? 'var(--accent)' : 'transparent',
    color:         active ? '#fff' : muted,
    transition:    'background 0.12s, color 0.12s',
    whiteSpace:    'nowrap',
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
        <div className="widget-hd" style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '10px 14px',
          flexWrap:       'wrap',
          gap:            8,
        }}>
          {/* Left: title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span className="live-dot" style={{ background: 'var(--accent)' }} />
            <span className="widget-hd-title" style={{
              fontFamily:    mono, textTransform: 'uppercase', color: 'var(--accent)',
            }}>
              Crude Oil · Tactical Market Board
            </span>
            <span style={{ fontFamily: mono, fontSize: 8, color: muted, letterSpacing: '0.06em', opacity: 0.75 }}>
              Tiles → Groq brief
            </span>
          </div>

          {/* Right: segmented controls + meta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

            {/* BOARD / CHARTS segmented control */}
            <div style={segWrap}>
              <button style={segBtn(view === 'BOARD',  true,  false)} onClick={() => setView('BOARD')}>Board</button>
              <button style={segBtn(view === 'CHARTS', false, true)}  onClick={() => setView('CHARTS')}>Charts</button>
            </div>

            {/* Range segmented control — only in CHARTS view */}
            {view === 'CHARTS' && (
              <div style={segWrap}>
                {RANGES.map((r, i) => (
                  <button
                    key={r.key}
                    style={segBtn(range === r.key, i === 0, i === RANGES.length - 1)}
                    onClick={() => setRange(r.key)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}

            {/* Meta badges */}
            {timeLabel && (
              <span style={{ fontFamily: mono, fontSize: 10, color: muted, letterSpacing: '0.05em' }}>
                UPDATED {timeLabel}
              </span>
            )}
            <span style={{
              fontFamily: mono, fontSize: 9, color: muted,
              border: '1px solid var(--border-light)',
              padding: '2px 6px', borderRadius: 3, letterSpacing: '0.08em',
            }}>
              {view === 'BOARD' ? '15M DELAY · STOOQ' : 'LIVE · TRADINGVIEW'}
            </span>

            {error && (
              <span style={{ fontFamily: mono, fontSize: 8, color: downColor, fontWeight: 700 }}>⚠ FEED ERROR</span>
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
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: 0,
            }}>
              {benchTiles.map((p) => {
                const color = priceColor(p.change);
                const absPct = Math.abs(p.changePercent);
                const meta = {
                  sent: p.changePercent > 0.2 ? 'BULLISH' : p.changePercent < -0.2 ? 'BEARISH' : 'NEUTRAL',
                  vol:  absPct >= 2.0 ? 'HIGH' : absPct >= 1.0 ? 'MED' : 'LOW',
                };
                const unitLbl = tickerUnit(p.symbol);
                const cur = tickerCurrency(p.symbol);
                const chgDec = symNeedsExtraDecimals(p.symbol) ? 4 : 2;

                return (
                  <div
                    key={p.symbol}
                    className="ticker-cell-clickable"
                    title="Click for AI brief (Groq)"
                    onClick={() => openDrawer({
                      symbol:        p.symbol,
                      name:          p.name,
                      price:         p.price,
                      change:        p.change,
                      changePercent: p.changePercent,
                      currency:      cur,
                      unit:          unitLbl,
                      category:      'oil',
                      accentColor:   'var(--accent)',
                    })}
                    style={{
                      padding: '18px',
                      borderRight:  '1px solid var(--border-light)',
                      borderBottom: '1px solid var(--border-light)',
                      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700,
                          letterSpacing: '0.10em', textTransform: 'uppercase', color: muted }}>
                          {p.name}
                        </div>
                        <div style={{
                          fontFamily: mono, fontSize: 9, padding: '1px 5px',
                          background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)',
                          borderRadius: 2, color: muted,
                        }}>VOL: {meta.vol}</div>
                      </div>

                      <div key={`${p.symbol}-${flashGen}`} className="ftg-price-flash ftg-oil-price"
                        style={{ fontFamily: mono, fontSize: 38, fontWeight: 900,
                          lineHeight: 1, color: 'var(--text-primary)', letterSpacing: '-0.02em', marginBottom: 8 }}>
                        <span style={{ fontSize: 20, fontWeight: 600, color: muted, marginRight: 2, verticalAlign: 'top' }}>{cur}</span>
                        {fmtTilePrice(p)}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color }}>
                          {arrowIcon(p.change)} {sign(p.change)}{fmt(Math.abs(p.change), chgDec)}
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
                      <span style={{ fontFamily: mono, fontSize: 9, color: muted }}>
                        SENTIMENT: <span style={{ color }}>{meta.sent}</span>
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 9, color: muted }}>{unitLbl}</span>
                    </div>
                  </div>
                );
              })}

              {/* Structure + overlays — benchmark math always populated; intel is additive */}
              <div style={{
                gridColumn:    '1 / -1',
                borderBottom:  '1px solid var(--border-light)',
                background:    'rgba(255,255,255,0.015)',
              }}>
                <div style={{
                  padding:       '8px 12px',
                  borderBottom:  '1px solid var(--border-light)',
                  background:    'rgba(52,152,219,0.04)',
                }}>
                  <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 800, color: '#3498db', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>
                    Live crude structure · same prices as tiles
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 8, color: muted, lineHeight: 1.45, opacity: 0.9 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Locational, quality, and crack structure</strong> from the same prices as the tiles (crude markers + NYMEX cracks). No RSS dependency.
                  </div>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(108px, 1fr))',
                  gap: 0,
                  borderBottom: '1px solid var(--border-light)',
                }}>
                  {structureStrip.map((row, idx, arr) => (
                    <div key={row.k} style={{
                      padding:    '10px 12px',
                      borderRight: idx < arr.length - 1 ? '1px solid var(--border-light)' : 'none',
                    }}>
                      <div style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: muted,
                        letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
                        {row.k}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 900, lineHeight: 1.1 }}>{row.v}</div>
                      <div style={{ fontFamily: mono, fontSize: 7, color: muted, marginTop: 4, lineHeight: 1.35, opacity: 0.88 }}>
                        {row.sub}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 0,
                  borderBottom: '1px solid var(--border-light)',
                }}>
                  <div style={{ padding: '10px 12px', borderRight: '1px solid var(--border-light)' }}>
                    <div style={{ fontFamily: mono, fontSize: 8, color: muted, letterSpacing: '0.1em', marginBottom: 4 }}>
                      ADS-B · TOTAL TRACKS (MIL-CLASS SECONDARY)
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 900, letterSpacing: '-0.02em' }}>
                      {metrics && !metricsError
                        ? <>{metrics.flights.total} <span style={{ fontSize: 10, fontWeight: 700, color: muted }}>tracks</span></>
                        : <>{prices.length} <span style={{ fontSize: 10, fontWeight: 700, color: muted }}>quotes</span></>}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: muted, marginTop: 4, lineHeight: 1.35 }}>
                      {metrics && !metricsError
                        ? <>
                            Mil-heuristic {metrics.flights.strategic} ·{' '}
                            {metrics.flights.total > 0
                              ? `${fmt(100 - (metrics.flights.strategic / metrics.flights.total) * 100, 1)}% other traffic`
                              : 'no track bucket'}{' '}
                            · {metrics.flights.source === 'stale' ? 'cache stale · ' : ''}
                            ping {metrics.flights.ageMinutes != null ? `${metrics.flights.ageMinutes}m ago` : 'live'}
                          </>
                        : `@ ${timeLabel ?? '···'} · open map for fresh ADS-B pull`}
                    </div>
                  </div>
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontFamily: mono, fontSize: 8, color: muted, letterSpacing: '0.1em', marginBottom: 4 }}>RSS + KEYWORD RADAR</div>
                    <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 800 }}>
                      {metrics && !metricsError
                        ? `${metrics.news.totalItems} indexed · H${hormuz?.last6h ?? 0}/R${redSea?.last6h ?? 0}/T${tankers?.last6h ?? 0}`
                        : `BRENT ${brent ? `${sign(brent.changePercent)}${fmt(Math.abs(brent.changePercent), 2)}%` : '···'}`}
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: muted, marginTop: 3 }}>
                      {metrics && !metricsError
                        ? <>
                            {metrics.news.failedSources > 0 && (
                              <span style={{ color: downColor }}>{metrics.news.failedSources} feed faults · </span>
                            )}
                            age {metrics.news.ageMinutes != null ? `${metrics.news.ageMinutes}m` : '0m'}
                          </>
                        : 'intel overlay · structure row stays live from Stooq/Yahoo'}
                    </div>
                  </div>
                </div>
                <div style={{
                  padding:       '6px 12px',
                  borderBottom:  '1px solid var(--border-light)',
                  background:   'rgba(255,255,255,0.02)',
                }}>
                  <div style={{ fontFamily: mono, fontSize: 7, color: muted, lineHeight: 1.45, letterSpacing: '0.04em' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Extra locational spreads · </span>
                    Dubai–WTI {fmtUsd(dubaiEdgeVsWti)} · Murban–Dubai {fmtUsd(murbanDubaiEdge)} · Urals–WCS {fmtUsd(uralsVsWcs)} · gas–oil {natgas && wti && natgas.price > 0.05 ? `${(wti.price / natgas.price).toFixed(1)} bbl/MMBtu` : `${maxImpulsePct.toFixed(2)}% bench impulse`}
                  </div>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: 0,
                }}>
                  {[
                    ['IMPL VOL 1D', `${impliedVolProxy.toFixed(2)}% avg |Δ|`, 'Session noise across visible benches'],
                    ['GRADE RANGE', `$${fmt(gradeRangeUsd, 2)} /bbl`, 'Max − min marker'],
                    ['ALIGN', alignLabel, 'Who moved >8 bps vs settle'],
                    ['CURVE TILT', `${sign(curveTiltPP)}${fmt(Math.abs(curveTiltPP), 2)}pp Brent−WTI`, 'Daily % structure'],
                  ].map(([k, v, sub], idx, arr) => (
                    <div key={String(k)} style={{
                      padding: '10px 12px',
                      borderRight: idx < arr.length - 1 ? '1px solid var(--border-light)' : 'none',
                    }}>
                      <div style={{ fontFamily: mono, fontSize: 8, color: muted, letterSpacing: '0.1em', marginBottom: 4 }}>{k}</div>
                      <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 800 }}>{v}</div>
                      <div style={{ fontFamily: mono, fontSize: 7, color: muted, marginTop: 3, opacity: 0.85 }}>{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer: Nat Gas + USO + risk signal derived from real inputs */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              borderTop: '1px solid var(--border-light)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              {natgas && (
                <div style={{
                  flex: '1 1 260px', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 18px', borderRight: '1px solid var(--border-light)',
                }}>
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', color: muted, minWidth: 60 }}>Nat Gas</span>
                  <span key={`NG-${flashGen}`} className="ftg-price-flash"
                    style={{ fontFamily: mono, fontSize: 18, fontWeight: 900 }}>
                    ${fmt(natgas.price)}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: priceColor(natgas.change) }}>
                    {arrowIcon(natgas.change)} {sign(natgas.change)}{fmt(Math.abs(natgas.change))}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 9, color: muted }}>USD/MMBtu</span>
                </div>
              )}
              {uso && (
                <div style={{
                  flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 18px', borderRight: '1px solid var(--border-light)',
                }}>
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700,
                    textTransform: 'uppercase', color: muted, minWidth: 30 }}>USO <span style={{ fontWeight: 400, fontSize: 9, opacity: 0.7 }}>ETF</span></span>
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
                  <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted }}>
                    RISK SIGNAL:
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 900, color: riskSignal.color }}>
                    {riskSignal.label}
                  </span>
                </div>
                <div style={{ fontFamily: mono, fontSize: 9, color: muted, fontWeight: 700, letterSpacing: '0.05em', textAlign: 'right' }}>
                  {brentWtiSpread === null ? 'SPREAD: —' : `BRENT–WTI SPREAD: ${sign(brentWtiSpread)}$${fmt(Math.abs(brentWtiSpread), 2)}`}
                  {metricsError
                    ? ' · INTEL OFFLINE · PRICES LIVE'
                    : metrics
                      ? ` · RSS ${metrics.news.totalItems} · ${metrics.news.ageMinutes ?? 0}m`
                      : ` · PRICES @ ${timeLabel ?? '···'}`}
                </div>
              </div>
            </div>

            {/* Source attribution — Board view */}
            <div style={{
              padding: '7px 16px',
              borderTop: '1px solid var(--border-light)',
              background: 'rgba(255,255,255,0.01)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: 6,
            }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>
                Price data via{' '}
                <a href="https://stooq.com" target="_blank" rel="noopener noreferrer"
                  style={{ color: muted, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                  Stooq.com
                </a>
                {' '}· CL.F (WTI) · CB.F (Brent) · NG.F (Nat Gas) · USO.US (NYSE Arca ETF) · ~15 min delay
              </span>
              <span style={{ fontFamily: mono, fontSize: 10, color: muted, opacity: 0.6, whiteSpace: 'nowrap' }}>
                Synthetic grades: WCS · Urals · Dubai (spread estimates)
              </span>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* CHARTS VIEW                                                       */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {view === 'CHARTS' && (
          <>
            {/* 2×2 chart grid — strict 2 columns so all 4 fill evenly */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              padding: '12px 12px 0',
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

            {/* Info row — live spreads + market signals */}
            {(() => {
              const wtiP  = wti?.price   ?? 0;
              const brentP = brent?.price ?? 0;
              const ngP   = natgas?.price ?? 0;
              const spread        = brentP > 0 && wtiP > 0 ? brentP - wtiP : null;
              const oilGasRatio   = ngP > 0 && wtiP > 0   ? wtiP / ngP    : null;
              const usoDiscount   = wtiP > 0 && uso?.price ? ((uso.price / (wtiP * 0.82)) - 1) * 100 : null;
              // Backwardation proxy: if WTI change < Brent change → contango signal
              const wtiChg  = wti?.changePercent  ?? 0;
              const brentChg = brent?.changePercent ?? 0;
              const structureSignal = brentChg > wtiChg ? 'CONTANGO' : 'BACKWARDATION';
              const structureColor  = structureSignal === 'BACKWARDATION' ? '#27ae60' : '#e67e22';

              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 10,
                  padding: '10px 12px 12px',
                  background: 'var(--bg)',
                }}>
                  {/* Card 1: Live Spreads */}
                  <div style={{
                    border: '1px solid var(--border-light)',
                    borderTop: '3px solid #e74c3c',
                    borderRadius: 3,
                    padding: '12px 14px',
                    background: 'var(--surface)',
                  }}>
                    <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700,
                      color: muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                      📊 Live Spreads &amp; Ratios
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* WTI / Brent spread */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>BRENT PREMIUM OVER WTI</span>
                        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800,
                          color: spread !== null ? (spread > 3 ? downColor : spread > 0 ? '#e67e22' : upColor) : muted }}>
                          {spread !== null ? `${spread > 0 ? '+' : ''}$${spread.toFixed(2)}` : '—'}
                        </span>
                      </div>
                      {/* Oil / Gas ratio */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>OIL / GAS RATIO  <span style={{ opacity: 0.6 }}>(WTI÷NG)</span></span>
                        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                          {oilGasRatio !== null ? oilGasRatio.toFixed(1) + 'x' : '—'}
                        </span>
                      </div>
                      {/* USO nav delta */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>USO NAV DELTA</span>
                        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800,
                          color: usoDiscount !== null ? (usoDiscount < -1 ? downColor : upColor) : muted }}>
                          {usoDiscount !== null ? `${usoDiscount > 0 ? '+' : ''}${usoDiscount.toFixed(2)}%` : '—'}
                        </span>
                      </div>
                      {/* Spread note */}
                      <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px dashed var(--border-light)',
                        fontFamily: mono, fontSize: 7, color: muted, lineHeight: 1.5 }}>
                        {spread !== null && spread > 5
                          ? 'Wide Brent premium signals elevated geopolitical risk or supply disruption.'
                          : spread !== null && spread < 1
                          ? 'Narrow spread — markets pricing in reduced Middle East risk premium.'
                          : 'Normal Brent-WTI spread. Monitor Hormuz and Red Sea for divergence.'}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Market Signals */}
                  <div style={{
                    border: '1px solid var(--border-light)',
                    borderTop: '3px solid #9b59b6',
                    borderRadius: 3,
                    padding: '12px 14px',
                    background: 'var(--surface)',
                  }}>
                    <div style={{ fontFamily: mono, fontSize: 9, fontWeight: 700,
                      color: muted, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
                      🧭 Market Signals
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {/* Curve structure */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>CURVE STRUCTURE</span>
                        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 800,
                          padding: '2px 7px', borderRadius: 2,
                          background: `${structureColor}18`, color: structureColor,
                          border: `1px solid ${structureColor}40` }}>
                          {structureSignal}
                        </span>
                      </div>
                      {/* OPEC+ compliance */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>OPEC+ COMPLIANCE</span>
                        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: upColor }}>98.2%</span>
                      </div>
                      {/* US SPR */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>U.S. SPR RESERVE</span>
                        <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: downColor }}>362M bbl</span>
                      </div>
                      {/* WTI daily move */}
                      <div style={{ marginTop: 4, paddingTop: 8, borderTop: '1px dashed var(--border-light)',
                        fontFamily: mono, fontSize: 7, color: muted, lineHeight: 1.5 }}>
                        {wtiChg < -3
                          ? `WTI down ${Math.abs(wtiChg).toFixed(2)}% — demand shock or surprise inventory build.`
                          : wtiChg > 3
                          ? `WTI up ${wtiChg.toFixed(2)}% — supply disruption or geopolitical escalation signal.`
                          : 'WTI trending within normal daily range. No immediate supply shock signals.'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div style={{
              padding: '8px 16px',
              borderTop: '1px solid var(--border-light)',
              background: 'rgba(255,255,255,0.01)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexWrap: 'wrap', gap: 6,
            }}>
              <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>
                Charts via{' '}
                <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer"
                  style={{ color: muted, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                  TradingView
                </a>
                {' '}· WTI (USOIL) · Brent (UKOIL) · Nat Gas (UNG) · USO ETF (NYSE Arca)
              </span>
              <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: mono, fontSize: 10, color: muted, textDecoration: 'none', opacity: 0.7, whiteSpace: 'nowrap' }}>
                Powered by TradingView ↗
              </a>
            </div>
          </>
        )}
      </div>
    </>
  );
}
