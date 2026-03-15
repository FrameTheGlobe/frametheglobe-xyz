'use client';

import { useState, useEffect, useMemo } from 'react';

type PriceData = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
};

type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
  sourceId: string;
  sourceName: string;
};

interface Props {
  items?: FeedItem[];
}

export default function OilTicker({ items = [] }: Props) {
  const [prices, setPrices] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Filter for oil-specific news
  const oilNews = useMemo(() => {
    return items
      .filter(item => {
        const text = (item.title + ' ' + (item.summary || '')).toLowerCase();
        return text.includes('oil') || text.includes('crude') || text.includes('brent') || text.includes('wti') || text.includes('opec');
      })
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 3);
  }, [items]);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        setLoading(true);
        // Using our safe server-side API proxy to avoid CORS blocks
        const res = await fetch('/api/market');
        if (!res.ok) throw new Error('Fetch failed');
        
        const results = await res.json();
        
        // Results are already mapped by the server route
        setPrices(results);
        setError(false);
      } catch (err) {
        console.error('[FTG] Oil price fetch error:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="article-card" style={{ 
      padding: '16px 20px', 
      background: 'var(--surface)', 
      border: '1px solid var(--border-light)',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minHeight: 280
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ 
            width: 8, 
            height: 8, 
            borderRadius: '50%', 
            background: '#c93a20', 
            boxShadow: '0 0 8px rgba(201, 58, 32, 0.4)' 
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
             Energy Dashboard
          </h3>
        </div>
        <span style={{ 
          fontFamily: 'var(--font-mono)', 
          fontSize: 8, 
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Live · NYMEX / ICE
        </span>
      </div>

      {/* Price Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && prices.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton" style={{ height: 32, width: '100%' }} />
            ))}
          </div>
        )}

        {error && prices.length === 0 && (
          <div style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: 10, 
            color: 'var(--accent)', 
            padding: '10px 0',
            textAlign: 'center'
          }}>
            Unable to pulse market data. Check connection.
          </div>
        )}

        {prices.map((p) => {
          const isUp = p.change >= 0;
          return (
            <div key={p.symbol} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '6px 0',
              borderBottom: '1px solid var(--border-light)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: 11, 
                  fontWeight: 600, 
                  color: 'var(--text-primary)' 
                }}>
                  {p.name.replace(' Future', '').replace('Crude Oil WTI', 'WTI Crude').replace('ICE Brent Crude', 'Brent Crude')}
                </span>
                <span style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: 8, 
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase'
                }}>
                  {p.symbol}
                </span>
              </div>
              
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: 13, 
                  fontWeight: 700,
                  color: 'var(--text-primary)'
                }}>
                  ${p.price.toFixed(2)}
                </span>
                <span style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: 9, 
                  fontWeight: 600,
                  color: isUp ? '#27ae60' : '#c93a20'
                }}>
                  {isUp ? '+' : ''}{p.change.toFixed(2)} ({p.changePercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* News Section */}
      {oilNews.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: 8, 
            color: 'var(--text-muted)', 
            textTransform: 'uppercase', 
            letterSpacing: '0.08em',
            borderBottom: '1px solid var(--border-light)',
            paddingBottom: 4
          }}>
            Oil Theater News
          </div>
          {oilNews.map((news, idx) => (
            <a 
              key={idx} 
              href={news.link} 
              target="_blank" 
              rel="noopener noreferrer"
              style={{ 
                textDecoration: 'none', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 2 
              }}
            >
              <div style={{ 
                fontFamily: 'var(--font-display)', 
                fontSize: 11, 
                fontWeight: 600, 
                color: 'var(--text-primary)',
                lineHeight: 1.2
              }}>
                {news.title}
              </div>
              <div style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: 8, 
                color: 'var(--text-muted)' 
              }}>
                {news.sourceName} · {Math.floor((Date.now() - new Date(news.pubDate).getTime()) / 60000)}m ago
              </div>
            </a>
          ))}
        </div>
      )}

      <div style={{ 
        marginTop: 'auto', 
        fontSize: 7, 
        fontFamily: 'var(--font-mono)', 
        color: 'var(--text-muted)',
        textAlign: 'center',
        paddingTop: 8,
        opacity: 0.7
      }}>
        Pricing via Stooq · News via FTG Global Feed
      </div>
    </div>
  );
}
