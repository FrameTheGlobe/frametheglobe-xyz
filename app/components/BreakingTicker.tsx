'use client';

/**
 * BreakingTicker — scrolling strip of articles published < 30 minutes ago.
 * Rendered only when there are breaking items; otherwise returns null.
 *
 * Wrapped in React.memo with a custom comparator: only re-renders when the
 * set of recent article titles actually changes, not on every parent update.
 */

import { memo, useMemo } from 'react';

type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  sourceName: string;
  region: string;
};

interface Props {
  items: FeedItem[];
}

const WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function BreakingTicker({ items }: Props) {
  // Date.now() inside useMemo is intentional: it runs once per items change,
  // not on every render, keeping the timestamp stable within a render pass.
  // eslint-disable-next-line react-hooks/purity, react-hooks/exhaustive-deps
  const now = useMemo(() => Date.now(), [items]);

  const breaking = items.filter(
    i => now - new Date(i.pubDate).getTime() < WINDOW_MS
  );

  if (breaking.length === 0) return null;

  // Duplicate the list so the scroll loops seamlessly
  const doubled = [...breaking, ...breaking];

  return (
    <div style={{
      background:   'var(--accent)',
      overflow:     'hidden',
      whiteSpace:   'nowrap',
      borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
      position:     'relative',
      zIndex:       150,
    }}>
      {/* BREAKING label */}
      <span style={{
        position:       'absolute',
        left:           0,
        top:            0,
        bottom:         0,
        display:        'flex',
        alignItems:     'center',
        padding:        '0 14px',
        background:     'var(--accent-hover)',
        fontFamily:     'var(--font-mono)',
        fontSize:       9,
        fontWeight:     700,
        letterSpacing:  '0.18em',
        color:          '#fff',
        textTransform:  'uppercase',
        zIndex:         2,
        borderRight:    '1px solid rgba(255,255,255,0.1)',
        boxShadow:      '4px 0 10px rgba(0,0,0,0.15)'
      }}>
        Breaking
      </span>

      {/* Scrolling track */}
      <div style={{
        display:        'inline-flex',
        alignItems:     'center',
        animation:      `ticker-scroll ${Math.max(20, breaking.length * 8)}s linear infinite`,
        paddingLeft:    '90px', // clear the label
      }}>
        {doubled.map((item, idx) => (
          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <a
              href={item.link || undefined}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily:    'var(--font-body)',
                fontSize:      13,
                fontWeight:    500,
                color:         'rgba(255,255,255,0.95)',
                textDecoration:'none',
                padding:       '6px 0',
                transition:    'color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.95)')}
            >
              <span style={{ fontWeight: 600, marginRight: 5, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {item.sourceName}
              </span>
              {item.title}
            </a>
            <span style={{ margin: '0 25px', color: 'rgba(255,255,255,0.25)', fontSize: 9 }}>◆</span>
          </span>
        ))}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// Only re-render when the breaking news window changes:
// compare the titles + pubDates of items that are < 30 min old.
function breakingItemsEqual(prev: Props, next: Props): boolean {
  const now = Date.now();
  const isBreaking = (i: FeedItem) => now - new Date(i.pubDate).getTime() < WINDOW_MS;

  const prevBreaking = prev.items.filter(isBreaking);
  const nextBreaking = next.items.filter(isBreaking);

  if (prevBreaking.length !== nextBreaking.length) return false;
  return prevBreaking.every((item, i) =>
    item.title === nextBreaking[i].title &&
    item.pubDate === nextBreaking[i].pubDate
  );
}

export default memo(BreakingTicker, breakingItemsEqual);
