'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { filterRollingFeed, getRelativeTime } from '@/lib/breaking-filter';
import Sparkline from '@/app/components/Sparkline';
import type { FeedItem } from '@/lib/fetcher';

interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  history?: number[];
}

interface FlashBriefViewProps {
  items: FeedItem[];
}

export default function FlashBriefView({
  items,
}: FlashBriefViewProps) {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  
  const rollingItems = useMemo(() => filterRollingFeed(items), [items]);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/market');
      if (res.ok) {
        const data = await res.json();
        setMarkets(data);
      }
    } catch (err) {
      console.error('Flash view failed to fetch markets:', err);
    } finally {
      setLoadingMarkets(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 60000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  // Find specifically WTI and Brent from the dynamic market data
  const wti = markets.find(m => m.symbol.includes('WTI')) || markets.find(m => m.name.toLowerCase().includes('wti'));
  const brent = markets.find(m => m.symbol.includes('BRENT')) || markets.find(m => m.name.toLowerCase().includes('brent'));

  return (
    <div className="flash-brief-container" style={containerStyle}>
      <div style={headerStyle}>
        <div style={eyebrowStyle}>
          <span className="live-dot" />
          FLASH INTEL — REALTIME ROLLING FEED
        </div>
        <h1 style={titleStyle}>Critical Briefing</h1>
        <p style={subtitleStyle}>
          {rollingItems.length === 0
            ? 'Monitoring global feeds...'
            : `${rollingItems.length} reports in the last 12 hours`}
        </p>
      </div>

      <div className="flash-brief-stream" style={streamStyle}>
        {rollingItems.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={emptyIconStyle}>⊘</div>
            <div style={emptyTitleStyle}>INITIALIZING STREAM</div>
            <div style={emptySubtitleStyle}>Scanning global intelligence networks...</div>
          </div>
        ) : (
            <div key={`${item.sourceId}-${idx}`} className="flash-item-card" style={itemCardStyle}>
              <div style={itemAccentLine} />
              <div style={itemContentStyle}>
                <div style={itemMetaStyle}>
                  <span style={sourceBadgeStyle}>{item.sourceName || item.sourceId || 'INTEL_NODE'}</span>
                  <span style={timeStyle}>{item.pubDate ? getRelativeTime(item.pubDate) : 'JUST NOW'}</span>
                </div>
                <a
                  href={item.link || '#'}
                  target={item.link ? "_blank" : "_self"}
                  rel="noopener noreferrer"
                  style={itemTitleStyle}
                >
                  {item.title || 'Inbound Signal...'}
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .flash-item-card:hover {
          transform: translateY(-2px);
          border-color: var(--accent) !important;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
        }
        @media (max-width: 640px) {
          .flash-market-bar-wrap {
            bottom: 16px !important;
            width: calc(100% - 16px) !important;
          }
          .flash-market-bar-inner {
            padding: 8px 16px !important;
          }
          .flash-market-clock {
            display: none !important;
          }
        }
      `}</style>

      {/* REPOSITIONED: Centered Sticky Bottom Bar for Markets */}
      <div className="flash-market-bar-wrap" style={marketBarWrapStyle}>
        <div style={marketBarInnerStyle}>
          <div style={marketLabelStyle}>LIVE CRUDE</div>
          
          <div style={marketGridStyle}>
            {loadingMarkets ? (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>SYNCING COMMODITIES...</div>
            ) : (
              <>
                <OilMiniCard 
                  label="WTI" 
                  price={wti?.price || 72.50} 
                  changePercent={wti?.changePercent || 0}
                />
                <div style={marketSeparatorStyle} />
                <OilMiniCard 
                  label="BRENT" 
                  price={brent?.price || 76.80} 
                  changePercent={brent?.changePercent || 0}
                />
              </>
            )}
          </div>
          
          <div style={marketClockStyle}>
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC
          </div>
        </div>
      </div>
    </div>
  );
}

function OilMiniCard({
  label,
  price,
  changePercent,
}: {
  label: string;
  price: number;
  changePercent: number;
}) {
  const isUp = changePercent >= 0;

  return (
    <div style={miniCardStyle}>
      <span style={miniLabelStyle}>{label}</span>
      <span style={miniPriceStyle}>${price.toFixed(2)}</span>
      <span style={{ ...miniChangeStyle, color: isUp ? '#10b981' : '#ef4444' }}>
        {isUp ? '+' : ''}{changePercent.toFixed(2)}%
      </span>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 800,
  margin: '0 auto',
  padding: '32px 16px 140px',
  fontFamily: 'var(--font-mono)',
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: 40,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.15em',
  color: 'var(--accent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  marginBottom: 16,
};

const liveDotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: '#10b981',
  boxShadow: '0 0 10px #10b981',
};

const titleStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: 'var(--text-primary)',
  margin: '0 0 10px',
  letterSpacing: '-0.02em',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-muted)',
  margin: 0,
  letterSpacing: '0.02em',
};

const streamStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const itemCardStyle: React.CSSProperties = {
  position: 'relative',
  background: 'var(--bg)',
  borderRadius: 8,
  border: '1px solid var(--border)',
  overflow: 'hidden',
  boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  transition: 'transform 0.2s ease, border-color 0.2s ease',
};

const itemAccentLine: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 4,
  background: 'var(--accent)',
};

const itemContentStyle: React.CSSProperties = {
  padding: '20px 24px',
};

const itemMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  marginBottom: 10,
};

const sourceBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.08em',
  color: 'var(--accent)',
  background: 'var(--accent-light)',
  padding: '4px 10px',
  borderRadius: 4,
  textTransform: 'uppercase',
};

const timeStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
  fontWeight: 600,
};

const itemTitleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: 'var(--text-primary)',
  textDecoration: 'none',
  lineHeight: 1.5,
  display: 'block',
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '80px 24px',
  border: '1px dashed var(--border)',
  borderRadius: 12,
  background: 'var(--surface-muted)',
};

const emptyIconStyle: React.CSSProperties = {
  fontSize: 48,
  color: 'var(--text-muted)',
  marginBottom: 20,
  opacity: 0.3,
};

const emptyTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  color: 'var(--text-primary)',
  letterSpacing: '0.12em',
  marginBottom: 8,
};

const emptySubtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
};

const marketBarWrapStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 32,
  left: '50%',
  transform: 'translateX(-50%)',
  width: 'calc(100% - 32px)',
  maxWidth: 600,
  zIndex: 1000,
};

const marketBarInnerStyle: React.CSSProperties = {
  background: 'rgba(var(--bg-rgb), 0.9)',
  backdropFilter: 'blur(20px)',
  border: '1px solid var(--border)',
  borderRadius: 16,
  padding: '12px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
};

const marketLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.1em',
  color: 'var(--accent)',
  textTransform: 'uppercase',
};

const marketGridStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 20,
};

const marketSeparatorStyle: React.CSSProperties = {
  width: 1,
  height: 20,
  background: 'var(--border)',
};

const marketClockStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--text-primary)',
  background: 'var(--surface-muted)',
  padding: '4px 8px',
  borderRadius: 6,
  minWidth: 90,
  textAlign: 'center',
};

const miniCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 900,
  color: 'var(--text-muted)',
};

const miniPriceStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: 'var(--text-primary)',
};

const miniChangeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
};
