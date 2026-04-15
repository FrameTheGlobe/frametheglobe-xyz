'use client';

import { useMemo } from 'react';
import { filterBreakingNews, getRelativeTime } from '@/lib/breaking-filter';
import Sparkline from '@/app/components/Sparkline';
import type { FeedItem } from '@/lib/fetcher';

interface FlashBriefViewProps {
  items: FeedItem[];
  wtiPrice: number;
  wtiHistory: number[];
  brentPrice: number;
  brentHistory: number[];
  lastUpdated: Date;
}

export default function FlashBriefView({
  items,
  wtiPrice = 72.5,
  wtiHistory = [70, 71, 72, 71.5, 72.5],
  brentPrice = 76.8,
  brentHistory = [74, 75, 76, 76.2, 76.8],
  lastUpdated = new Date(),
}: FlashBriefViewProps) {
  const breakingItems = useMemo(() => filterBreakingNews(items), [items]);

  return (
    <div className="flash-brief-container" style={containerStyle}>
      <div style={headerStyle}>
        <div style={eyebrowStyle}>
          <span style={liveDotStyle} />
          FLASH BRIEF — LAST 30 MINUTES
        </div>
        <h1 style={titleStyle}>Critical Intelligence</h1>
        <p style={subtitleStyle}>
          {breakingItems.length === 0
            ? 'No critical alerts detected'
            : `${breakingItems.length} breaking item${breakingItems.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      <div style={streamStyle}>
        {breakingItems.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={emptyIconStyle}>⊘</div>
            <div style={emptyTitleStyle}>NO CRITICAL ALERTS</div>
            <div style={emptySubtitleStyle}>Last 30 minutes</div>
          </div>
        ) : (
          breakingItems.map((item, idx) => (
            <div key={item.link || idx} style={itemCardStyle}>
              <div style={itemAccentLine} />
              <div style={itemContentStyle}>
                <div style={itemMetaStyle}>
                  <span style={sourceBadgeStyle}>{item.sourceName || item.source}</span>
                  <span style={timeStyle}>{getRelativeTime(item.pubDate)}</span>
                </div>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={itemTitleStyle}
                >
                  {item.title}
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={oilWidgetStyle}>
        <div style={oilHeaderStyle}>LIVE MARKETS</div>
        <div style={oilGridStyle}>
          <OilMiniCard label="WTI CRUDE" price={wtiPrice} history={wtiHistory} />
          <OilMiniCard label="BRENT" price={brentPrice} history={brentHistory} />
        </div>
        <div style={oilFooterStyle}>
          Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

function OilMiniCard({
  label,
  price,
  history,
}: {
  label: string;
  price: number;
  history: number[];
}) {
  const change = history.length > 1 ? price - history[history.length - 2] : 0;
  const changePercent = history.length > 1 ? (change / history[history.length - 2]) * 100 : 0;
  const isUp = change >= 0;

  return (
    <div style={miniCardStyle}>
      <div style={miniLabelStyle}>{label}</div>
      <div style={miniPriceStyle}>${price.toFixed(2)}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ ...miniChangeStyle, color: isUp ? '#27ae60' : '#e74c3c' }}>
          {isUp ? '+' : ''}{changePercent.toFixed(2)}%
        </span>
        <Sparkline data={history} width={40} height={20} />
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  padding: '24px 16px 120px',
  fontFamily: 'var(--font-mono)',
};

const headerStyle: React.CSSProperties = {
  textAlign: 'center',
  marginBottom: 32,
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.1em',
  color: 'var(--accent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  marginBottom: 12,
};

const liveDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#27ae60',
};

const titleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: 'var(--text-primary)',
  margin: '0 0 8px',
  fontFamily: 'var(--font-lora)',
};

const subtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--text-muted)',
  margin: 0,
};

const streamStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const itemCardStyle: React.CSSProperties = {
  position: 'relative',
  background: 'var(--surface)',
  borderRadius: 6,
  border: '1px solid var(--border)',
  overflow: 'hidden',
};

const itemAccentLine: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 3,
  background: 'var(--accent)',
};

const itemContentStyle: React.CSSProperties = {
  padding: '16px 20px 16px 23px',
};

const itemMetaStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 8,
};

const sourceBadgeStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.05em',
  color: 'var(--accent)',
  background: 'var(--accent-light, rgba(30, 64, 175, 0.1))',
  padding: '3px 8px',
  borderRadius: 3,
  textTransform: 'uppercase',
};

const timeStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-muted)',
};

const itemTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--text-primary)',
  textDecoration: 'none',
  lineHeight: 1.4,
  display: 'block',
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '60px 20px',
  border: '1px dashed var(--border)',
  borderRadius: 6,
  background: 'var(--surface)',
};

const emptyIconStyle: React.CSSProperties = {
  fontSize: 48,
  color: 'var(--text-muted)',
  marginBottom: 16,
  opacity: 0.5,
};

const emptyTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: 'var(--text-muted)',
  letterSpacing: '0.1em',
  marginBottom: 4,
};

const emptySubtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted)',
  opacity: 0.7,
};

const oilWidgetStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
  minWidth: 240,
  zIndex: 100,
};

const oilHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.1em',
  color: 'var(--accent)',
  marginBottom: 12,
  borderBottom: '1px solid var(--border)',
  paddingBottom: 8,
};

const oilGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const oilFooterStyle: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--text-muted)',
  marginTop: 12,
  textAlign: 'right',
};

const miniCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
};

const miniPriceStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: 'var(--text-primary)',
};

const miniChangeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
};
