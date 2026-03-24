'use client';

/**
 * PreciousMetalsBoard
 *
 * Tracks Gold, Silver, Platinum and Palladium —
 * the safe-haven and geopolitical-risk metals most sensitive to
 * Strait of Hormuz / Middle East tension.
 *
 * Why these matter:
 *  · Gold is the primary crisis hedge — surges on Iran/Gulf escalation signals
 *  · Silver amplifies gold moves with higher volatility (industrial + monetary)
 *  · Platinum & palladium are autocatalyst metals — oil shock → auto-output cuts
 *  · Iran holds ~3% of global gold reserves; sanctions accelerate de-dollarisation
 *  · Gulf central banks (UAE, Saudi) absorb gold as petrodollar diversification
 */

import { useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

type MetalQuote = {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  unit:          string;
};

type ViewKey = 'BOARD' | 'CHARTS';

// ── Constants ────────────────────────────────────────────────────────────────

const POLL_MS = 3 * 60 * 1000;

const ACCENT   = '#f1c40f'; // gold yellow
const mono     = 'var(--font-mono)';
const muted    = 'var(--text-muted)';
const upColor  = '#2ecc71';
const downColor = '#e74c3c';
const flatColor = '#7f8c8d';

const CHART_SYMBOLS = [
  { id: 'gold',     tv: 'AMEX:GLD',   name: 'Gold (GLD ETF)',      color: '#f1c40f' },
  { id: 'silver',   tv: 'AMEX:SLV',   name: 'Silver (SLV ETF)',    color: '#bdc3c7' },
  { id: 'platinum', tv: 'NYMEX:PL1!', name: 'Platinum (Futures)',  color: '#3498db' },
  { id: 'palladium',tv: 'NYMEX:PA1!', name: 'Palladium (Futures)', color: '#9b59b6' },
];

const HORMUZ_IMPACTS = [
  {
    metal:       'Gold',
    icon:        '🥇',
    mechanic:    'Primary crisis hedge. Spikes immediately on Hormuz closure signals. Iran holds ~3% of global reserves.',
    sensitivity: 'CRITICAL',
    color:       '#e74c3c',
  },
  {
    metal:       'Silver',
    icon:        '🥈',
    mechanic:    'Dual monetary + industrial demand. Higher beta than gold. Electronics/solar supply chain exposed.',
    sensitivity: 'HIGH',
    color:       '#e67e22',
  },
  {
    metal:       'Platinum',
    icon:        '⚙️',
    mechanic:    'Autocatalyst metal — oil shock curtails auto production, reducing PGM demand. South Africa supply risk.',
    sensitivity: 'ELEVATED',
    color:       '#f39c12',
  },
  {
    metal:       'Palladium',
    icon:        '🔩',
    mechanic:    '~85% used in gasoline catalytic converters. Russia supply concentration adds geopolitical premium.',
    sensitivity: 'ELEVATED',
    color:       '#2ecc71',
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2) { return n.toFixed(d); }
function fmtLarge(n: number)   { return n >= 1000 ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n.toFixed(2); }
function sign(n: number)       { return n >= 0 ? '+' : ''; }
function priceColor(c: number) { return c > 0 ? upColor : c < 0 ? downColor : flatColor; }
function arrowIcon(c: number)  { return c > 0 ? '▲' : c < 0 ? '▼' : '●'; }

function sensitivityColor(s: string) {
  if (s === 'CRITICAL') return '#e74c3c';
  if (s === 'HIGH')     return '#e67e22';
  if (s === 'ELEVATED') return '#f39c12';
  return '#2ecc71';
}

// ── TradingView mini chart ───────────────────────────────────────────────────

function TVMiniChart({
  tvSymbol, name, color, colorTheme,
}: {
  tvSymbol: string; name: string; color: string; colorTheme: 'light' | 'dark';
}) {
  const containerId = `tv-metals-${tvSymbol.replace(/[^a-z0-9]/gi, '_')}`;

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src  = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol:         tvSymbol,
      width:          '100%',
      height:         220,
      locale:         'en',
      dateRange:      '1M',
      colorTheme:     colorTheme,
      trendLineColor: color,
      underLineColor: color + '33',
      isTransparent:  true,
      autosize:       true,
      largeChartUrl:  '',
    });
    container.appendChild(script);
    return () => { container.innerHTML = ''; };
  }, [tvSymbol, colorTheme, color, containerId]);

  return (
    <div style={{
      flex: '1 1 280px', minWidth: 260,
      border: '1px solid var(--border-light)',
      borderRadius: 4,
      overflow: 'hidden',
      background: 'var(--surface)',
    }}>
      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color }} />
        <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {name}
        </span>
      </div>
      <div id={containerId} style={{ height: 220 }} />
    </div>
  );
}

// ── Price Card ───────────────────────────────────────────────────────────────

function PriceCard({ quote, flashGen, accentDot }: { quote: MetalQuote; flashGen: number; accentDot?: string }) {
  const pc = priceColor(quote.change);

  return (
    <div style={{
      flex: '1 1 170px',
      padding: '16px 18px',
      borderRight: '1px solid var(--border-light)',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      {accentDot && (
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: accentDot, marginBottom: 1 }} />
      )}
      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {quote.name}
      </span>
      <span key={`${quote.symbol}-${flashGen}`} className="ftg-price-flash"
        style={{ fontFamily: mono, fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
        {'$' + fmtLarge(quote.price)}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: pc }}>
          {arrowIcon(quote.change)} {sign(quote.change)}{fmt(Math.abs(quote.change), 2)}
        </span>
        <span style={{ fontFamily: mono, fontSize: 11, color: pc }}>
          ({sign(quote.changePercent)}{fmt(Math.abs(quote.changePercent), 2)}%)
        </span>
      </div>
      <span style={{ fontFamily: mono, fontSize: 10, color: muted, marginTop: 1 }}>
        {quote.unit}
      </span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PreciousMetalsBoard() {
  const [quotes, setQuotes]           = useState<MetalQuote[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [view, setView]               = useState<ViewKey>('BOARD');
  const [colorTheme, setColorTheme]   = useState<'light' | 'dark'>('light');
  const [flashGen, setFlashGen]       = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [impactOpen, setImpactOpen]   = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/precious-metals');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MetalQuote[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setQuotes(data);
        setFlashGen(g => g + 1);
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        setError(null);
      }
    } catch {
      setError('Market data unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const check = () => {
      const html = document.documentElement;
      setColorTheme(html.dataset.theme === 'dark' || html.classList.contains('dark') ? 'dark' : 'light');
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, POLL_MS);
    return () => clearInterval(t);
  }, [fetchData]);

  // Partition quotes
  const futures = quotes.filter(q => ['GC.F', 'SI.F', 'PL.F', 'PA.F'].includes(q.symbol));
  const etfs    = quotes.filter(q => ['GLD.US', 'SLV.US'].includes(q.symbol));
  const gold    = quotes.find(q => q.symbol === 'GC.F');
  const silver  = quotes.find(q => q.symbol === 'SI.F');
  const gsRatio = gold && silver && silver.price > 0 ? gold.price / silver.price : null;

  return (
    <div style={{
      border:       '1px solid var(--border-light)',
      borderTop:    `2px solid ${ACCENT}`,
      borderRadius: '0 0 6px 6px',
      background:   'var(--surface)',
      marginBottom: 12,
      overflow:     'hidden',
    }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{
        padding:        '10px 16px',
        borderBottom:   '1px solid var(--border-light)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexWrap:       'wrap',
        gap:            8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14 }}>✦</span>
          <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 900, color: ACCENT, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Precious Metals
          </span>
          <span style={{ fontFamily: mono, fontSize: 10, color: muted, letterSpacing: '0.06em' }}>
            GOLD · SILVER · PLATINUM · PALLADIUM
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdated && (
            <span style={{ fontFamily: mono, fontSize: 9, color: muted }}>
              UPDATED {lastUpdated}
            </span>
          )}
          {(['BOARD', 'CHARTS'] as ViewKey[]).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontFamily:  mono,
                fontSize:    10,
                fontWeight:  700,
                letterSpacing: '0.06em',
                padding:     '3px 10px',
                border:      `1px solid ${view === v ? ACCENT : 'var(--border-light)'}`,
                borderRadius: 3,
                background:  view === v ? 'transparent' : 'transparent',
                color:       view === v ? ACCENT : muted,
                cursor:      'pointer',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading / Error ───────────────────────────────────────────────── */}
      {loading && (
        <div style={{ padding: '24px 16px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton" style={{ flex: '1 1 160px', height: 80, borderRadius: 4 }} />
          ))}
        </div>
      )}
      {!loading && error && (
        <div style={{ padding: '16px', fontFamily: mono, fontSize: 11, color: downColor }}>
          {error}
        </div>
      )}

      {/* ── BOARD VIEW ───────────────────────────────────────────────────── */}
      {!loading && !error && view === 'BOARD' && (
        <>
          {/* Futures prices */}
          <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid var(--border-light)' }}>
            <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Spot / Futures Prices
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)' }}>
            {futures.map((q, i) => (
              <PriceCard
                key={q.symbol}
                quote={q}
                flashGen={flashGen}
                accentDot={CHART_SYMBOLS[i]?.color}
              />
            ))}

            {/* Gold / Silver ratio sidebar */}
            <div style={{
              flex: '1 1 220px',
              padding: '16px 18px',
              display: 'flex', flexDirection: 'column', gap: 7,
            }}>
              <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Gold / Silver Ratio
              </span>
              {gsRatio !== null ? (
                <>
                  <span style={{ fontFamily: mono, fontSize: 28, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {fmt(gsRatio, 1)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: muted, lineHeight: 1.6 }}>
                    {gsRatio > 80
                      ? 'Above 80 — silver historically cheap vs gold. Elevated ratio signals risk-off flight to gold.'
                      : gsRatio < 50
                      ? 'Below 50 — silver outperforming. Industrial demand may be leading monetary demand.'
                      : 'Within historical 50–80 range. Balanced monetary/industrial demand signal.'}
                  </span>
                </>
              ) : (
                <span style={{ fontFamily: mono, fontSize: 12, color: muted }}>—</span>
              )}
            </div>
          </div>

          {/* ETF proxies row */}
          {etfs.length > 0 && (
            <>
              <div style={{ padding: '10px 16px 6px', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Liquid ETF Proxies
                  <span style={{ fontWeight: 400, marginLeft: 8, fontSize: 10 }}>GLD (SPDR Gold Shares) · SLV (iShares Silver Trust)</span>
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)' }}>
                {etfs.map(q => (
                  <PriceCard key={q.symbol} quote={q} flashGen={flashGen} />
                ))}
                <div style={{
                  flex: '2 1 320px',
                  padding: '16px 18px',
                  display: 'flex', flexDirection: 'column', gap: 7,
                }}>
                  <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Safe Haven Context
                  </span>
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: muted, lineHeight: 1.6 }}>
                    Gulf central banks (UAE, Saudi Arabia) hold <strong style={{ color: 'var(--text-primary)' }}>gold as petrodollar hedge</strong>.
                    A 30-day Hormuz closure historically adds <strong style={{ color: ACCENT }}>+$80–$150/oz</strong> to gold spot.
                    Iran has accelerated gold purchases to circumvent SWIFT/sanctions since 2018.
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Hormuz sensitivity matrix */}
          <div
            style={{
              padding:    '10px 16px',
              borderBottom: impactOpen ? '1px solid var(--border-light)' : undefined,
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor:     'pointer',
              userSelect: 'none',
            }}
            onClick={() => setImpactOpen(o => !o)}
          >
            <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              ✦ Strait of Hormuz — Metals Sensitivity Matrix
            </span>
            <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>
              {impactOpen ? '▲ HIDE' : '▼ SHOW'}
            </span>
          </div>

          {impactOpen && (
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {HORMUZ_IMPACTS.map(item => (
                <div key={item.metal} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '10px 12px',
                  border: '1px solid var(--border-light)',
                  borderLeft: `3px solid ${item.color}`,
                  borderRadius: 4,
                  background: 'var(--bg)',
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 900, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        {item.metal}
                      </span>
                      <span style={{
                        fontFamily: mono, fontSize: 9, fontWeight: 700,
                        color: sensitivityColor(item.sensitivity),
                        border: `1px solid ${sensitivityColor(item.sensitivity)}`,
                        padding: '1px 5px', borderRadius: 2,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                      }}>
                        {item.sensitivity}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: muted, lineHeight: 1.6 }}>
                      {item.mechanic}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CHARTS VIEW ──────────────────────────────────────────────────── */}
      {!loading && !error && view === 'CHARTS' && (
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {CHART_SYMBOLS.map(s => (
              <TVMiniChart
                key={s.id}
                tvSymbol={s.tv}
                name={s.name}
                color={s.color}
                colorTheme={colorTheme}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div style={{
        padding:        '6px 16px',
        borderTop:      '1px solid var(--border-light)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexWrap:       'wrap',
        gap:            6,
      }}>
        <span style={{ fontFamily: mono, fontSize: 9, color: muted }}>
          Price data via{' '}
          <a href="https://stooq.com" target="_blank" rel="noopener noreferrer"
            style={{ color: muted, textDecoration: 'underline' }}>Stooq.com</a>
          {' '}· GC.F · SI.F · PL.F · PA.F · GLD.US · SLV.US · ~15 min delay
        </span>
        <span style={{ fontFamily: mono, fontSize: 9, color: muted }}>
          GLD &amp; SLV are equity ETF proxies for spot gold/silver prices
        </span>
      </div>
    </div>
  );
}
