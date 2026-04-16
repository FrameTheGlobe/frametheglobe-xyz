'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { filterRollingFeed, getRelativeTime } from '@/lib/breaking-filter';
import { titleToKeySet, jaccardSimilarity } from '@/lib/fetcher';
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

interface ClusteredItem {
  primary: FeedItem;
  others: string[]; // names of other sources
}

export default function FlashBriefView({
  items,
}: FlashBriefViewProps) {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  
  // AI Brief focus state
  const [briefingUrl, setBriefingUrl] = useState<string | null>(null);
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);

  // ── Data Processing ────────────────────────────────────────────────────────

  // Apply narrative clustering
  const rollingItems = useMemo(() => {
    const raw = filterRollingFeed(items);
    const clusters: ClusteredItem[] = [];

    raw.forEach(item => {
      const itemKeySet = titleToKeySet(item.title);
      let found = false;

      for (const cluster of clusters) {
        const primaryKeySet = titleToKeySet(cluster.primary.title);
        if (jaccardSimilarity(itemKeySet, primaryKeySet) > 0.45) {
          if (!cluster.others.includes(item.sourceName) && cluster.primary.sourceName !== item.sourceName) {
            cluster.others.push(item.sourceName);
          }
          found = true;
          break;
        }
      }

      if (!found) {
        clusters.push({ primary: item, others: [] });
      }
    });

    return clusters;
  }, [items]);

  // Market polling
  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/market');
      if (res.ok) {
        const data = await res.json();
        setMarkets(data);
      }
    } catch (err) {
      console.error('Flash view markets error:', err);
    } finally {
      setLoadingMarkets(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, 60000);
    return () => clearInterval(interval);
  }, [fetchMarkets]);

  // AI Brief handler
  const handleBrief = async (item: FeedItem) => {
    if (briefingUrl === item.link) {
      setBriefingUrl(null);
      return;
    }
    setBriefingUrl(item.link);
    setBriefingLoading(true);
    setBriefingText(null);

    try {
      const res = await fetch('/api/article-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: item.link,
          title: item.title,
          source: item.sourceName 
        })
      });
      if (res.ok) {
        const data = await res.json();
        setBriefingText(data.brief);
      } else {
        setBriefingText("Unable to generate brief for this signal.");
      }
    } catch (err) {
      setBriefingText("Intel system timeout. Retry briefing later.");
    } finally {
      setBriefingLoading(false);
    }
  };

  const wti = markets.find(m => m.symbol.includes('WTI')) || markets.find(m => m.name.toLowerCase().includes('wti'));
  const brent = markets.find(m => m.symbol.includes('BRENT')) || markets.find(m => m.name.toLowerCase().includes('brent'));

  // Detect if market is "pulsing" (significant change > 1.5%)
  const marketsPulsing = (wti && Math.abs(wti.changePercent) > 1.5) || (brent && Math.abs(brent.changePercent) > 1.5);

  return (
    <div className="flash-brief-container" style={containerStyle}>
      <header style={headerStyle}>
        <div style={eyebrowStyle}>
          <span className="live-dot" />
          FLASH INTEL — REALTIME ROLLING FEED
        </div>
        <h1 style={titleStyle}>Critical Briefing</h1>
        <p style={subtitleStyle}>
          {rollingItems.length === 0
            ? 'Monitoring global feeds...'
            : `${rollingItems.length} intelligence clusters active`}
        </p>
      </header>

      <div className="flash-brief-stream" style={streamStyle}>
        {rollingItems.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={emptyIconStyle}>⊘</div>
            <div style={emptyTitleStyle}>INITIALIZING STREAM</div>
            <div style={emptySubtitleStyle}>Scanning global intelligence networks...</div>
          </div>
        ) : (
          rollingItems.map((cluster, idx) => {
            const item = cluster.primary;
            const prevItem = rollingItems[idx - 1]?.primary;
            
            // Check for hour divider (Temporal Anchor)
            let showDivider = false;
            let dividerLabel = '';
            if (item.pubDate) {
              const date = new Date(item.pubDate);
              const hour = date.getHours();
              const prevHour = prevItem?.pubDate ? new Date(prevItem.pubDate).getHours() : -1;
              if (hour !== prevHour) {
                showDivider = true;
                const diff = Date.now() - date.getTime();
                const hrsAgo = Math.floor(diff / (1000 * 60 * 60));
                dividerLabel = hrsAgo === 0 ? 'LATEST HOUR' : `${hrsAgo} HOUR${hrsAgo === 1 ? '' : 'S'} AGO`;
              }
            }

            return (
              <div key={`${item.sourceId}-${idx}`}>
                {showDivider && (
                  <div style={dividerStyle}>
                    <div style={dividerLineStyle} />
                    <span style={dividerLabelStyle}>{dividerLabel}</span>
                    <div style={dividerLineStyle} />
                  </div>
                )}

                <div className="flash-item-card" style={itemCardStyle}>
                  <div style={itemAccentLine} />
                  <div style={itemContentStyle}>
                    <div style={itemMetaStyle}>
                      <span style={sourceBadgeStyle}>{item.sourceName || 'INTEL'}</span>
                      <span style={timeStyle}>{item.pubDate ? getRelativeTime(item.pubDate) : 'JUST NOW'}</span>
                      
                      {/* AI BRIEF BUTTON */}
                      <button 
                        onClick={() => handleBrief(item)}
                        style={{
                          ...briefButtonStyle,
                          background: briefingUrl === item.link ? 'var(--accent)' : 'var(--surface-muted)',
                          color: briefingUrl === item.link ? '#fff' : 'var(--text-muted)'
                        }}
                      >
                        {briefingUrl === item.link && briefingLoading ? 'SYNCING...' : '⚡ BRIEF'}
                      </button>
                    </div>

                    <a
                      href={item.link || '#'}
                      target={item.link ? "_blank" : "_self"}
                      rel="noopener noreferrer"
                      style={itemTitleStyle}
                    >
                      {item.title || 'Inbound Signal...'}
                    </a>

                    {/* CLUSTER FOOTER */}
                    {cluster.others.length > 0 && (
                      <div style={clusterStyle}>
                        Signals from: {cluster.others.slice(0, 3).join(', ')}
                        {cluster.others.length > 3 && ` +${cluster.others.length - 3} more sources`}
                      </div>
                    )}

                    {/* AI BRIEFING CONTENT */}
                    {briefingUrl === item.link && (
                      <div style={briefContentStyle}>
                        {briefingLoading ? (
                          <div className="shimmer" style={{ height: 40, borderRadius: 4 }} />
                        ) : (
                          <p style={{ margin: 0 }}>{briefingText}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        .flash-item-card:hover {
          transform: translateY(-2px);
          border-color: rgba(var(--accent-rgb), 0.3) !important;
          box-shadow: 0 8px 16px rgba(0,0,0,0.06) !important;
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
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 8px 32px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(var(--accent-rgb), 0.1); }
          50% { box-shadow: 0 8px 32px rgba(var(--accent-rgb), 0.25), inset 0 0 0 2px rgba(var(--accent-rgb), 0.3); }
        }
      `}</style>

      {/* REPOSITIONED: Centered Sticky Bottom Bar for Markets */}
      <div className="flash-market-bar-wrap" style={marketBarWrapStyle}>
        <div style={{
          ...marketBarInnerStyle,
          animation: marketsPulsing ? 'pulse-glow 2s infinite ease-in-out' : 'none'
        }}>
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
  padding: '32px 16px 160px',
  fontFamily: 'var(--font-mono)',
  minHeight: 'calc(100vh - 80px)',
  background: 'radial-gradient(circle at 50% 0%, var(--surface-hover) 0%, var(--bg) 70%)',
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

const briefButtonStyle: React.CSSProperties = {
  marginLeft: 'auto',
  border: 'none',
  padding: '4px 8px',
  borderRadius: 4,
  fontFamily: 'var(--font-mono)',
  fontSize: 9,
  fontWeight: 800,
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const itemTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--text-primary)',
  textDecoration: 'none',
  lineHeight: 1.45,
  display: 'block',
  fontFamily: 'var(--font-display)',
  letterSpacing: '-0.01em',
};

const clusterStyle: React.CSSProperties = {
  marginTop: 10,
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
  opacity: 0.8,
};

const briefContentStyle: React.CSSProperties = {
  marginTop: 14,
  padding: '12px 16px',
  background: 'var(--surface-muted)',
  borderRadius: 6,
  borderLeft: '2px solid var(--accent)',
  fontSize: 13,
  lineHeight: 1.6,
  color: 'var(--text-secondary)',
};

const dividerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  margin: '24px 0 16px',
  opacity: 0.5,
};

const dividerLineStyle: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: 'var(--border)',
};

const dividerLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.12em',
  color: 'var(--text-muted)',
  fontFamily: 'var(--font-mono)',
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
  background: 'rgba(var(--bg-rgb), 0.7)',
  backdropFilter: 'blur(32px) saturate(180%)',
  border: '1px solid rgba(var(--accent-rgb), 0.15)',
  borderRadius: 24,
  padding: '14px 28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  transition: 'all 0.3s ease',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 0 0 1px rgba(255,255,255,0.05)',
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
