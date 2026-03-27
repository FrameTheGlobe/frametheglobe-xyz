'use client';

/**
 * TickerAnalysisDrawer
 *
 * A right-side slide-in panel triggered when an analyst clicks any price cell.
 * Fires /api/analyze-ticker, shows a loading shimmer, then renders the
 * Groq AI (or algorithmic fallback) analysis text.
 */

import { useEffect, useState, useRef } from 'react';
import type { TickerDrawerData } from '@/app/contexts/AIAnalysisContext';
import type { TickerAnalysisResult } from '@/app/api/analyze-ticker/route';

const mono = 'var(--font-mono)';

const CATEGORY_COLOR: Record<string, string> = {
  oil:         'var(--accent)',
  metals:      '#d4af37',
  commodities: '#f39c12',
};

interface Props {
  data:    TickerDrawerData | null;
  onClose: () => void;
}

export default function TickerAnalysisDrawer({ data, onClose }: Props) {
  const [result,  setResult]  = useState<TickerAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const prevSymbolRef         = useRef<string | null>(null);

  // Reset state when drawer closes
  useEffect(() => {
    if (!data) {
      prevSymbolRef.current = null;
    }
  }, [data]);

  // Fetch analysis whenever the data changes to a new ticker
  useEffect(() => {
    if (!data) return;

    const key = `${data.symbol}:${Math.round(data.price)}`;
    if (prevSymbolRef.current === key) return;
    prevSymbolRef.current = key;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setResult(null);
    setError(null);

    const controller = new AbortController();
    fetch('/api/analyze-ticker', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      signal:  controller.signal,
      body: JSON.stringify({
        symbol:        data.symbol,
        name:          data.name,
        price:         data.price,
        change:        data.change,
        changePercent: data.changePercent,
        currency:      data.currency,
        unit:          data.unit,
        category:      data.category,
      }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then((r: TickerAnalysisResult) => { setResult(r); })
      .catch(e => { if (e?.name !== 'AbortError') setError('Analysis unavailable — try again.'); })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [data]);

  const isOpen = !!data;
  const accent = data ? (CATEGORY_COLOR[data.category] ?? 'var(--accent)') : 'var(--accent)';
  const fmtChg = data
    ? `${data.change >= 0 ? '+' : ''}${data.change.toFixed(2)} (${data.changePercent >= 0 ? '+' : ''}${data.changePercent.toFixed(2)}%)`
    : '';
  const chgColor = data ? (data.change >= 0 ? '#27ae60' : '#c0392b') : 'inherit';

  return (
    <>
      {/* ── Backdrop ────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position:   'fixed',
            inset:      0,
            zIndex:     1099,
            background: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ── Drawer panel ────────────────────────────────────────────────── */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Ticker AI Analysis"
        style={{
          position:   'fixed',
          top:        0,
          right:      0,
          bottom:     0,
          width:      360,
          maxWidth:   '92vw',
          zIndex:     1100,
          background: 'var(--surface)',
          borderLeft: `1px solid var(--border)`,
          borderTop:  `3px solid ${accent}`,
          boxShadow:  '-8px 0 32px rgba(0,0,0,0.18)',
          display:    'flex',
          flexDirection: 'column',
          transform:  isOpen ? 'translateX(0)' : 'translateX(105%)',
          transition: 'transform 0.28s cubic-bezier(0.16,1,0.3,1)',
          overflow:   'hidden',
        }}
      >
        {/* ── Drawer header ─────────────────────────────────────────────── */}
        <div style={{
          padding:        '14px 18px 12px',
          borderBottom:   '1px solid var(--widget-hd-border)',
          background:     'var(--widget-hd-bg)',
          display:        'flex',
          flexDirection:  'column',
          gap:            6,
          flexShrink:     0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily:    mono,
                fontSize:      9,
                fontWeight:    700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color:         accent,
                border:        `1px solid ${accent}40`,
                background:    `${accent}12`,
                padding:       '2px 7px',
                borderRadius:  2,
              }}>
                AI ANALYSIS
              </span>
              <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
                GROQ · IRAN CONFLICT LENS
              </span>
            </div>
            <button
              onClick={onClose}
              aria-label="Close analysis panel"
              style={{
                fontFamily:    mono,
                fontSize:      14,
                background:    'transparent',
                border:        'none',
                cursor:        'pointer',
                color:         'var(--text-muted)',
                padding:       '6px 10px',
                lineHeight:    1,
                minHeight:     44,
                minWidth:      44,
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                touchAction:   'manipulation',
              }}
            >
              ✕
            </button>
          </div>

          {data && (
            <div>
              <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                {data.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
                <span style={{ fontFamily: mono, fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {data.currency}{data.price.toFixed(2)}
                  {data.unit && (
                    <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{data.unit}</span>
                  )}
                </span>
                <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: chgColor }}>
                  {data.change >= 0 ? '▲' : '▼'} {fmtChg}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── Analysis body ─────────────────────────────────────────────── */}
        <div style={{
          flex:       1,
          overflowY:  'auto',
          padding:    '20px 18px',
          display:    'flex',
          flexDirection: 'column',
          gap:        16,
        }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent,
                  animation: 'pulse 1.2s ease-in-out infinite', display: 'inline-block' }} />
                <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  ANALYSING WITH GROQ AI…
                </span>
              </div>
              {[90, 75, 85, 60].map((w, i) => (
                <div key={i} className="skeleton" style={{ height: 12, borderRadius: 3, width: `${w}%` }} />
              ))}
            </div>
          )}

          {!loading && error && (
            <div style={{
              fontFamily: mono, fontSize: 11, color: '#c0392b',
              border: '1px solid rgba(192,57,43,0.25)', borderRadius: 4,
              padding: '10px 12px', background: 'rgba(192,57,43,0.05)',
            }}>
              {error}
            </div>
          )}

          {!loading && result && (
            <>
              <p style={{
                fontFamily:  'var(--font-body)',
                fontSize:    14,
                lineHeight:  1.75,
                color:       'var(--text-primary)',
                margin:      0,
              }}>
                {result.analysis}
              </p>

              {/* Divider */}
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontFamily:    mono,
                    fontSize:      9,
                    fontWeight:    700,
                    letterSpacing: '0.1em',
                    color:         result.source === 'groq-ai' ? '#22c55e' : '#f59e0b',
                    background:    result.source === 'groq-ai' ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)',
                    border:        `1px solid ${result.source === 'groq-ai' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    padding:       '2px 8px',
                    borderRadius:  2,
                  }}>
                    {result.source === 'groq-ai' ? '🤖 GROQ AI' : '🔢 ALGORITHMIC'}
                  </span>
                  <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-muted)' }}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </>
          )}

          {!loading && !result && !error && (
            <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
              Click any price cell to load analysis
            </div>
          )}
        </div>

        {/* ── Footer tip ────────────────────────────────────────────────── */}
        <div style={{
          padding:      '10px 18px',
          borderTop:    '1px solid var(--border-light)',
          background:   'var(--bg)',
          flexShrink:   0,
        }}>
          <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            ANALYSIS REFRESHES EVERY 5 MIN · IRAN CONFLICT INTELLIGENCE PLATFORM
          </div>
        </div>
      </aside>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </>
  );
}
