'use client';

/**
 * IranWarCostBoard — Live U.S. war cost counter for the Iran War Theater section.
 * ULTRA-DENSE VERSION 3.0 — Full simulation engine: ALL values derived from elapsed time.
 *
 * Nothing is hardcoded static data except the base rates and the event pool.
 * Every number (munitions, sorties, casualties, readiness) ticks forward from STRIKE_START.
 */

import { useState, useMemo, useCallback } from 'react';
import { useVisibilityPolling } from '@/lib/use-visibility-polling';

// ── Epoch & cost engine ───────────────────────────────────────────────────────
const STRIKE_START  = new Date('2026-02-28T00:00:00Z');
const BASE_COST_USD = 11_300_000_000;
const BASE_DAYS     = 6;
const DAILY_RATE    = 1_000_000_000;
const PER_SEC_RATE  = DAILY_RATE / 86_400;          // ~$11,574 / sec

// ── Historical event pool (timestamps as ms offsets from STRIKE_START) ────────
// Sorted newest-first; only the 4 most recently elapsed events are shown.
const EVENT_POOL: { offMs: number; e: string; c: string }[] = [
  { offMs: d(0,  2), e: 'Initial cruise-missile salvo — Bandar Abbas naval base', c: '$42.1M' },
  { offMs: d(0, 14), e: 'B-2 strike on Fordow enrichment facility', c: '$11.2M' },
  { offMs: d(1,  3), e: 'Carrier air wing surge — 48 combat sorties', c: '$6.8M' },
  { offMs: d(2,  9), e: 'Intercept of 12 Houthi anti-ship missiles', c: '$28.8M' },
  { offMs: d(3, 21), e: 'F-35C strikes on Bandar-e-Imam naval assets', c: '$8.4M' },
  { offMs: d(5,  6), e: 'SM-6 intercept — Iranian ballistic missile over Gulf', c: '$14.6M' },
  { offMs: d(6, 17), e: 'Hormuz interdiction — 3 IRGC fast-attack craft neutralised', c: '$3.1M' },
  { offMs: d(8,  4), e: 'Deployment of 12th Marine Expeditionary Unit', c: '$4.2M' },
  { offMs: d(9, 12), e: 'GBU-39 precision strike on Parchin weapons complex', c: '$9.7M' },
  { offMs: d(11, 1), e: 'Carrier air wing replenishment flight', c: '$1.8M' },
  { offMs: d(12, 8), e: 'Air superiority patrol — 18 F-35C sorties', c: '$5.3M' },
  { offMs: d(14, 3), e: 'SEAL Team 6 extraction op — Kish Island', c: '$2.9M' },
  { offMs: d(15,19), e: 'AGM-158 JASSM strikes on Isfahan radar network', c: '$19.2M' },
  { offMs: d(17,11), e: 'Joint SEAD mission — 8 SAM sites suppressed', c: '$31.5M' },
  { offMs: d(19, 5), e: 'Submarine-launched Tomahawk V — Natanz auxiliary tunnel', c: '$22.4M' },
  { offMs: d(21,14), e: 'AWACS-guided intercept — 4 IRGC drones over Strait', c: '$7.8M' },
  { offMs: d(23, 2), e: 'E-2D Hawkeye OPS — 6 sorties, Hormuz corridor cleared', c: '$4.1M' },
  { offMs: d(25,16), e: 'Strategic bomber run — 2× B-2 on Arak heavy-water reactor', c: '$17.6M' },
  { offMs: d(27, 8), e: 'SSN-class submarine repositioned — Gulf of Oman patrol', c: '$0.9M' },
  { offMs: d(29, 0), e: 'Joint strike on Parchin secondary weapons complex', c: '$13.3M' },
  { offMs: d(29,20), e: 'IRGC coastal battery neutralised — Qeshm Island', c: '$5.5M' },
  { offMs: d(30, 6), e: 'Carrier resupply complete — CSG-2 fully armed', c: '$2.1M' },
];
function d(days: number, hours: number) { return (days * 24 + hours) * 3_600_000; }

// ── Simulation engine ─────────────────────────────────────────────────────────

function elapsedDays(now: Date): number {
  return Math.max(0, (now.getTime() - STRIKE_START.getTime()) / 86_400_000);
}

// Slow oscillator — value drifts on a sine curve, period in hours
function osc(now: Date, periodHours: number, min: number, max: number): number {
  const t = now.getTime() / (periodHours * 3_600_000) * Math.PI * 2;
  return Math.round(min + (max - min) * (0.5 + 0.5 * Math.sin(t)));
}

function calcCost(now: Date): number {
  const ed = elapsedDays(now);
  return BASE_COST_USD + Math.max(0, ed - BASE_DAYS) * DAILY_RATE;
}

function calcCostLive(now: Date): number {
  // sub-second precision for the live counter
  const elapsedSec = Math.max(0, (now.getTime() - STRIKE_START.getTime()) / 1_000);
  const baseSec    = BASE_DAYS * 86_400;
  return BASE_COST_USD + Math.max(0, elapsedSec - baseSec) * PER_SEC_RATE;
}

function computeMunitions(days: number) {
  // Cumulative expended totals — grow every day
  const raw = [
    { n: 'TOMAHAWK V',    base: 95,  rate: 1.60, cap: 320 },
    { n: 'JDAM GBU-31',  base: 680, rate: 13.5,  cap: 2200 },
    { n: 'SM-6 BLOCK IA',base: 38,  rate: 0.53,  cap: 160 },
    { n: 'AGM-158 JASSM',base: 18,  rate: 0.33,  cap: 100 },
    { n: 'AIM-120D',     base: 24,  rate: 0.47,  cap: 140 },
    { n: 'GBU-39 SDB',   base: 320, rate: 3.07,  cap: 900 },
  ];
  return raw.map(m => {
    const qty = Math.min(m.cap, Math.floor(m.base + days * m.rate));
    const pct = Math.min(98, Math.round((qty / m.cap) * 100));
    return { n: m.n, q: qty.toLocaleString('en-US'), p: pct };
  });
}

function computeAirOps(days: number) {
  const raw = [
    { l: 'COMBAT',        base: 890,  rate: 17.4, c: 'var(--accent)' },
    { l: 'SUPPORT/TANKER',base: 1320, rate: 25.6, c: '#4a9eff' },
    { l: 'ISR/EW',        base: 540,  rate: 10.4, c: '#bdc3c7' },
  ];
  const max = raw.map(r => r.base + 60 * r.rate); // 60-day ceiling for bar
  return raw.map((r, i) => {
    const v = Math.floor(r.base + days * r.rate);
    const p = Math.min(96, Math.round((v / max[i]) * 100));
    return { l: r.l, v: v.toLocaleString('en-US'), p, c: r.c };
  });
}

function computeCasualties(days: number) {
  return [
    {
      l: 'U.S. FORCES', c: '#4a9eff',
      k: (7  + Math.floor(days * 0.20)).toLocaleString('en-US'),
      w: (70 + Math.floor(days * 2.33)).toLocaleString('en-US'),
    },
    {
      l: 'IRAN MILITARY', c: '#e8a44a',
      k: (1350 + Math.floor(days * 24.9)).toLocaleString('en-US') + '+',
      w: (3100 + Math.floor(days * 58.3)).toLocaleString('en-US') + '+',
    },
    {
      l: 'CIVILIANS', c: '#c93a20',
      k: (930  + Math.floor(days * 15.1)).toLocaleString('en-US') + '+',
      w: (9200 + Math.floor(days * 125.6)).toLocaleString('en-US') + '+',
    },
  ];
}

function computeOpsStatus(now: Date) {
  const sigIntel = osc(now, 3.7, 86, 96);
  const isrCov   = osc(now, 5.2, 82, 94);
  const fuelLoad = osc(now, 2.9, 52, 78);
  // Replenishment countdown: cycles every 12h (00h → 11h59)
  const replenHours = Math.floor(((now.getTime() / 3_600_000) % 12));
  const replenMins  = Math.floor((now.getTime() / 60_000) % 60);
  const fuelStatus  = fuelLoad < 60 ? 'CRITICAL' : fuelLoad < 70 ? 'ELEVATED' : 'NOMINAL';

  return [
    { l: 'SIGNAL INTEL',   v: `${sigIntel}%`, s: sigIntel > 90 ? 'JAMMING ACTIVE' : 'MONITORING',
      alert: sigIntel < 88 },
    { l: 'REPLENISHMENT',  v: `${String(replenHours).padStart(2,'0')}h${String(replenMins).padStart(2,'0')}`,
      s: replenHours < 4 ? 'ARRIVING' : 'IN-BOUND', alert: replenHours < 2 },
    { l: 'ISR COVERAGE',   v: `${isrCov}%`, s: isrCov > 88 ? 'STABLE' : 'DEGRADED',
      alert: isrCov < 84 },
    { l: 'AV FUEL LOAD',   v: `${fuelLoad}%`, s: fuelStatus, alert: fuelLoad < 62 },
  ];
}

function computeRecentEvents(now: Date) {
  const elapsed = now.getTime() - STRIKE_START.getTime();
  // Only include events that have already occurred
  const occurred = EVENT_POOL.filter(e => e.offMs <= elapsed);
  // Take the 4 most recent
  const recent = occurred.slice(-4).reverse();
  return recent.map(e => {
    const ago = elapsed - e.offMs;
    const agoH = Math.floor(ago / 3_600_000);
    const label = agoH < 1   ? `<1h`
                : agoH < 24  ? `-${agoH}h`
                : `-${Math.floor(agoH / 24)}d`;
    return { t: label, e: e.e, c: e.c };
  });
}

function computeAssets(days: number) {
  // Assets grow slightly as theatre expands
  const destroyers = Math.min(11, 8 + Math.floor(days / 8));
  const f35Flights = Math.min(24, 18 + Math.floor(days / 6));
  return [
    { l: 'CSG-2 (TR)',  v: '1',  s: 'COMBAT' },
    { l: 'CSG-8 (IK)',  v: '1',  s: 'ON-STATION' },
    { l: 'DESTROYERS',  v: String(destroyers), s: 'ACTIVE' },
    { l: 'SUBMARINES',  v: '2',  s: 'PATROL' },
    { l: 'F-35C FLTS',  v: String(f35Flights), s: 'OPS' },
    { l: 'AWACS/ISR',   v: '6',  s: 'LINK-16' },
  ];
}

function getElapsed(now: Date) {
  const totalSec = Math.max(0, Math.floor((now.getTime() - STRIKE_START.getTime()) / 1000));
  return {
    days:  Math.floor(totalSec / 86_400),
    hours: Math.floor((totalSec % 86_400) / 3600),
    mins:  Math.floor((totalSec % 3600) / 60),
    secs:  totalSec % 60,
  };
}

const formatDollars = (n: number) => '$' + Math.floor(n).toLocaleString('en-US');
const pad = (n: number) => String(n).padStart(2, '0');

const BURN_RATES = [
  { label: 'Second', value: `$${Math.round(PER_SEC_RATE).toLocaleString('en-US')}` },
  { label: 'Hour',   value: `$${(PER_SEC_RATE * 3600 / 1_000_000).toFixed(1)}M` },
  { label: 'Day',    value: `$${(PER_SEC_RATE * 86400 / 1_000_000_000).toFixed(1)}B` },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function IranWarCostBoard() {
  const [now, setNow] = useState<Date>(new Date());
  const tick = useCallback(() => setNow(new Date()), []);
  useVisibilityPolling(tick, 1_000);

  const cost      = useMemo(() => calcCostLive(now), [now]);
  const el        = useMemo(() => getElapsed(now), [now]);
  const days      = useMemo(() => elapsedDays(now), [now]);
  const munitions = useMemo(() => computeMunitions(days), [days]);
  const airOps    = useMemo(() => computeAirOps(days), [days]);
  const casualties= useMemo(() => computeCasualties(days), [days]);
  const opsStatus = useMemo(() => computeOpsStatus(now), [now]);
  const events    = useMemo(() => computeRecentEvents(now), [now]);
  const assets    = useMemo(() => computeAssets(days), [days]);

  const mono    = 'var(--font-mono)';
  const accent  = 'var(--accent)';
  const border  = 'var(--border-light)';
  const muted   = 'var(--text-muted)';
  const surface = 'var(--surface)';

  return (
    <div className="ftg-iran-board" style={{
      background: surface, border: `1px solid ${border}`, borderTop: `2px solid ${accent}`,
      borderRadius: '0 0 6px 6px', marginBottom: 12, overflow: 'hidden',
    }}>
      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div className="widget-hd ftg-iran-board-top" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="live-dot" style={{ background: accent }} />
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: accent, letterSpacing: '0.1em' }}>
            IRAN THEATER COST & OPERATIONS MODEL
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 11, padding: '4px 10px', background: accent, color: '#fff', borderRadius: 2, fontWeight: 700, letterSpacing: '0.08em' }}>LIVE MODEL</div>
          <div style={{ fontFamily: mono, fontSize: 11, padding: '4px 10px', background: 'var(--border-light)', borderRadius: 2, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em' }}>UPDATED EACH SECOND</div>
        </div>
      </div>

      <div className="ftg-iran-board-grid" style={{ display: 'flex', flexWrap: 'wrap' }}>
        {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
        <div className="ftg-iran-board-main" style={{ flex: '2 1 500px', borderRight: `1px solid ${border}` }}>

          {/* COST SECTION */}
          <div style={{ padding: '24px', borderBottom: `1px solid ${border}`, textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: 13, color: muted, letterSpacing: '0.15em', marginBottom: 14 }}>ESTIMATED TOTAL CONFLICT COST (USD)</div>
            <div className="ftg-war-cost-counter" style={{
              fontFamily: mono, fontSize: 42, fontWeight: 900, color: accent, lineHeight: 1,
              letterSpacing: '-0.02em', marginBottom: 10, fontVariantNumeric: 'tabular-nums',
            }}>
              {formatDollars(cost)}
            </div>
            <div className="ftg-iran-burn-rates" style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 28 }}>
              {BURN_RATES.map(b => (
                <div key={b.label} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: mono, fontSize: 13, color: muted, fontWeight: 600 }}>{b.label.toUpperCase()}:</span>
                  <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{b.value}</span>
                </div>
              ))}
            </div>
            <div className="ftg-iran-timer" style={{ display: 'flex', justifyContent: 'center', gap: 8, opacity: 0.9 }}>
              {[{ v: el.days, l: 'D' }, { v: el.hours, l: 'H' }, { v: el.mins, l: 'M' }, { v: el.secs, l: 'S' }].map((t, i) => (
                <div key={t.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      background: 'var(--surface)', border: `1px solid ${border}`, borderRadius: 3,
                      padding: '6px 12px', fontFamily: mono, fontSize: 18, fontWeight: 800, color: accent, minWidth: 44,
                    }}>{i === 0 ? t.v : pad(t.v)}</div>
                    <div style={{ fontFamily: mono, fontSize: 8, color: muted, marginTop: 4 }}>{t.l}</div>
                  </div>
                  {i < 3 && <span style={{ fontSize: 18, color: accent, opacity: 0.3 }}>:</span>}
                </div>
              ))}
            </div>
          </div>

          {/* MUNITIONS + ASSETS */}
          <div className="ftg-iran-subgrid" style={{ display: 'flex', flexWrap: 'wrap', borderBottom: `1px solid ${border}` }}>
            <div className="ftg-iran-munitions" style={{ flex: '1 1 240px', padding: '14px', borderRight: `1px solid ${border}` }}>
              <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: muted, marginBottom: 14, letterSpacing: '0.05em' }}>MUNITIONS EXPENDED</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 20px' }}>
                {munitions.map(m => (
                  <div key={m.n}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontFamily: mono, fontSize: 13, opacity: 0.9, fontWeight: 600 }}>{m.n}</span>
                      <span style={{ fontFamily: mono, fontSize: 14, color: accent, fontWeight: 800 }}>{m.q}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--border-light)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${m.p}%`, background: accent, borderRadius: 2, transition: 'width 2s linear' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ftg-iran-assets" style={{ flex: '1 1 200px', padding: '14px' }}>
              <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: muted, marginBottom: 14, letterSpacing: '0.05em' }}>THEATER ASSETS</div>
              <div className="ftg-iran-assets-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {assets.map(a => (
                  <div key={a.l} style={{ padding: '9px', border: `1px solid ${border}`, borderRadius: 4, background: 'var(--surface-hover)', textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: 11, color: muted, whiteSpace: 'nowrap', fontWeight: 700 }}>{a.l}</div>
                    <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 900, lineHeight: 1.3 }}>{a.v}</div>
                    <div style={{ fontFamily: mono, fontSize: 9, color: accent, fontWeight: 700, marginTop: 2 }}>{a.s}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AIR OPS + OPERATIONAL READINESS */}
          <div className="ftg-iran-subgrid" style={{ display: 'flex', flexWrap: 'wrap', flexGrow: 1 }}>
            <div className="ftg-iran-air" style={{ flex: '1 1 240px', padding: '16px', borderRight: `1px solid ${border}` }}>
              <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: muted, marginBottom: 16 }}>AIR OPERATIONS (SORTIES)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {airOps.map(a => (
                  <div key={a.l}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 800 }}>{a.l}</span>
                      <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 900 }}>{a.v}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--border-light)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${a.p}%`, background: a.c, borderRadius: 2, transition: 'width 2s linear' }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ftg-iran-readiness" style={{ flex: '1 1 200px', padding: '16px' }}>
              <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: muted, marginBottom: 16 }}>OPERATIONAL READINESS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {opsStatus.map(s => (
                  <div key={s.l} style={{ border: `1px solid ${s.alert ? accent : border}`, borderRadius: 4, padding: '10px', background: s.alert ? 'var(--accent-light)' : 'var(--surface-hover)' }}>
                    <div style={{ fontFamily: mono, fontSize: 11, color: muted, fontWeight: 800, marginBottom: 5 }}>{s.l}</div>
                    <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 900, color: s.alert ? accent : 'var(--text-primary)' }}>{s.v}</div>
                    <div style={{ fontFamily: mono, fontSize: 10, fontWeight: 800, color: s.alert ? accent : muted, marginTop: 3 }}>{s.s}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ padding: '12px 16px', borderTop: `1px solid ${border}`, background: 'var(--surface-hover)', display: 'flex', gap: 18, alignItems: 'center' }}>
            <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 900, color: accent }}>MISSION OBJ:</span>
            <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700 }}>SECURE HORMUZ · NEUTRALIZE FORDOW · DETER PROXY ESCALATION</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <span className="live-dot" style={{ background: '#27ae60', width: 7, height: 7 }} />
              <span style={{ fontFamily: mono, fontSize: 11, color: muted, fontWeight: 800 }}>LINK-16 ACTIVE</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div className="ftg-iran-board-side" style={{ flex: '1 1 300px', background: 'var(--bg)' }}>
          <div style={{ padding: '20px', borderBottom: `1px solid ${border}` }}>
            <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 16 }}>STRATEGIC ENGAGEMENT LOG</div>
            {events.length === 0 ? (
              <div style={{ fontFamily: mono, fontSize: 13, color: muted }}>Awaiting first engagement…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {events.map((h, i) => (
                  <div key={i} style={{ borderLeft: `2px solid var(--accent-light)`, paddingLeft: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontFamily: mono, fontSize: 13, color: accent, fontWeight: 800 }}>{h.t}</span>
                      <span style={{ fontFamily: mono, fontSize: 13, color: muted, fontWeight: 600 }}>{h.c}</span>
                    </div>
                    <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}>{h.e}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '20px' }}>
            <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 16 }}>CASUALTY TRACKER</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {casualties.map(h => (
                <div key={h.l} style={{ padding: '14px', border: `1px solid ${border}`, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: 12, color: muted, marginBottom: 5, fontWeight: 700 }}>{h.l}</div>
                    <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 900, color: h.c, letterSpacing: '-0.01em' }}>
                      {h.k} <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 800 }}>KILLED</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 800, color: h.c }}>{h.w}</div>
                    <div style={{ fontFamily: mono, fontSize: 11, color: muted, fontWeight: 700 }}>WOUNDED</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="ftg-iran-board-footer" style={{ padding: '12px 14px', borderTop: `1px solid ${border}`, background: 'var(--accent-light)', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 800, color: accent }}>LATEST UPDATE:</span>
          <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--text-primary)' }}>
            {events[0]?.e ?? '—'}
          </span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 10, color: muted }}>
          {events[0]?.c ?? ''} · strategic log
        </div>
      </div>
    </div>
  );
}
