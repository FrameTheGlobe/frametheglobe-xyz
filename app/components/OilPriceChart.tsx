'use client';

/**
 * OilPriceChart — uses TradingView Mini Symbol Overview embeds.
 *
 * The previous version tried to fetch from Stooq's historical CSV download
 * endpoint (/q/d/l/) which is blocked/returns "No data" from Vercel.
 * TradingView mini chart widgets are client-side, always live, and need no
 * API key. The 1D / 7D toggle re-mounts the widgets with the new range.
 */

import { useEffect, useRef, useState } from 'react';

type RangeKey = '1D' | '7D' | '1M';

const SYMBOLS = [
  { id: 'wti',    tv: 'NYMEX:CL1!',  name: 'WTI Crude',   color: '#e74c3c' },
  { id: 'brent',  tv: 'ICEEUR:B1!',  name: 'Brent Crude', color: '#3498db' },
  { id: 'natgas', tv: 'NYMEX:NG1!',  name: 'Natural Gas', color: '#2ecc71' },
  { id: 'uso',    tv: 'AMEX:USO',    name: 'USO ETF',     color: '#f39c12' },
];

// ── Single TradingView mini chart ──────────────────────────────────────────

function TVMiniChart({
  tvSymbol,
  name,
  color,
  range,
  colorTheme,
}: {
  tvSymbol:   string;
  name:       string;
  color:      string;
  range:      RangeKey;
  colorTheme: 'dark' | 'light';
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Clear previous widget
    el.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    el.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js';
    script.async = true;
    script.type  = 'text/javascript';
    // TradingView reads config from script.textContent
    script.textContent = JSON.stringify({
      symbol:        tvSymbol,
      width:         '100%',
      height:        180,
      locale:        'en',
      dateRange:     range,
      colorTheme,
      isTransparent: true,
      autosize:      true,
      largeChartUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`,
      chartOnly:     false,
      noTimeScale:   false,
    });
    el.appendChild(script);

    return () => { el.innerHTML = ''; };
  // Re-mount whenever range or theme changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvSymbol, range, colorTheme]);

  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border-light)',
      borderTop: `3px solid ${color}`,
      borderRadius: 3,
      overflow: 'hidden',
    }}>
      {/* Chip header */}
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
      {/* Widget mount point */}
      <div
        ref={containerRef}
        className="tradingview-widget-container"
        style={{ height: 185 }}
      />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function OilPriceChart() {
  const [range,     setRange]     = useState<RangeKey>('7D');
  const [collapsed, setCollapsed] = useState(false);
  // Detect theme — TradingView needs explicit dark/light
  const [tvTheme,   setTvTheme]   = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    // Mirror the site's theme toggle by watching <html> data-theme attribute
    const detect = () => {
      const attr = document.documentElement.getAttribute('data-theme');
      setTvTheme(attr === 'light' ? 'light' : 'dark');
    };
    detect();
    const obs = new MutationObserver(detect);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    return () => obs.disconnect();
  }, []);

  const RANGES: { key: RangeKey; label: string }[] = [
    { key: '1D', label: '1 Day'   },
    { key: '7D', label: '7 Days'  },
    { key: '1M', label: '1 Month' },
  ];

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 14,
    }}>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: collapsed ? 'none' : '1px solid var(--border-light)',
        background: 'var(--surface)', flexWrap: 'wrap', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#e74c3c',
            boxShadow: '0 0 8px rgba(231,76,60,0.5)', display: 'inline-block' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-primary)' }}>
            Oil Price History
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
            // WTI · Brent · Nat Gas · USO
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                padding: '3px 10px', border: '1px solid var(--border-light)',
                background: range === r.key ? 'var(--accent)' : 'var(--bg)',
                color:      range === r.key ? '#fff' : 'var(--text-muted)',
                borderRadius: 3, cursor: 'pointer', letterSpacing: '0.08em',
                textTransform: 'uppercase', fontWeight: range === r.key ? 700 : 400,
              }}>
              {r.label}
            </button>
          ))}
          <button onClick={() => setCollapsed(c => !c)}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 8px',
              background: 'var(--bg)', color: 'var(--text-muted)',
              border: '1px solid var(--border-light)', borderRadius: 3, cursor: 'pointer' }}>
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* ── Grid of 4 charts ──────────────────────────────── */}
      {!collapsed && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 10,
          padding: 12,
          background: 'var(--bg)',
        }}>
          {SYMBOLS.map(s => (
            // key includes range + theme so widget re-mounts on toggle
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
      )}

      {!collapsed && (
        <div style={{ padding: '6px 14px 8px', borderTop: '1px solid var(--border-light)',
          fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Data via TradingView · WTI (CL1!) · Brent (B1!) · Nat Gas (NG1!) · USO</span>
          <a href="https://www.tradingview.com" target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--text-muted)', textDecoration: 'none', opacity: 0.6 }}>
            Powered by TradingView ↗
          </a>
        </div>
      )}
    </div>
  );
}
