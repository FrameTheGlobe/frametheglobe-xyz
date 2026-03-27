'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from '@/lib/use-visibility-polling';

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

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/market');
      if (res.ok) {
        const data = await res.json();
        setMarkets(data.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to fetch market data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);
  useVisibilityPolling(fetchMarkets, 120_000);

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
