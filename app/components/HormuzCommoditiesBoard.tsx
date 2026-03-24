'use client';

/**
 * HormuzCommoditiesBoard
 *
 * Tracks Urea, Potash, Wheat, Corn, Soybeans and Natural Gas —
 * the commodity chain most exposed to Strait of Hormuz disruption.
 *
 * Why these matter:
 *  · Iran = world's 3rd-largest urea exporter; ~14 Mt/yr transits Hormuz
 *  · ~40% of global LPG (ammonia feedstock) passes through the strait
 *  · Urea production is 70-80% natural gas by cost — NG spikes directly inflate food prices
 *  · Wheat/Corn are 30-40% fertilizer cost — any Hormuz closure cascades into food inflation
 */

import { useState, useEffect, useCallback } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

type AgriQuote = {
  symbol:        string;
  name:          string;
  price:         number;
  change:        number;
  changePercent: number;
  unit:          string;
};

type ViewKey = 'BOARD' | 'CHARTS';

// ── Constants ───────────────────────────────────────────────────────────────

const POLL_MS = 3 * 60 * 1000;

const mono = 'var(--font-mono)';
const muted = 'var(--text-muted)';
const upColor   = '#2ecc71';
const downColor = '#e74c3c';
const flatColor = '#7f8c8d';

const CHART_SYMBOLS = [
  { id: 'cf',     tv: 'NYSE:CF',    name: 'CF Industries (Urea)', color: '#3498db' },
  { id: 'mos',    tv: 'NYSE:MOS',   name: 'Mosaic Co. (Potash)',  color: '#9b59b6' },
  { id: 'wheat',  tv: 'AMEX:WEAT',  name: 'Wheat (WEAT ETF)',     color: '#f39c12' },
  { id: 'corn',   tv: 'AMEX:CORN',  name: 'Corn (CORN ETF)',      color: '#e67e22' },
];

const HORMUZ_IMPACTS = [
  {
    commodity: 'Urea / Nitrogen',
    icon: '🌱',
    mechanic: 'Iran = #3 global exporter. Closure adds $40-80/t premium overnight.',
    sensitivity: 'CRITICAL',
    color: '#e74c3c',
  },
  {
    commodity: 'LPG / Ammonia',
    icon: '⚗️',
    mechanic: '40% of global LPG transits Hormuz. Ammonia is the key nitrogen feedstock.',
    sensitivity: 'HIGH',
    color: '#e67e22',
  },
  {
    commodity: 'Natural Gas',
    icon: '🔥',
    mechanic: '70-80% of urea production cost. Gulf gas disruption propagates directly to food.',
    sensitivity: 'HIGH',
    color: '#f39c12',
  },
  {
    commodity: 'Wheat / Grain',
    icon: '🌾',
    mechanic: 'Fertilizer is 30-40% of wheat production cost. NG spike → grain inflation in 4-6 months.',
    sensitivity: 'ELEVATED',
    color: '#2ecc71',
  },
  {
    commodity: 'Sulfur',
    icon: '⚡',
    mechanic: 'Iran = #4 global sulfur exporter. Phosphate fertilizer production depends on sulfuric acid.',
    sensitivity: 'ELEVATED',
    color: '#9b59b6',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number, d = 2) { return n.toFixed(d); }
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
  const containerId = `tv-agri-${tvSymbol.replace(/[^a-z0-9]/gi, '_')}`;

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const script = document.createElement('script');
    script.src  = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbol:     tvSymbol,
      width:      '100%',
      height:     220,
      locale:     'en',
      dateRange:  '1M',
      colorTheme: colorTheme,
      trendLineColor: color,
      underLineColor: color + '33',
      isTransparent: true,
      autosize:   true,
      largeChartUrl: '',
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

function PriceCard({ quote, flashGen }: { quote: AgriQuote; flashGen: number }) {
  const pc = priceColor(quote.change);

  const decimals = 2;

  return (
    <div style={{
      flex: '1 1 160px',
      padding: '16px 18px',
      borderRight: '1px solid var(--border-light)',
      display: 'flex', flexDirection: 'column', gap: 5,
    }}>
      <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {quote.name}
      </span>
      <span key={`${quote.symbol}-${flashGen}`} className="ftg-price-flash"
        style={{ fontFamily: mono, fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
        {'$' + fmt(quote.price, decimals)}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: pc }}>
          {arrowIcon(quote.change)} {sign(quote.change)}{fmt(Math.abs(quote.change), decimals)}
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

export default function HormuzCommoditiesBoard() {
  const [quotes, setQuotes]         = useState<AgriQuote[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [view, setView]             = useState<ViewKey>('BOARD');
  const [colorTheme, setColorTheme] = useState<'light' | 'dark'>('light');
  const [flashGen, setFlashGen]     = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [impactOpen, setImpactOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/agri-market');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AgriQuote[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setQuotes(data);
        setFlashGen(g => g + 1);
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        setError(null);
      }
    } catch (e) {
      setError('Market data unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // detect dark/light theme
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
  const fertilizers = quotes.filter(q => ['CF.US', 'MOS.US'].includes(q.symbol));
  const grains      = quotes.filter(q => ['WEAT.US', 'CORN.US', 'SOYB.US'].includes(q.symbol));
  const natgas      = quotes.find(q => q.symbol === 'NG.F');

  return (
    <div style={{
      border:        '1px solid var(--border-light)',
      borderTop:     '2px solid #f39c12',
      borderRadius:  '0 0 6px 6px',
      background:    'var(--surface)',
      marginBottom:  12,
      overflow:      'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding:        '10px 16px',
        borderBottom:   '1px solid var(--border-light)',
        background:     'rgba(243,156,18,0.06)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        flexWrap:       'wrap',
        gap:            8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 900, color: '#f39c12', letterSpacing: '0.1em' }}>
            ⚓ HORMUZ AGRI &amp; FERTILIZER IMPACT
          </span>
          <span style={{
            fontFamily: mono, fontSize: 8, color: muted,
            border: '1px solid var(--border-light)',
            padding: '1px 5px', borderRadius: 3, letterSpacing: '0.07em',
          }}>
            UREA · POTASH · GRAIN
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdated && (
            <span style={{ fontFamily: mono, fontSize: 9, color: muted }}>
              UPDATED {lastUpdated}
            </span>
          )}
          {/* View toggle */}
          {(['BOARD', 'CHARTS'] as ViewKey[]).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              fontFamily: mono, fontSize: 9, fontWeight: 700,
              padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: '0.08em',
              border:      view === v ? '1px solid #f39c12'                : '1px solid var(--border-light)',
              background:  view === v ? 'rgba(243,156,18,0.15)'             : 'transparent',
              color:       view === v ? '#f39c12'                           : muted,
            }}>{v}</button>
          ))}
          <button onClick={fetchData} title="Refresh" style={{
            fontFamily: mono, fontSize: 9, background: 'transparent',
            border: '1px solid var(--border-light)', borderRadius: 3,
            padding: '3px 7px', cursor: 'pointer', color: muted,
          }}>↻</button>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '20px 16px', fontFamily: mono, fontSize: 10, color: muted, textAlign: 'center' }}>
          FETCHING COMMODITY DATA…
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '12px 16px', fontFamily: mono, fontSize: 10, color: downColor, textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* ── BOARD VIEW ─────────────────────────────────────────────────── */}
      {!loading && !error && view === 'BOARD' && (
        <>
          {/* Urea cost drivers: CF Industries + Mosaic */}
          <div style={{
            padding: '10px 16px 6px',
            borderBottom: '1px solid var(--border-light)',
            background: 'rgba(255,255,255,0.01)',
          }}>
            <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              UREA &amp; POTASH PROXIES
            </span>
            <span style={{ fontFamily: mono, fontSize: 10, color: muted, marginLeft: 8, opacity: 0.7 }}>
              CF Industries (NYSE:CF) · Mosaic Co. (NYSE:MOS)
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)' }}>
            {fertilizers.map(q => (
              <PriceCard key={q.symbol} quote={q} flashGen={flashGen} />
            ))}
            {natgas && (
              <div style={{
                flex: '1 1 160px', padding: '16px 18px',
                display: 'flex', flexDirection: 'column', gap: 5,
                borderRight: '1px solid var(--border-light)',
              }}>
                <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                  Nat Gas (Input Cost)
                </span>
                <span key={`NG-${flashGen}`} className="ftg-price-flash"
                  style={{ fontFamily: mono, fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                  ${fmt(natgas.price)}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: priceColor(natgas.change) }}>
                    {arrowIcon(natgas.change)} {sign(natgas.change)}{fmt(Math.abs(natgas.change))}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 11, color: priceColor(natgas.change) }}>
                    ({sign(natgas.changePercent)}{fmt(Math.abs(natgas.changePercent), 2)}%)
                  </span>
                </div>
                <span style={{ fontFamily: mono, fontSize: 10, color: muted, marginTop: 1 }}>USD/MMBtu · ~75% of urea cost</span>
              </div>
            )}
            {/* Urea context note */}
            <div style={{
              flex: '2 1 240px', padding: '16px 18px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7,
            }}>
              <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: '#f39c12', letterSpacing: '0.07em' }}>
                IRAN UREA EXPOSURE
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: muted, lineHeight: 1.6 }}>
                Iran produces ~7.5 Mt/yr urea — ~8% of global supply.
                A 30-day Hormuz closure historically adds <strong>$40–80/t</strong> to spot urea prices.
              </span>
            </div>
          </div>

          {/* Grain markets */}
          <div style={{
            padding: '10px 16px 6px',
            borderBottom: '1px solid var(--border-light)',
            background: 'rgba(255,255,255,0.01)',
          }}>
            <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              GRAIN MARKETS · FERTILIZER COST PASS-THROUGH
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border-light)' }}>
            {grains.map(q => (
              <PriceCard key={q.symbol} quote={q} flashGen={flashGen} />
            ))}
            <div style={{
              flex: '2 1 240px', padding: '16px 18px',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 7,
            }}>
              <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: '#2ecc71', letterSpacing: '0.07em' }}>
                FERTILIZER → FOOD CHAIN
              </span>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: muted, lineHeight: 1.6 }}>
                Nitrogen fertilizer is ~30-40% of wheat/corn production cost.
                Hormuz closure creates a <strong>4–6 month lag</strong> before grain prices fully reflect the disruption.
              </span>
            </div>
          </div>

          {/* Hormuz Impact Explainer (collapsible) */}
          <div style={{ borderBottom: '1px solid var(--border-light)' }}>
            <button
              onClick={() => setImpactOpen(o => !o)}
              style={{
                width: '100%', padding: '7px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'transparent', border: 'none', cursor: 'pointer',
              }}
            >
              <span style={{ fontFamily: mono, fontSize: 10, fontWeight: 700, color: muted, letterSpacing: '0.1em' }}>
                ⚓ STRAIT OF HORMUZ — COMMODITY SENSITIVITY MATRIX
              </span>
              <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>{impactOpen ? '▲ HIDE' : '▼ SHOW'}</span>
            </button>

            {impactOpen && (
              <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {HORMUZ_IMPACTS.map(impact => (
                  <div key={impact.commodity} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '7px 10px',
                    border: '1px solid var(--border-light)',
                    borderLeft: `3px solid ${sensitivityColor(impact.sensitivity)}`,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,0.01)',
                  }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{impact.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                          {impact.commodity}
                        </span>
                        <span style={{
                          fontFamily: mono, fontSize: 9, fontWeight: 700,
                          color: sensitivityColor(impact.sensitivity),
                          border: `1px solid ${sensitivityColor(impact.sensitivity)}`,
                          padding: '1px 5px', borderRadius: 2, letterSpacing: '0.07em',
                        }}>
                          {impact.sensitivity}
                        </span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: muted, lineHeight: 1.6 }}>
                        {impact.mechanic}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Source attribution */}
          <div style={{
            padding: '7px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 6,
            background: 'rgba(255,255,255,0.01)',
          }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>
              Price data via{' '}
              <a href="https://stooq.com" target="_blank" rel="noopener noreferrer"
                style={{ color: muted, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                Stooq.com
              </a>
              {' '}· CF.US · MOS.US · WEAT.US · CORN.US · SOYB.US (Teucrium ETFs) · NG.F · ~15 min delay
            </span>
            <span style={{ fontFamily: mono, fontSize: 9, color: muted, opacity: 0.6, whiteSpace: 'nowrap' }}>
              CF.US &amp; MOS.US are equity proxies for urea/potash spot prices
            </span>
          </div>
        </>
      )}

      {/* ── CHARTS VIEW ────────────────────────────────────────────────── */}
      {!loading && !error && view === 'CHARTS' && (
        <>
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10,
            padding: '12px 12px 0',
          }}>
            {CHART_SYMBOLS.map(cs => (
              <TVMiniChart
                key={cs.id}
                tvSymbol={cs.tv}
                name={cs.name}
                color={cs.color}
                colorTheme={colorTheme}
              />
            ))}
          </div>
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--border-light)',
            background: 'rgba(255,255,255,0.01)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 6, marginTop: 12,
          }}>
            <span style={{ fontFamily: mono, fontSize: 10, color: muted }}>
              Charts via{' '}
              <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer"
                style={{ color: muted, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                TradingView
              </a>
              {' '}· NYSE:CF · NYSE:MOS · AMEX:WEAT · AMEX:CORN
            </span>
            <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: mono, fontSize: 10, color: muted, textDecoration: 'none', opacity: 0.7, whiteSpace: 'nowrap' }}>
              Powered by TradingView ↗
            </a>
          </div>
        </>
      )}
    </div>
  );
}
