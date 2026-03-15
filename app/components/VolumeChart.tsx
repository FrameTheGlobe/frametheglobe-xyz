'use client';

/**
 * VolumeChart — a 24-bar SVG sparkline showing articles-per-hour over the
 * last 24 hours. Zero external dependencies.
 */

import { useMemo } from 'react';

type FeedItem = { pubDate: string };

interface Props {
  items: FeedItem[];
}

const HOURS = 24;
const BAR_W  = 8;
const GAP    = 2;
const HEIGHT = 36;
const WIDTH  = HOURS * (BAR_W + GAP) - GAP;

export default function VolumeChart({ items }: Props) {
  const { buckets, peak, hoursLabels } = useMemo(() => {
    const now     = Date.now();
    const bkts    = new Array<number>(HOURS).fill(0);

    items.forEach(item => {
      const age   = now - new Date(item.pubDate).getTime();
      const hrIdx = Math.floor(age / (60 * 60 * 1000));
      if (hrIdx >= 0 && hrIdx < HOURS) {
        // index 0 = most recent hour, so we reverse when rendering
        bkts[hrIdx]++;
      }
    });

    const pk = Math.max(...bkts, 1);

    // Generate hour labels at 0h, 6h, 12h, 18h, 24h ago
    const labels: { x: number; label: string }[] = [0, 6, 12, 18, 23].map(hrAgo => {
      const x = (HOURS - 1 - hrAgo) * (BAR_W + GAP);
      return {
        x,
        label: hrAgo === 0
          ? 'now'
          : hrAgo === 23
          ? '24h'
          : `${hrAgo}h`,
      };
    });

    return { buckets: bkts, peak: pk, hoursLabels: labels };
  }, [items]);

  const totalRecent = buckets.slice(0, 6).reduce((a, b) => a + b, 0); // last 6h

  return (
    <div style={{
      background:   'var(--surface)',
      border:       '1px solid var(--border-light)',
      borderRadius: 4,
      padding:      '12px 14px',
      marginBottom: 12,
    }}>
      {/* Header row */}
      <div style={{
        display:       'flex',
        justifyContent:'space-between',
        alignItems:    'baseline',
        marginBottom:  8,
      }}>
        <span style={{
          fontFamily:    'var(--font-mono)',
          fontSize:      9,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color:         'var(--text-muted)',
        }}>
          Article volume · 24 h
        </span>
        <span style={{
          fontFamily:  'var(--font-mono)',
          fontSize:    9,
          color:       totalRecent > 10 ? 'var(--accent)' : 'var(--text-muted)',
          letterSpacing:'0.04em',
        }}>
          {totalRecent} in last 6 h
        </span>
      </div>

      {/* SVG bars */}
      <svg
        width={WIDTH}
        height={HEIGHT + 14}
        viewBox={`0 0 ${WIDTH} ${HEIGHT + 14}`}
        style={{ width: '100%', display: 'block' }}
        preserveAspectRatio="none"
      >
        {buckets.map((count, hrAgo) => {
          // hrAgo=0 → newest, render right-to-left
          const xPos   = (HOURS - 1 - hrAgo) * (BAR_W + GAP);
          const barH   = count === 0 ? 1 : Math.max(2, (count / peak) * HEIGHT);
          const y      = HEIGHT - barH;

          // Colour: last 1h = accent, last 6h = dimmed accent, older = border
          const isLast1h  = hrAgo === 0;
          const isLast6h  = hrAgo < 6;
          const fill = isLast1h
            ? 'var(--accent)'
            : isLast6h
            ? 'rgba(176, 53, 26, 0.45)'
            : 'var(--border)';

          return (
            <g key={hrAgo}>
              <rect
                x={xPos}
                y={y}
                width={BAR_W}
                height={barH}
                fill={fill}
                rx={1}
              >
                <title>{`${hrAgo === 0 ? 'Last hour' : `${hrAgo}h ago`}: ${count} article${count !== 1 ? 's' : ''}`}</title>
              </rect>
            </g>
          );
        })}

        {/* Axis labels */}
        {hoursLabels.map(({ x, label }) => (
          <text
            key={label}
            x={x + BAR_W / 2}
            y={HEIGHT + 12}
            textAnchor="middle"
            fontFamily="IBM Plex Mono, monospace"
            fontSize={9}
            fill="var(--text-muted)"
          >
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}
