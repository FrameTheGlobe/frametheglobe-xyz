'use client';

/**
 * AnalystBriefingModal
 *
 * A full-screen overlay that synthesises all live widget data into a
 * structured 4-section analyst brief via /api/analyst-briefing (Groq AI).
 *
 * On open, it:
 *  1. Fetches /api/market, /api/precious-metals, /api/polymarket in parallel
 *  2. Formats the results into text summaries
 *  3. Calls /api/analyst-briefing with the summaries
 *  4. Renders a structured briefing with Market Summary, Conflict Alignment,
 *     Risk Assessment, and 3 Watchpoints
 */

import { useState, useEffect, useCallback } from 'react';
import type { BriefingResult } from '@/app/api/analyst-briefing/route';
import type { PolymarketEntry } from '@/app/api/polymarket/route';

const mono = 'var(--font-mono)';

// ── Risk label colors ─────────────────────────────────────────────────────────

const RISK_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  ELEVATED: '#f97316',
  MODERATE: '#eab308',
  LOW:      '#22c55e',
};

// ── Helpers to build summary strings from raw API data ────────────────────────

type Quote = { symbol: string; name: string; price: number; change: number; changePercent: number; currency: string };
type MetalQuote = { symbol: string; name: string; price: number; change: number; changePercent: number; unit: string };

function fmt(n: number, d = 2) { return n.toFixed(d); }
function sign(n: number) { return n >= 0 ? '+' : ''; }

function buildOilSummary(quotes: Quote[]): string {
  if (!quotes.length) return 'Oil market data unavailable.';
  const lines = quotes.map(q =>
    `${q.name}: $${fmt(q.price)} (${sign(q.change)}${fmt(q.change)}, ${sign(q.changePercent)}${fmt(q.changePercent)}%)`
  );
  return lines.join(' | ');
}

function buildMetalsSummary(metals: MetalQuote[]): string {
  if (!metals.length) return 'Metals data unavailable.';
  return metals.slice(0, 4).map(m =>
    `${m.name}: $${m.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${sign(m.change)}${fmt(m.change)})`
  ).join(' | ');
}

function buildPolymarketSummary(entries: PolymarketEntry[]): string {
  if (!entries.length) return 'Prediction market data unavailable.';
  return entries.slice(0, 6).map(e => {
    const topOutcome = e.outcomes[0];
    if (e.isBinary && topOutcome) {
      return `${e.eventTitle}: ${Math.round(topOutcome.yesPrice * 100)}% YES ($${(e.volume / 1e6).toFixed(1)}M vol)`;
    }
    const outcomes = e.outcomes.slice(0, 2).map(o => `${o.label}: ${Math.round(o.yesPrice * 100)}%`).join(', ');
    return `${e.eventTitle}: [${outcomes}]`;
  }).join(' | ');
}

// ── Section Card component ────────────────────────────────────────────────────

function SectionCard({
  label,
  icon,
  children,
  accent,
}: {
  label: string;
  icon: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <div style={{
      border:       `1px solid var(--border)`,
      borderTop:    `2px solid ${accent ?? 'var(--accent)'}`,
      borderRadius: '0 0 6px 6px',
      background:   'var(--surface)',
      overflow:     'hidden',
    }}>
      <div className="widget-hd" style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={{ fontFamily: mono, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: accent ?? 'var(--accent)' }}>
          {label}
        </span>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {children}
      </div>
    </div>
  );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonLines({ n = 3 }: { n?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 12, borderRadius: 3, width: `${85 - i * 10}%` }} />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  isOpen:  boolean;
  onClose: () => void;
}

export default function AnalystBriefingModal({ isOpen, onClose }: Props) {
  const [brief,    setBrief]    = useState<BriefingResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setBrief(null);
    setError(null);

    try {
      // Step 1: Fetch all live data in parallel
      const [marketRes, metalsRes, polyRes] = await Promise.allSettled([
        fetch('/api/market').then(r => r.ok ? r.json() : []),
        fetch('/api/precious-metals').then(r => r.ok ? r.json() : []),
        fetch('/api/polymarket').then(r => r.ok ? r.json() : []),
      ]);

      const oilQuotes:   Quote[]          = marketRes.status  === 'fulfilled' ? marketRes.value  : [];
      const metalQuotes: MetalQuote[]     = metalsRes.status  === 'fulfilled' ? metalsRes.value  : [];
      const polyMarkets: PolymarketEntry[] = polyRes.status   === 'fulfilled' ? polyRes.value    : [];

      // Step 2: Build summary strings
      const oilSummary        = buildOilSummary(oilQuotes);
      const metalsSummary     = buildMetalsSummary(metalQuotes);
      const polymarketSummary = buildPolymarketSummary(polyMarkets);

      // Step 3: Call briefing API
      const res = await fetch('/api/analyst-briefing', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oilSummary, metalsSummary, polymarketSummary }),
      });
      if (!res.ok) throw new Error(`Briefing API returned ${res.status}`);
      const data: BriefingResult = await res.json();
      setBrief(data);
      setFetchedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Briefing generation failed. Please retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-generate when modal opens
  useEffect(() => {
    if (isOpen && !brief && !loading) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const riskColor = brief ? (RISK_COLOR[brief.riskLabel] ?? '#f97316') : 'var(--accent)';

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        style={{
          position:       'fixed',
          inset:          0,
          zIndex:         1099,
          background:     'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* ── Modal panel ───────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Analyst Briefing"
        style={{
          position:      'fixed',
          top:           '50%',
          left:          '50%',
          transform:     'translate(-50%, -50%)',
          zIndex:        1100,
          width:         '92vw',
          maxWidth:      740,
          maxHeight:     '88vh',
          display:       'flex',
          flexDirection: 'column',
          background:    'var(--bg)',
          border:        '1px solid var(--border)',
          borderTop:     `3px solid ${riskColor}`,
          borderRadius:  '0 0 8px 8px',
          boxShadow:     '0 24px 80px rgba(0,0,0,0.35)',
          overflow:      'hidden',
        }}
      >
        {/* ── Modal header ─────────────────────────────────────────────── */}
        <div className="widget-hd" style={{
          padding:       '14px 20px 12px',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'space-between',
          flexShrink:    0,
          gap:           12,
          flexWrap:      'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 900, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'var(--accent)' }}>
              Analyst Briefing
            </span>
            <span style={{ fontFamily: mono, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              color: '#9b59b6', border: '1px solid rgba(155,89,182,0.4)', background: 'rgba(155,89,182,0.08)',
              padding: '2px 7px', borderRadius: 2 }}>
              GROQ AI
            </span>
            {brief && (
              <span style={{
                fontFamily:  mono, fontSize: 9, letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color:       riskColor,
                border:      `1px solid ${riskColor}40`,
                background:  `${riskColor}12`,
                padding:     '2px 8px',
                borderRadius: 2,
                fontWeight:  700,
              }}>
                ◉ {brief.riskLabel} · {brief.riskScore}/100
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {fetchedAt && (
              <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-muted)' }}>
                {fetchedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={generate}
              disabled={loading}
              style={{
                fontFamily:    mono,
                fontSize:      9,
                fontWeight:    700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                padding:       '4px 10px',
                border:        '1px solid var(--border)',
                borderRadius:  3,
                background:    'transparent',
                color:         'var(--text-secondary)',
                cursor:        loading ? 'not-allowed' : 'pointer',
                opacity:       loading ? 0.5 : 1,
              }}
            >
              ↻ Regenerate
            </button>
            <button
              onClick={onClose}
              aria-label="Close briefing"
              style={{
                fontFamily: mono, fontSize: 15, background: 'transparent',
                border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                padding: '0 4px', lineHeight: 1,
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Modal body ───────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Loading state */}
          {loading && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <span className="live-dot" style={{ background: '#9b59b6' }} />
                <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  FETCHING LIVE MARKET DATA &amp; GENERATING BRIEFING…
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    <div className="widget-hd" style={{ padding: '10px 16px', height: 38 }}>
                      <div className="skeleton" style={{ height: 10, width: '60%', borderRadius: 2 }} />
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      <SkeletonLines n={3} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Error state */}
          {!loading && error && (
            <div style={{
              fontFamily: mono, fontSize: 11, color: '#c0392b',
              border: '1px solid rgba(192,57,43,0.25)', borderRadius: 4,
              padding: '14px 16px', background: 'rgba(192,57,43,0.05)',
            }}>
              {error}
              <button
                onClick={generate}
                style={{ marginLeft: 12, fontFamily: mono, fontSize: 10, color: '#c0392b',
                  textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Retry
              </button>
            </div>
          )}

          {/* Brief content */}
          {!loading && brief && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* Market Summary */}
              <SectionCard label="Market Signal Summary" icon="📊" accent="var(--accent)">
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.7,
                  color: 'var(--text-primary)', margin: 0 }}>
                  {brief.marketSummary}
                </p>
              </SectionCard>

              {/* Conflict Alignment */}
              <SectionCard label="Conflict Alignment" icon="⚖" accent="#9b59b6">
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.7,
                  color: 'var(--text-primary)', margin: 0 }}>
                  {brief.conflictAlignment}
                </p>
              </SectionCard>

              {/* Risk Assessment */}
              <SectionCard label="Risk Assessment" icon="◉" accent={riskColor}>
                <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.7,
                  color: 'var(--text-primary)', margin: 0 }}>
                  {brief.riskAssessment}
                </p>
              </SectionCard>

              {/* Watchpoints */}
              <SectionCard label="Key Watchpoints (24-48h)" icon="🔭" accent="#f39c12">
                <ol style={{ margin: 0, padding: '0 0 0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {brief.watchpoints.map((wp, i) => (
                    <li key={i} style={{ fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.6,
                      color: 'var(--text-primary)' }}>
                      {wp}
                    </li>
                  ))}
                </ol>
              </SectionCard>

            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{
          padding:    '10px 20px',
          borderTop:  '1px solid var(--border-light)',
          background: 'var(--surface)',
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          flexWrap:   'wrap',
          gap:        8,
        }}>
          <span style={{ fontFamily: mono, fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            DATA: POLYMARKET · STOOQ · YAHOO FINANCE · GROQ AI (LLAMA-3.1)
          </span>
          {brief && (
            <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.08em',
              color: brief.generatedBy === 'groq-ai' ? '#22c55e' : '#f59e0b',
              fontWeight: 700 }}>
              {brief.generatedBy === 'groq-ai' ? '🤖 AI GENERATED' : '🔢 ALGORITHMIC FALLBACK'}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
