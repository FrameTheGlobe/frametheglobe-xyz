'use client';

/**
 * IranWarCostBoard — Live U.S. war cost counter for the Iran War Theater section.
 *
 * Methodology (Pentagon briefing to Congress):
 *   $11.3B for the first 6 days of strikes + $1B/day ongoing.
 *   Cost is deterministic from the strike start date — no API required.
 *   Ticks every second via setInterval.
 *
 * Human cost figures: static, sourced from DoD/CENTCOM, Hengaw,
 *   Iranian Red Crescent, AP, Reuters, Al Jazeera via iran-cost-ticker.com.
 *
 * Attribution: iran-cost-ticker.com
 */

import { useState, useEffect, useRef } from 'react';

// ── Constants ────────────────────────────────────────────────────────────────
const STRIKE_START   = new Date('2026-02-28T00:00:00Z');
const BASE_COST_USD  = 11_300_000_000;   // $11.3B for first 6 days
const BASE_DAYS      = 6;
const DAILY_RATE     = 1_000_000_000;    // $1B/day after day 6
const PER_SECOND     = DAILY_RATE / 86_400; // ≈ $11,574.07 / second

// ── Pure helpers ─────────────────────────────────────────────────────────────
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

// ── Static data ───────────────────────────────────────────────────────────────
const HUMAN_COST = [
  {
    label:        'U.S. Service Members',
    killed:       '13',
    wounded:      '140',
    killedColor:  '#4a9eff',
    woundedColor: '#4a9eff',
    note:         null,
  },
  {
    label:        'Iranian Military',
    killed:       '2,096+',
    wounded:      null,
    killedColor:  '#e8a44a',
    woundedColor: null,
    note:         'INCL. SENIOR LEADERSHIP',
  },
  {
    label:        'Iranian Civilians',
    killed:       '1,382+',
    wounded:      '12,969+',
    killedColor:  '#c93a20',
    woundedColor: '#c93a20',
    note:         null,
  },
] as const;

const BURN_RATES = [
  { label: 'Per Second', value: `$${Math.round(PER_SECOND).toLocaleString('en-US')}` },
  { label: 'Per Hour',   value: `$${Math.round(PER_SECOND * 3600).toLocaleString('en-US')}` },
  { label: 'Per Day',    value: '$1,000,000,000' },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function IranWarCostBoard() {
  const [now, setNow] = useState<Date>(() => new Date());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const cost    = calcCost(now);
  const elapsed = getElapsed(now);

  const mono   = 'var(--font-mono)';
  const muted  = 'var(--text-muted)';
  const border = 'var(--border-light)';
  const red    = '#c93a20';

  return (
    <div style={{
      background:   'var(--surface)',
      border:       `1px solid ${border}`,
      borderTop:    `2px solid ${red}`,
      borderRadius: '0 0 3px 3px',
      marginBottom: 12,
      overflow:     'hidden',
    }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '7px 14px',
        borderBottom:   `1px solid ${border}`,
        background:     'rgba(201,58,32,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{
            display:     'inline-block',
            width:       6,
            height:      6,
            borderRadius:'50%',
            background:  red,
            boxShadow:   `0 0 6px rgba(201,58,32,0.6)`,
            animation:   'pulse 2s infinite',
            flexShrink:  0,
          }} />
          <span style={{
            fontFamily:    mono,
            fontSize:      10,
            fontWeight:    700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color:         red,
          }}>
            U.S. War Cost · Operation Epic Fury
          </span>
        </div>
        <a
          href="https://iran-cost-ticker.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily:    mono,
            fontSize:      8,
            color:         muted,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            border:        `1px solid ${border}`,
            padding:       '1px 5px',
            borderRadius:  2,
            textDecoration:'none',
          }}
        >
          iran-cost-ticker.com ↗
        </a>
      </div>

      {/* ── Running total ───────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px 12px', textAlign: 'center' }}>
        <div style={{
          fontFamily:    mono,
          fontSize:      9,
          fontWeight:    700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color:         muted,
          marginBottom:  8,
        }}>
          Est. U.S. Cost Since Strikes Began
        </div>

        {/* Big counter */}
        <div
          className="ftg-war-cost-counter"
          style={{
            fontFamily:    mono,
            fontSize:      34,
            fontWeight:    800,
            color:         red,
            letterSpacing: '-0.02em',
            lineHeight:    1,
            marginBottom:  6,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatDollars(cost)}
        </div>

        <div style={{
          fontFamily:    mono,
          fontSize:      8,
          color:         muted,
          letterSpacing: '0.03em',
          marginBottom:  14,
        }}>
          $11.3B first 6 days (Pentagon → Congress) + $1B/day ongoing
        </div>

        {/* Elapsed clock */}
        <div style={{
          display:        'flex',
          alignItems:     'flex-start',
          justifyContent: 'center',
          gap:            4,
        }}>
          {([
            { val: elapsed.days,  label: 'DAYS', raw: elapsed.days },
            { val: elapsed.hours, label: 'HRS',  raw: elapsed.hours },
            { val: elapsed.mins,  label: 'MIN',  raw: elapsed.mins },
            { val: elapsed.secs,  label: 'SEC',  raw: elapsed.secs },
          ] as const).map(({ val, label }, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  background:   'rgba(201,58,32,0.12)',
                  border:       '1px solid rgba(201,58,32,0.3)',
                  borderRadius: 3,
                  padding:      '4px 8px',
                  fontFamily:   mono,
                  fontSize:     16,
                  fontWeight:   700,
                  color:        red,
                  minWidth:     38,
                  textAlign:    'center',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {label === 'DAYS' ? String(val) : pad(val)}
                </div>
                <div style={{
                  fontFamily:    mono,
                  fontSize:      7,
                  color:         muted,
                  letterSpacing: '0.08em',
                  marginTop:     3,
                }}>
                  {label}
                </div>
              </div>
              {i < 3 && (
                <div style={{
                  fontFamily: mono,
                  fontSize:   16,
                  fontWeight: 700,
                  color:      'rgba(201,58,32,0.4)',
                  marginTop:  3,
                  lineHeight: 1.4,
                }}>
                  :
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Burn rates ──────────────────────────────────────────────── */}
      <div style={{
        display:     'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        borderTop:   `1px solid ${border}`,
        borderBottom:`1px solid ${border}`,
      }}>
        {BURN_RATES.map(({ label, value }, i) => (
          <div key={label} style={{
            padding:     '8px 10px',
            textAlign:   'center',
            borderRight: i < 2 ? `1px solid ${border}` : 'none',
          }}>
            <div style={{
              fontFamily:    mono,
              fontSize:      8,
              color:         muted,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom:  4,
            }}>
              {label}
            </div>
            <div style={{
              fontFamily:         mono,
              fontSize:           13,
              fontWeight:         700,
              color:              'var(--text-primary)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Human cost ──────────────────────────────────────────────── */}
      <div style={{ padding: '10px 14px 12px' }}>
        <div style={{
          fontFamily:    mono,
          fontSize:      8,
          fontWeight:    700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color:         muted,
          marginBottom:  8,
        }}>
          The Human Cost
        </div>

        <div className="ftg-human-cost-grid" style={{
          display:             'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap:                 6,
        }}>
          {HUMAN_COST.map(({ label, killed, wounded, killedColor, woundedColor, note }) => (
            <div key={label} style={{
              background:   'var(--bg)',
              border:       `1px solid ${border}`,
              borderRadius: 3,
              padding:      '8px 10px',
            }}>
              <div style={{
                fontFamily:    mono,
                fontSize:      7,
                fontWeight:    700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color:         muted,
                marginBottom:  6,
              }}>
                {label}
              </div>
              <div style={{
                fontFamily: mono,
                fontSize:   20,
                fontWeight: 800,
                color:      killedColor,
                lineHeight: 1,
                marginBottom: 2,
              }}>
                {killed}
              </div>
              <div style={{ fontFamily: mono, fontSize: 7, color: muted, marginBottom: note ? 4 : (wounded ? 6 : 0) }}>
                killed
              </div>
              {note && (
                <div style={{
                  fontFamily:    mono,
                  fontSize:      6,
                  color:         muted,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom:  wounded ? 6 : 0,
                }}>
                  {note}
                </div>
              )}
              {wounded && woundedColor && (
                <>
                  <div style={{
                    fontFamily: mono,
                    fontSize:   15,
                    fontWeight: 700,
                    color:      woundedColor,
                    lineHeight: 1,
                    marginBottom: 2,
                  }}>
                    {wounded}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 7, color: muted }}>wounded</div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Notable incident */}
        <div style={{
          marginTop:    8,
          padding:      '6px 10px',
          background:   'rgba(201,58,32,0.05)',
          border:       `1px solid rgba(201,58,32,0.2)`,
          borderRadius: 3,
          borderLeft:   `2px solid ${red}`,
        }}>
          <span style={{ fontFamily: mono, fontSize: 8, fontWeight: 700, color: red }}>
            175 killed at Shajareh Tayyebeh girls&apos; school in Minab
          </span>
          <span style={{ fontFamily: mono, fontSize: 8, color: muted }}>
            {' '}— mostly girls aged 7–12 and staff. Condemned by UNESCO.
          </span>
        </div>

        <div style={{
          fontFamily:    mono,
          fontSize:      7,
          color:         muted,
          letterSpacing: '0.04em',
          marginTop:     8,
          textAlign:     'right',
        }}>
          Sources: DoD/CENTCOM · Hengaw · Iranian Red Crescent · AP · Reuters · Al Jazeera
        </div>
      </div>
    </div>
  );
}
