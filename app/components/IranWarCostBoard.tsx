'use client';

/**
 * IranWarCostBoard — Live U.S. war cost counter for the Iran War Theater section.
 * ULTRA-DENSE VERSION 2.2
 */

import { useState, useEffect, useRef, useMemo } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
const STRIKE_START   = new Date('2026-02-28T00:00:00Z');
const BASE_COST_USD  = 11_300_000_000;
const BASE_DAYS      = 6;
const DAILY_RATE     = 1_000_000_000;
const PER_SECOND     = DAILY_RATE / 86_400;

// ── Static data ───────────────────────────────────────────────────────────────
const HUMAN_COST = [
  { l: 'U.S. FORCES', k: '13', w: '140', c: '#4a9eff', n: 'CSG-2 / SEAL TM-6' },
  { l: 'IRAN MILITARY', k: '2,096+', w: '4,850+', c: '#e8a44a', n: 'IRGC-QF / BASIJ' },
  { l: 'CIVILIANS', k: '1,382+', w: '12,969+', c: '#c93a20', n: 'MINAB / BASHAGARD' },
];

const MUNITIONS = [
  { n: 'TOMAHAWK V', q: '142', c: '$284M', p: 72 },
  { n: 'JDAM GBU-31', q: '1,090', c: '$76M', p: 45 },
  { n: 'SM-6 BLOCK IA', q: '54', c: '$270M', p: 31 },
  { n: 'AGM-158 JASSM', q: '28', c: '$32M', p: 18 },
  { n: 'AIM-120D', q: '38', c: '$41M', p: 22 },
  { n: 'GBU-39 SDB', q: '412', c: '$16M', p: 64 },
];

const ASSETS = [
  { l: 'CSG-2 (TR)', v: '1', s: 'COMBAT' },
  { l: 'CSG-8 (IK)', v: '1', s: 'ON-STATION' },
  { l: 'DESTROYERS', v: '8', s: 'ACTIVE' },
  { l: 'SUBMARINES', v: '2', s: 'PATROL' },
  { l: 'F-35C FLTS', v: '18', s: 'OPS' },
  { l: 'AWACS/ISR', v: '6', s: 'LINK-16' },
];

const RECENT_HISTORY = [
  { t: '-2h', e: 'B-2 Strike on Fordow enrichment facility', c: '$11.2M' },
  { t: '-5h', e: 'Intercept of 12 Houthi anti-ship missiles', c: '$28.8M' },
  { t: '-9h', e: 'Deployment of 12th Marine Expeditionary Unit', c: '$4.2M' },
  { t: '-14h', e: 'Carrier air wing replenishment flight', c: '$1.8M' },
];

export default function IranWarCostBoard() {
  const [now, setNow] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setNow(new Date());
    timerRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const cost = useMemo(() => now ? calcCost(now) : 0, [now]);
  const el = useMemo(() => now ? getElapsed(now) : null, [now]);

  if (!now || !el) return <div style={{ height: 400, background: 'var(--surface)' }} />;

  const mono = 'var(--font-mono)';
  const red = '#c93a20';
  const border = 'var(--border-light)';
  const muted = 'var(--text-muted)';
  const surface = 'var(--surface)';

  return (
    <div style={{
      background: surface, border: `1px solid ${border}`, borderTop: `2px solid ${red}`,
      borderRadius: '0 0 6px 6px', marginBottom: 12, overflow: 'hidden',
    }}>
      {/* ── HEADER BLOCK ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '10px 14px', borderBottom: `1px solid ${border}`, background: 'rgba(201,58,32,0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="live-dot" style={{ background: red }} />
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 800, color: red, letterSpacing: '0.1em' }}>
            U.S. CENTRAL COMMAND · WAR EXPENDITURE · V2.2-TAC
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ fontFamily: mono, fontSize: 13, padding: '4px 10px', background: red, color: '#fff', borderRadius: 2, fontWeight: 700 }}>TOP SECRET // NOCON</div>
          <div style={{ fontFamily: mono, fontSize: 13, padding: '4px 10px', background: 'var(--border-light)', borderRadius: 2, fontWeight: 700 }}>SECURE LINK ACTIVE</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        {/* LEFT COLUMN: MAIN STATS */}
        <div style={{ flex: '2 1 500px', borderRight: `1px solid ${border}` }}>
          {/* BIG COST SECTION */}
          <div style={{ padding: '24px', borderBottom: `1px solid ${border}`, textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: 13, color: muted, letterSpacing: '0.15em', marginBottom: 14 }}>ESTIMATED TOTAL CONFLICT COST (USD)</div>
            <div className="ftg-war-cost-counter" style={{
              fontFamily: mono, fontSize: 42, fontWeight: 900, color: red, lineHeight: 1, letterSpacing: '-0.02em',
              marginBottom: 10, fontVariantNumeric: 'tabular-nums'
            }}>
              {formatDollars(cost)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginBottom: 28 }}>
              {BURN_RATES.map(b => (
                <div key={b.label} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: mono, fontSize: 13, color: muted, fontWeight: 600 }}>{b.label.toUpperCase()}:</span>
                  <span style={{ fontFamily: mono, fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{b.value}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, opacity: 0.9 }}>
              {[{ v: el.days, l: 'D' }, { v: el.hours, l: 'H' }, { v: el.mins, l: 'M' }, { v: el.secs, l: 'S' }].map((t, i) => (
                <div key={t.l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                   <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        background: 'rgba(255,255,255,0.02)', border: `1px solid ${border}`, borderRadius: 3, 
                        padding: '6px 12px', fontFamily: mono, fontSize: 18, fontWeight: 800, color: red, minWidth: 44
                      }}>{i === 0 ? t.v : pad(t.v)}</div>
                      <div style={{ fontFamily: mono, fontSize: 8, color: muted, marginTop: 4 }}>{t.l}</div>
                   </div>
                   {i < 3 && <div style={{ fontSize: 18, color: 'rgba(201,58,32,0.2)' }}>:</div>}
                </div>
              ))}
            </div>
          </div>

          {/* ASSET & MUNITION GRID CARD */}
          <div style={{ display: 'flex', flexWrap: 'wrap', borderTop: `1px solid ${border}` }}>
            <div style={{ flex: '1 1 240px', padding: '14px', borderRight: `1px solid ${border}` }}>
              <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 12, letterSpacing: '0.05em' }}>MUNITIONS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                {MUNITIONS.slice(0, 4).map(m => (
                  <div key={m.n}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontFamily: mono, fontSize: 13, opacity: 0.9, fontWeight: 500 }}>{m.n}</span>
                      <span style={{ fontFamily: mono, fontSize: 13, color: red, fontWeight: 700 }}>{m.q}</span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                       <div style={{ height: '100%', width: `${m.p}%`, background: red, borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ flex: '1 1 200px', padding: '14px' }}>
              <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 12, letterSpacing: '0.05em' }}>THEATER ASSETS</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                 {ASSETS.slice(0, 6).map(a => (
                   <div key={a.l} style={{ padding: '8px', border: `1px solid ${border}`, borderRadius: 4, background: 'rgba(255,255,255,0.01)', textAlign: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 12, color: muted, whiteSpace: 'nowrap', textTransform: 'uppercase', fontWeight: 600 }}>{a.l}</div>
                      <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 900, lineHeight: 1.2 }}>{a.v}</div>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: RECENT LOGS & HUMAN COST */}
        <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.01)' }}>
          <div style={{ padding: '20px', borderBottom: `1px solid ${border}` }}>
            <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 16 }}>STRATEGIC ENGAGEMENT LOG</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {RECENT_HISTORY.map((h, i) => (
                <div key={i} style={{ borderLeft: `2px solid ${red}33`, paddingLeft: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: mono, fontSize: 13, color: red, fontWeight: 800 }}>{h.t}</span>
                    <span style={{ fontFamily: mono, fontSize: 13, color: muted, fontWeight: 600 }}>{h.c}</span>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}>{h.e}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ padding: '20px' }}>
             <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 16 }}>CASUALTY TRACKER</div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {HUMAN_COST.map(h => (
                  <div key={h.l} style={{ padding: '14px', border: `1px solid ${border}`, borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 13, color: muted, marginBottom: 6, fontWeight: 700 }}>{h.l}</div>
                      <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 900, color: h.c, letterSpacing: '-0.01em' }}>{h.k} <span style={{ fontSize: 13, opacity: 0.7, fontWeight: 800 }}>KILLED</span></div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 800, color: h.c }}>{h.w}</div>
                      <div style={{ fontFamily: mono, fontSize: 11, color: muted, fontWeight: 700 }}>WOUNDED</div>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* FOOTER: NOTABLE ALERTS */}
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${border}`, background: 'rgba(201,58,32,0.04)', display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
           <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 800, color: red }}>LATEST INCIDENT:</span>
           <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--text-primary)' }}>175 KILLED · SHAJAREH TAYYEBEH GIRLS SCHOOL · MINAB · UN CONDEMNED</span>
        </div>
        <div style={{ fontFamily: mono, fontSize: 9, color: muted }}>SOURCE: DOD/CENTCOM · IRCS · AP WIRE</div>
      </div>
    </div>
  );
}

const BURN_RATES = [
  { label: 'Second', value: `$11,574` },
  { label: 'Hour',   value: `$41.7M` },
  { label: 'Day',    value: '$1B' },
];

function calcCost(now: Date): number {
  const elapsedMs   = now.getTime() - STRIKE_START.getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  const extraDays   = Math.max(0, elapsedDays - BASE_DAYS);
  return BASE_COST_USD + extraDays * DAILY_RATE;
}

function formatDollars(n: number): string {
  return '$' + Math.floor(n).toLocaleString('en-US');
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

const pad = (n: number) => String(n).padStart(2, '0');
