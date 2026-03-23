'use client';

import { useEffect, useState, useCallback } from 'react';
import type {
  AIIntelPayload,
  Theater,
  CountryInstability,
  Forecast,
  Insight,
  ThreatLevel,
} from '@/app/api/ai-intel/route';

// ── Colour maps ────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<ThreatLevel, string> = {
  CRIT: '#e74c3c',
  ELEV: '#e67e22',
  HIGH: '#f1c40f',
  NORM: '#2ecc71',
  UNKN: '#7f8c8d',
};

const LEVEL_BG: Record<ThreatLevel, string> = {
  CRIT: 'rgba(231,76,60,0.12)',
  ELEV: 'rgba(230,126,34,0.12)',
  HIGH: 'rgba(241,196,15,0.10)',
  NORM: 'rgba(46,204,113,0.10)',
  UNKN: 'rgba(127,140,141,0.10)',
};

const CATEGORY_COLOR: Record<string, string> = {
  Conflict:       '#e74c3c',
  Military:       '#c0392b',
  Market:         '#f39c12',
  'Supply Chain': '#e67e22',
  Political:      '#9b59b6',
  Cyber:          '#3498db',
  Infra:          '#1abc9c',
};

const RISK_COLOR: Record<string, string> = {
  CRITICAL: '#e74c3c',
  ELEVATED: '#e67e22',
  MODERATE: '#f1c40f',
  LOW:      '#2ecc71',
};

type ForecastCategory = Forecast['category'] | 'All';

// ── Sub-components ─────────────────────────────────────────────────────────

/** Circular gauge for the Strategic Risk score */
function RiskGauge({ score, label, trend, delta }: {
  score: number;
  label: string;
  trend: string;
  delta: number;
}) {
  const R = 52;
  const circumference = 2 * Math.PI * R;
  const filled = circumference * (score / 100);
  const color = RISK_COLOR[label] ?? '#e67e22';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: '18px 24px',
      background: 'var(--bg)',
      border: '1px solid var(--border-light)',
      borderRadius: 4,
    }}>
      {/* SVG ring */}
      <div style={{ position: 'relative', width: 130, height: 130 }}>
        <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle cx="65" cy="65" r={R} fill="none" stroke="var(--border)" strokeWidth="10" />
          {/* Score arc */}
          <circle
            cx="65" cy="65" r={R}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        {/* Centre label */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
        }}>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 32,
            fontWeight: 700,
            color,
            lineHeight: 1,
          }}>{score}</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginTop: 2,
          }}>/100</span>
        </div>
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 700,
          color,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>{label}</div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-muted)',
          marginTop: 3,
        }}>
          Trend: {trend} {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : '→'}
        </div>
      </div>
    </div>
  );
}

/** Single theater card */
function TheaterCard({ theater }: { theater: Theater }) {
  const color = LEVEL_COLOR[theater.level];
  const bg    = LEVEL_BG[theater.level];
  return (
    <div style={{
      background: bg,
      border: `1px solid ${color}40`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 3,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-primary)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          {theater.name}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          color,
          background: `${color}20`,
          border: `1px solid ${color}50`,
          padding: '2px 7px',
          borderRadius: 2,
          letterSpacing: '0.1em',
        }}>
          {theater.level}
        </span>
      </div>

      {/* Summary */}
      <div style={{
        fontFamily: 'var(--font-body)',
        fontSize: 11,
        color: 'var(--text-muted)',
        lineHeight: 1.4,
      }}>
        {theater.summary}
      </div>

      {/* Asset counts */}
      <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
        {[
          { label: 'AIR',   val: theater.airOps },
          { label: 'GND',   val: theater.groundAssets },
          { label: 'NAVAL', val: theater.navalAssets },
          { label: 'EVENTS',val: theater.recentEvents },
        ].map(({ label, val }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color }}>
              {val}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
              {label}
            </span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
          {theater.trend === 'escalating' ? '▲ ESCALATING' : theater.trend === 'de-escalating' ? '▼ DE-ESC' : '→ STABLE'}
        </div>
      </div>
    </div>
  );
}

/** Country instability row */
function InstabilityRow({ c, max }: { c: CountryInstability; max: number }) {
  const pct = Math.round((c.score / max) * 100);
  const color = c.score >= 75 ? '#e74c3c' : c.score >= 50 ? '#e67e22' : c.score >= 30 ? '#f1c40f' : '#2ecc71';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Flag + country */}
        <span style={{ fontSize: 16, lineHeight: 1 }}>{c.flag}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, minWidth: 90 }}>
          {c.country}
        </span>
        {/* Sub-scores */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[
            { key: 'U', val: c.unrest,      title: 'Unrest' },
            { key: 'C', val: c.conflict,    title: 'Conflict' },
            { key: 'S', val: c.sanctions,   title: 'Sanctions' },
            { key: 'I', val: c.infoWarfare, title: 'Info Warfare' },
          ].map(({ key, val, title }) => (
            <span key={key} title={`${title}: ${val}`} style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: val >= 60 ? '#e74c3c' : val >= 35 ? '#e67e22' : 'var(--text-muted)',
              background: val >= 60 ? 'rgba(231,76,60,0.1)' : 'var(--bg)',
              border: `1px solid ${val >= 60 ? 'rgba(231,76,60,0.3)' : 'var(--border-light)'}`,
              borderRadius: 2,
              padding: '1px 5px',
              cursor: 'default',
            }}>
              {key}:{val}
            </span>
          ))}
        </div>
        {/* Score + trend */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color }}>
            {c.score}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: c.trend === 'up' ? '#e74c3c' : c.trend === 'down' ? '#2ecc71' : 'var(--text-muted)' }}>
            {c.trend === 'up' ? `▲+${Math.abs(c.delta)}` : c.trend === 'down' ? `▼${c.delta}` : '→'}
          </span>
        </div>
      </div>
      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 2,
          boxShadow: c.score >= 75 ? `0 0 6px ${color}80` : 'none',
          transition: 'width 0.6s ease',
        }} />
      </div>
    </div>
  );
}

/** Single forecast card */
function ForecastCard({ f }: { f: Forecast }) {
  const color = CATEGORY_COLOR[f.category] ?? 'var(--accent)';
  const confColor = f.confidence === 'High' ? '#2ecc71' : f.confidence === 'Medium' ? '#f39c12' : '#7f8c8d';

  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border-light)',
      borderLeft: `3px solid ${color}`,
      borderRadius: 3,
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      {/* Category + horizon badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          fontWeight: 700,
          color,
          background: `${color}18`,
          border: `1px solid ${color}40`,
          padding: '2px 6px',
          borderRadius: 2,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          {f.category}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-muted)',
          background: 'var(--surface)',
          border: '1px solid var(--border-light)',
          padding: '2px 6px',
          borderRadius: 2,
          letterSpacing: '0.06em',
        }}>
          {f.horizon}
        </span>
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 9, color: confColor, letterSpacing: '0.06em' }}>
          {f.confidence} confidence
        </span>
      </div>

      {/* Title */}
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.4 }}>
        {f.title}
      </div>

      {/* Probability bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, height: 5, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${f.probability}%`,
            background: color,
            borderRadius: 2,
            transition: 'width 0.6s ease',
          }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color, minWidth: 36, textAlign: 'right' }}>
          {f.probability}%
        </span>
      </div>

      {/* Basis */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4 }}>
        {f.basis}
      </div>
    </div>
  );
}

/** World Brief / Focal Point insight cards */
function InsightCard({ insight }: { insight: Insight }) {
  const isBrief = insight.type === 'brief';
  return (
    <div style={{
      background: 'var(--bg)',
      border: '1px solid var(--border-light)',
      borderLeft: `3px solid ${isBrief ? 'var(--brand-blue, #3498db)' : 'var(--accent)'}`,
      borderRadius: 3,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 7,
      flex: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          fontWeight: 700,
          color: isBrief ? 'var(--brand-blue, #3498db)' : 'var(--accent)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          {insight.headline}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>
          {insight.sources} src
        </span>
      </div>
      <p style={{
        fontFamily: 'var(--font-body)',
        fontSize: 13,
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        margin: 0,
      }}>
        {insight.body}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AIIntelPanel() {
  const [data, setData]       = useState<AIIntelPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [activeCat, setActiveCat] = useState<ForecastCategory>('All');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai-intel${force ? '?refresh=1' : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const payload: AIIntelPayload = await res.json();
      setData(payload);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const id = setInterval(() => load(), 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const forecasts = data?.forecasts ?? [];
  const filteredForecasts = activeCat === 'All'
    ? forecasts
    : forecasts.filter(f => f.category === activeCat);

  const allCategories: ForecastCategory[] = [
    'All', 'Conflict', 'Military', 'Market', 'Supply Chain', 'Political', 'Cyber', 'Infra',
  ];
  const availCats = new Set(forecasts.map(f => f.category));

  return (
    <section style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 14,
    }}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: collapsed ? 'none' : '1px solid var(--border-light)',
        background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-block',
            width: 7, height: 7,
            borderRadius: '50%',
            background: data ? '#2ecc71' : '#e74c3c',
            boxShadow: `0 0 8px ${data ? '#2ecc71' : '#e74c3c'}`,
            animation: loading ? 'pulse 1.2s infinite' : 'none',
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            fontWeight: 700,
          }}>
            AI Intelligence
          </span>
          {data && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              // {data.totalStoriesAnalysed} stories · {lastRefresh?.toLocaleTimeString() ?? '—'}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => load(true)}
            disabled={loading}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '3px 8px',
              background: 'var(--bg)',
              color: loading ? 'var(--text-muted)' : 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: 3,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.06em',
            }}
          >
            {loading ? '⟳ Analysing…' : '⟳ Refresh'}
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              padding: '3px 8px',
              background: 'var(--bg)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-light)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Loading / error states */}
          {loading && !data && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '32px 0',
              letterSpacing: '0.08em',
            }}>
              ⟳ ANALYSING FEED — SYNTHESISING INTELLIGENCE…
            </div>
          )}
          {error && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: '#e74c3c',
              background: 'rgba(231,76,60,0.08)',
              border: '1px solid rgba(231,76,60,0.3)',
              borderRadius: 3,
              padding: '10px 14px',
            }}>
              INTEL ERROR: {error}
            </div>
          )}

          {data && (
            <>
              {/* ── Row 1: Strategic Risk + AI Insights ────────────── */}
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                {/* Gauge */}
                <RiskGauge
                  score={data.strategicRisk.score}
                  label={data.strategicRisk.label}
                  trend={data.strategicRisk.trend}
                  delta={data.strategicRisk.deltaPoints}
                />

                {/* Insights */}
                <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.insights.map(ins => (
                    <InsightCard key={ins.headline} insight={ins} />
                  ))}
                </div>
              </div>

              {/* ── Row 2: Theaters ─────────────────────────────────── */}
              <div>
                <SectionLabel>AI STRATEGIC POSTURE</SectionLabel>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: 10,
                  marginTop: 8,
                }}>
                  {data.theaters.map(t => (
                    <TheaterCard key={t.id} theater={t} />
                  ))}
                </div>
              </div>

              {/* ── Row 3: Country instability ──────────────────────── */}
              {data.instability.length > 0 && (
                <div>
                  <SectionLabel>COUNTRY INSTABILITY INDEX</SectionLabel>
                  <div style={{ marginTop: 8 }}>
                    {data.instability.map(c => (
                      <InstabilityRow
                        key={c.country}
                        c={c}
                        max={data.instability[0].score}
                      />
                    ))}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)', marginTop: 6, letterSpacing: '0.06em' }}>
                    U=Unrest · C=Conflict · S=Sanctions · I=Info Warfare · Score synthesised from live feed analysis
                  </div>
                </div>
              )}

              {/* ── Row 4: Forecasts ────────────────────────────────── */}
              {forecasts.length > 0 && (
                <div>
                  <SectionLabel>AI FORECASTS</SectionLabel>
                  {/* Category filter tabs */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8, marginBottom: 10 }}>
                    {allCategories.map(cat => {
                      const active = activeCat === cat;
                      const hasItems = cat === 'All' || availCats.has(cat as Forecast['category']);
                      return (
                        <button
                          key={cat}
                          onClick={() => setActiveCat(cat)}
                          disabled={!hasItems}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            padding: '3px 9px',
                            background: active ? (CATEGORY_COLOR[cat] ?? 'var(--accent)') : 'var(--bg)',
                            color: active ? '#fff' : hasItems ? 'var(--text-muted)' : 'var(--border)',
                            border: `1px solid ${active ? (CATEGORY_COLOR[cat] ?? 'var(--accent)') : 'var(--border-light)'}`,
                            borderRadius: 3,
                            cursor: hasItems ? 'pointer' : 'default',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            opacity: hasItems ? 1 : 0.4,
                          }}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                  {/* Forecast cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {filteredForecasts.length === 0 ? (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', padding: '12px 0' }}>
                        No forecasts in this category for the current cycle.
                      </div>
                    ) : (
                      filteredForecasts.map(f => <ForecastCard key={f.id} f={f} />)
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ── Micro helpers ──────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      borderBottom: '1px solid var(--border-light)',
      paddingBottom: 5,
    }}>
      {children}
    </div>
  );
}
