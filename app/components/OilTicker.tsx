'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useVisibilityPolling } from '@/lib/use-visibility-polling';

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
        return text.includes('oil price') || text.includes('crude oil') || 
               text.includes('brent crude') || text.includes('wti') || 
               text.includes('opec') || text.includes('energy output') ||
               text.includes('natural gas');
      })
      .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
      .slice(0, 3);
  }, [items]);

  const fetchPrices = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/market');
      if (!res.ok) throw new Error('Fetch failed');
      setPrices(await res.json());
      setError(false);
    } catch (err) {
      console.error('[FTG] Oil price fetch error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);
  useVisibilityPolling(fetchPrices, 60_000);

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
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 0, 
        maxHeight: 400, 
        overflowY: 'auto',
        paddingRight: 4,
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--border-light) transparent'
      }}>
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
          let Icon = "🛢️";
          if (p.symbol === 'NG.F' || p.symbol === 'TG.F') Icon = "🔥";
          if (p.symbol === 'RB.F' || p.symbol === 'HO.F') Icon = "⛽";
          if (p.symbol === 'UX.F') Icon = "⚛️";
          if (p.symbol === 'LU.F') Icon = "🪨";
          if (p.symbol === 'USO.US') Icon = "📈";

          return (
            <div key={p.symbol} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '10px 0',
              borderBottom: '1px solid var(--border-light)',
              transition: 'background 0.2s'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>{Icon}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: 12, 
                    fontWeight: 700, 
                    color: 'var(--text-primary)' 
                  }}>
                    {p.name}
                  </span>
                  <span style={{ 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: 9, 
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.02em'
                  }}>
                    {p.symbol} · {p.currency}
                  </span>
                </div>
              </div>
              
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ 
                  fontFamily: 'var(--font-mono)', 
                  fontSize: 15, 
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em'
                }}>
                  {p.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 4, 
                  justifyContent: 'flex-end',
                  fontFamily: 'var(--font-mono)', 
                  fontSize: 10, 
                  fontWeight: 600,
                  color: isUp ? '#27ae60' : '#c93a20'
                }}>
                   <span>{isUp ? '▲' : '▼'}</span>
                   <span>{Math.abs(p.change).toFixed(2)}</span>
                   <span style={{ opacity: 0.8 }}>({Math.abs(p.changePercent).toFixed(2)}%)</span>
                </div>
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
