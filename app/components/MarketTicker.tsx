'use client';

import { useState, useEffect } from 'react';

type MarketData = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
};

export default function MarketTicker() {
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await fetch('/api/market');
        if (res.ok) {
          const data = await res.json();
          // Take only top 4-5 key markets for ticker
          setMarkets(data.slice(0, 5));
        }
      } catch (error) {
        console.error('Failed to fetch market data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
    // Refresh every 2 minutes
    const interval = setInterval(fetchMarkets, 120000);
    return () => clearInterval(interval);
  }, []);

  if (loading || markets.length === 0) {
    return (
      <div className="ftg-market-ticker-loading">
        LOADING MARKET DATA...
      </div>
    );
  }

  const renderItems = () => (
    <>
      {markets.map((m) => {
        const up = m.change >= 0;
        return (
          <span key={m.symbol} className="ftg-market-item">
            <span className="ftg-market-name">{m.name}</span>
            <span className="ftg-market-price">${m.price.toFixed(2)}</span>
            <span className={up ? 'ftg-market-change up' : 'ftg-market-change down'}>
              {up ? '▲' : '▼'} {Math.abs(m.changePercent).toFixed(2)}%
            </span>
          </span>
        );
      })}
    </>
  );

  return (
    <div className="ftg-market-ticker" role="status" aria-label="Market ticker">
      <span className="ftg-market-label">MARKETS</span>
      <div className="ftg-market-track-wrap">
        <div className="ftg-market-track">
          {renderItems()}
          {renderItems()}
        </div>
      </div>
    </div>
  );
}
