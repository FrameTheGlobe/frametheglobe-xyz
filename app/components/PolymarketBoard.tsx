'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PolymarketEntry } from '@/app/api/polymarket/route';

const CAT_COLOR: Record<string, string> = {
  REGIME:   '#e74c3c',
  CONFLICT: '#e67e22',
  NUCLEAR:  '#9b59b6',
};

const CAT_ICON: Record<string, string> = {
  REGIME:   '🏛',
  CONFLICT: '✈',
  NUCLEAR:  '☢',
};

function riskLabel(pct: number) {
  if (pct >= 60) return { label: 'CRIT',  color: '#e74c3c' };
  if (pct >= 30) return { label: 'HIGH',  color: '#e67e22' };
  if (pct >= 10) return { label: 'MOD',   color: '#f1c40f' };
  return               { label: 'LOW',   color: '#2ecc71' };
}

function MarketRow({ m }: { m: PolymarketEntry }) {
  const pct   = Math.round(m.yesPrice * 100);
  const color = CAT_COLOR[m.category] ?? '#3498db';
  const risk  = riskLabel(pct);

  return (
    <a
      href={m.url}
      target="_blank"
      rel="noopener noreferrer"
      title={m.label}
      style={{
        display:        'block',
        textDecoration: 'none',
        padding:        '7px 10px',
        borderLeft:     `2px solid ${color}`,
        background:     'var(--surface)',
        borderRadius:   '0 3px 3px 0',
        marginBottom:   4,
        transition:     'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
    >
      {/* Label row */}
      <div style={{
        display:        'flex',
        alignItems:     'flex-start',
        justifyContent: 'space-between',
        gap:            6,
        marginBottom:   5,
      }}>
        <span style={{
          fontSize:   10,
          color:      'var(--text-primary)',
          lineHeight: 1.35,
          fontFamily: 'var(--font-body)',
          fontWeight: 500,
          flex:       1,
          minWidth:   0,
        }}>
          {m.label}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize:   13,
            fontWeight: 700,
            color,
            letterSpacing: '-0.01em',
          }}>
            {pct}%
          </span>
          <span style={{
            fontFamily:  'var(--font-mono)',
            fontSize:    7,
            color:       risk.color,
            border:      `1px solid ${risk.color}`,
            borderRadius: 2,
            padding:     '0px 3px',
            letterSpacing: '0.05em',
          }}>
            {risk.label}
          </span>
        </div>
      </div>

      {/* Thin probability bar */}
      <div style={{
        height:       3,
        background:   'var(--border-light)',
        borderRadius: 2,
        overflow:     'hidden',
      }}>
        <div style={{
          width:        `${pct}%`,
          height:       '100%',
          background:   color,
          borderRadius: 2,
          transition:   'width 0.5s ease',
          boxShadow:    pct > 20 ? `0 0 4px ${color}60` : 'none',
        }} />
      </div>

      {/* Volume footer */}
      <div style={{
        marginTop:  4,
        fontSize:   8,
        color:      'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        opacity:    0.7,
      }}>
        vol {m.volume >= 1_000_000
          ? `$${(m.volume / 1_000_000).toFixed(1)}M`
          : m.volume >= 1_000
            ? `$${(m.volume / 1_000).toFixed(0)}K`
            : `$${m.volume.toFixed(0)}`}
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

  const byCategory = data.reduce<Record<string, PolymarketEntry[]>>((acc, m) => {
    (acc[m.category] ??= []).push(m);
    return acc;
  }, {});

  const categoryOrder = (['NUCLEAR', 'REGIME', 'CONFLICT'] as const).filter(c => byCategory[c]?.length);

  return (
    <div style={{
      border:       '1px solid var(--border-light)',
      borderTop:    '2px solid #9b59b6',
      borderRadius: '0 0 5px 5px',
      background:   'var(--bg)',
      fontFamily:   'var(--font-mono)',
      overflow:     'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width:          '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '8px 10px',
          background:     'none',
          border:         'none',
          cursor:         'pointer',
          borderBottom:   collapsed ? 'none' : '1px solid var(--border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width:     6, height: 6, borderRadius: '50%',
            background: '#9b59b6',
            boxShadow:  '0 0 5px #9b59b6',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.1em', fontWeight: 700 }}>
            PRED·MARKETS
          </span>
          <span style={{
            fontSize:     8,
            color:        '#9b59b6',
            border:       '1px solid #9b59b6',
            borderRadius: 2,
            padding:      '0 4px',
            letterSpacing: '0.06em',
          }}>
            PM
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {updatedAt && (
            <span style={{ fontSize: 7, color: 'var(--text-muted)', opacity: 0.7 }}>
              {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
            {collapsed ? '▼' : '▲'}
          </span>
        </div>
      </button>

      {!collapsed && (
        <div style={{ padding: '8px 8px 10px' }}>

          {/* Loading state */}
          {loading && (
            <div style={{
              padding:    '12px 0',
              textAlign:  'center',
              fontSize:   9,
              color:      'var(--text-muted)',
              letterSpacing: '0.08em',
            }}>
              FETCHING MARKETS…
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div style={{
              padding:    '10px 8px',
              fontSize:   9,
              color:      'var(--text-muted)',
              lineHeight: 1.5,
              letterSpacing: '0.06em',
              textAlign:  'center',
            }}>
              <div style={{ marginBottom: 6, opacity: 0.7 }}>NO LIVE MARKETS</div>
              <button
                onClick={load}
                style={{
                  fontSize:     8,
                  color:        '#9b59b6',
                  border:       '1px solid #9b59b6',
                  borderRadius: 3,
                  padding:      '2px 8px',
                  background:   'none',
                  cursor:       'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                RETRY
              </button>
            </div>
          )}

          {/* Markets grouped by category */}
          {!loading && !error && categoryOrder.map(cat => (
            <div key={cat} style={{ marginBottom: 10 }}>
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          5,
                marginBottom: 5,
                paddingBottom: 3,
                borderBottom: `1px solid ${CAT_COLOR[cat]}25`,
              }}>
                <span style={{ fontSize: 9 }}>{CAT_ICON[cat]}</span>
                <span style={{
                  fontSize:      8,
                  color:         CAT_COLOR[cat],
                  letterSpacing: '0.1em',
                  fontWeight:    700,
                }}>
                  {cat}
                </span>
                <span style={{ fontSize: 7, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                  {byCategory[cat].length}
                </span>
              </div>
              {byCategory[cat].map(m => <MarketRow key={m.conditionId} m={m} />)}
            </div>
          ))}

          {/* Attribution */}
          {!loading && !error && data.length > 0 && (
            <div style={{
              fontSize:   7,
              color:      'var(--text-muted)',
              opacity:    0.5,
              paddingTop: 4,
              borderTop:  '1px solid var(--border-light)',
              letterSpacing: '0.04em',
            }}>
              via Polymarket · ~5 min · not financial advice
            </div>
          )}
        </div>
      )}
    </div>
  );
}
