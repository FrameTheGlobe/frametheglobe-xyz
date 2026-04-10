'use client';

/**
 * BreakingTicker — scrolling headline strip (breaking → live wire → standby).
 * Background comes from the parent `.ftg-news-ticker-bar` (solid brand blue).
 * Memo comparator limits re-renders to ticker-window item changes.
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

const BREAKING_WINDOW_MS = 30 * 60 * 1000; // 30 minutes
const LIVE_WIRE_WINDOW_MS = 6 * 60 * 60 * 1000; // fallback window

function BreakingTicker({ items }: Props) {
  // eslint-disable-next-line react-hooks/purity, react-hooks/exhaustive-deps
  const now = useMemo(() => Date.now(), [items]);

  const breaking = items.filter(
    (i) => now - new Date(i.pubDate).getTime() < BREAKING_WINDOW_MS
  );

  const fallback = items
    .filter((i) => now - new Date(i.pubDate).getTime() < LIVE_WIRE_WINDOW_MS)
    .sort(
      (a, b) =>
        new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    )
    .slice(0, 16);

  const feed = breaking.length > 0 ? breaking : fallback;
  const mode: 'breaking' | 'live' | 'idle' =
    breaking.length > 0 ? 'breaking' : feed.length > 0 ? 'live' : 'idle';

  const idleFeed: FeedItem[] = [
    {
      title: 'Monitoring global wires — awaiting fresh Iran-theater updates.',
      link: '',
      pubDate: new Date(now).toISOString(),
      sourceName: 'FrameTheGlobe',
      region: 'global',
    },
    {
      title: 'Live stream connected — polling and SSE channels are active.',
      link: '',
      pubDate: new Date(now).toISOString(),
      sourceName: 'System',
      region: 'global',
    },
    {
      title: 'Tip: use Filters and Alerts to surface your priority signals.',
      link: '',
      pubDate: new Date(now).toISOString(),
      sourceName: 'Operator',
      region: 'global',
    },
  ];
  const tickerFeed = feed.length > 0 ? feed : idleFeed;
  const doubled = [...tickerFeed, ...tickerFeed];

  return (
    <div
      className="ftg-breaking-ticker"
      style={{
        background: 'transparent',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        borderBottom: 'none',
        position: 'relative',
        zIndex: 1,
      }}
    >
      <span className="ftg-breaking-ticker__label">
        {mode === 'breaking'
          ? 'Breaking'
          : mode === 'live'
            ? 'Live Wire'
            : 'Standby'}
      </span>

      <div
        className="ftg-breaking-ticker__track"
        style={{
          animation: `ticker-scroll ${Math.max(20, tickerFeed.length * 8)}s linear infinite`,
        }}
      >
        {doubled.map((item, idx) => (
          <span
            key={idx}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="ftg-breaking-ticker__link"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.95)',
                  textDecoration: 'none',
                  padding: '8px 0',
                  transition: 'color 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = 'rgba(255,255,255,0.95)')
                }
              >
                <span className="ftg-breaking-ticker__source">
                  {item.sourceName}
                </span>
                {item.title}
              </a>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.92)',
                  padding: '8px 0',
                }}
              >
                <span className="ftg-breaking-ticker__source">
                  {item.sourceName}
                </span>
                {item.title}
              </span>
            )}
            <span className="ftg-breaking-ticker__sep">◆</span>
          </span>
        ))}
      </div>

      <style>{`
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ftg-breaking-ticker__source {
          font-weight: 700;
          margin-right: 6px;
          color: rgba(255,255,255,0.7);
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .ftg-breaking-ticker__sep {
          margin: 0 30px;
          color: rgba(255,255,255,0.25);
          font-size: 11px;
        }
        @media (max-width: 820px) {
          .ftg-breaking-ticker {
            --ftg-ticker-label-w: 7.25rem;
          }
          .ftg-breaking-ticker__label {
            padding: 0 10px 0 12px !important;
            font-size: 10px !important;
            letter-spacing: 0.1em !important;
          }
          .ftg-breaking-ticker__link {
            font-size: 12px !important;
            padding: 7px 0 !important;
          }
          .ftg-breaking-ticker__source,
          .ftg-breaking-ticker__sep {
            font-size: 10px !important;
          }
          .ftg-breaking-ticker__sep {
            margin: 0 20px !important;
          }
        }
        @media (max-width: 375px) {
          .ftg-breaking-ticker {
            --ftg-ticker-label-w: 6.25rem;
          }
          .ftg-breaking-ticker__label {
            padding: 0 8px 0 10px !important;
            font-size: 9px !important;
            letter-spacing: 0.08em !important;
          }
          .ftg-breaking-ticker__link {
            font-size: 11px !important;
            padding: 6px 0 !important;
          }
          .ftg-breaking-ticker__source,
          .ftg-breaking-ticker__sep {
            font-size: 9px !important;
          }
          .ftg-breaking-ticker__sep {
            margin: 0 14px !important;
          }
        }
      `}</style>
    </div>
  );
}

function breakingItemsEqual(prev: Props, next: Props): boolean {
  const now = Date.now();
  const inTickerWindow = (i: FeedItem) =>
    now - new Date(i.pubDate).getTime() < LIVE_WIRE_WINDOW_MS;

  const prevTicker = prev.items.filter(inTickerWindow);
  const nextTicker = next.items.filter(inTickerWindow);

  if (prevTicker.length !== nextTicker.length) return false;
  return prevTicker.every(
    (item, i) =>
      item.title === nextTicker[i].title &&
      item.pubDate === nextTicker[i].pubDate
  );
}

export default memo(BreakingTicker, breakingItemsEqual);
