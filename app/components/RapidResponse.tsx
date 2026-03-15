'use client';

import { useMemo } from 'react';

type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  sourceName: string;
  region: string;
};

interface Props {
  items: FeedItem[];
  limit?: number;
  onViewAll?: () => void;
}

const TRUMP_KEYWORDS = ['trump', 'white house', 'rapid 47', 'vance', 'maga', 'administration', 'executive order', 'mar-a-lago'];

export default function RapidResponse({ items, limit = 4, onViewAll }: Props) {
  const trumpNews = useMemo(() => {
    return items
      .filter(item => {
        const text = (item.title + ' ' + (item.summary || '')).toLowerCase();
        return TRUMP_KEYWORDS.some(kw => text.includes(kw));
      })
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, limit);
  }, [items, limit]);

  if (trumpNews.length === 0) return null;

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
            background: 'var(--brand-blue)', 
            boxShadow: '0 0 8px var(--brand-blue)' 
          }} />
          <h3 style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: 10, 
            color: 'var(--brand-blue)', 
            letterSpacing: '0.12em', 
            textTransform: 'uppercase', 
            margin: 0,
            fontWeight: 700
          }}>
             Rapid 47 Response
          </h3>
        </div>
        <span style={{ 
          fontFamily: 'var(--font-mono)', 
          fontSize: 8, 
          color: 'var(--text-muted)',
          background: 'var(--border-light)',
          padding: '2px 6px',
          borderRadius: 3,
          textTransform: 'uppercase'
        }}>
          White House
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {trumpNews.map((item, idx) => (
          <a
            key={`${item.link}-${idx}`}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              paddingBottom: idx === trumpNews.length - 1 ? 0 : 10,
              borderBottom: idx === trumpNews.length - 1 ? 'none' : '1px solid var(--border-light)'
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
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
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
              <span style={{ fontWeight: 600 }}>{item.sourceName}</span>
              <span>·</span>
              <span>{Math.floor((Date.now() - new Date(item.pubDate).getTime()) / 60000)}m ago</span>
            </div>
          </a>
        ))}
      </div>
      
      {trumpNews.length >= limit && (
        <div style={{ 
          borderTop: '1px solid var(--border-light)', 
          paddingTop: 8,
          textAlign: 'center'
        }}>
          <button 
            onClick={onViewAll}
            style={{
              background: 'none',
              border: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            View all 47 updates →
          </button>
        </div>
      )}
    </div>
  );
}
