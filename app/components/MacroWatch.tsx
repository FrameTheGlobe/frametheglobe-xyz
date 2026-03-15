'use client';

import { useMemo, memo } from 'react';

type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  sourceId: string;
  sourceName: string;
};

interface Props {
  items: FeedItem[];
  limit?: number;
}

const MACRO_KEYWORDS = [
  'zerohedge', 'oil price', 'crude oil', 'brent', 'wti', 'fed ', 'interest rate', 'inflation', 
  'commodity', 'equities', 'stock market', 'nasdaq', 's&p 500', 'gold price', 'silver price',
  'treasury yield', 'petrodollar', 'us dollar', 'forex', 'global market', 'sanctions'
];

function MacroWatch({ items, limit = 4 }: Props) {
  const macroNews = useMemo(() => {
    return items
      .filter(item => {
        const isZH = item.sourceId?.startsWith('zerohedge');
        const text = (item.title + ' ' + (item.summary || '')).toLowerCase();
        const hasKeyword = MACRO_KEYWORDS.some(kw => text.includes(kw));
        return isZH || hasKeyword;
      })
      .sort((a, b) => {
        // Prioritize ZeroHedge
        const aZH = a.sourceId?.startsWith('zerohedge');
        const bZH = b.sourceId?.startsWith('zerohedge');
        if (aZH && !bZH) return -1;
        if (!aZH && bZH) return 1;
        // Then by date
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      })
      .slice(0, limit);
  }, [items, limit]);

  if (macroNews.length === 0) return null;

  return (
    <div className="article-card" style={{ 
      padding: '16px 20px', 
      background: 'var(--surface)', 
      border: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            background: '#b58a0d', 
            boxShadow: '0 0 8px #e8c840' 
          }} />
          <h3 style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: 10, 
            color: 'var(--text-primary)', 
            letterSpacing: '0.12em', 
            textTransform: 'uppercase', 
            margin: 0,
            fontWeight: 700
          }}>
             Macro & Markets
          </h3>
        </div>
        <span style={{ 
          fontFamily: 'var(--font-mono)', 
          fontSize: 8, 
          color: '#b58a0d',
          background: '#fef9e7',
          padding: '2px 6px',
          borderRadius: 3,
          textTransform: 'uppercase',
          fontWeight: 600,
          border: '1px solid #e8c840'
        }}>
          Oil · Gold · ZH
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {macroNews.map((item, idx) => (
          <a
            key={`${item.link}-${idx}`}
            href={item.link || undefined}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              paddingBottom: idx === macroNews.length - 1 ? 0 : 10,
              borderBottom: idx === macroNews.length - 1 ? 'none' : '1px solid var(--border-light)'
            }}
          >
            <div style={{ 
              fontFamily: 'var(--font-display)', 
              fontSize: 13, 
              fontWeight: 700, 
              color: 'var(--text-primary)',
              lineHeight: 1.3,
              transition: 'color 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#b58a0d')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            >
              {item.title}
            </div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6,
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)'
            }}>
              <span style={{ fontWeight: 600, color: item.sourceId?.startsWith('zerohedge') ? '#b58a0d' : 'inherit' }}>
                {item.sourceName}
              </span>
              <span>·</span>
              <span>{Math.floor((Date.now() - new Date(item.pubDate).getTime()) / 60000)}m ago</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default memo(MacroWatch);
