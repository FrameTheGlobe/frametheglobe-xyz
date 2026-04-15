'use client';

import { useEffect, useRef, useState } from 'react';

type HistoryPoint = {
  timestamp: string;
  yesPrice: number;
  noPrice: number;
  volume?: number;
};

type Props = {
  conditionId: string;
  title: string;
  onClose: () => void;
};

const mono = 'var(--font-mono)';

export default function PolymarketHistoryChart({ conditionId, title, onClose }: Props) {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/polymarket-history?conditionId=${encodeURIComponent(conditionId)}`);
        if (!res.ok) throw new Error('Failed to fetch history');
        const data = await res.json();
        if (mounted) {
          setHistory(data.history || []);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError('Failed to load history');
          setLoading(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [conditionId]);

  // Draw chart when history is loaded
  useEffect(() => {
    if (!history.length || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = 300 * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Get data range
    const yesPrices = history.map(p => p.yesPrice);
    const minPrice = Math.min(...yesPrices, 0);
    const maxPrice = Math.max(...yesPrices, 1);

    // Draw grid lines
    ctx.strokeStyle = 'var(--border-light)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (height - padding.top - padding.bottom) * (i / 5);
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
    }
    ctx.stroke();

    // Draw price line
    ctx.strokeStyle = 'var(--accent)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    history.forEach((point, i) => {
      const x = padding.left + (width - padding.left - padding.right) * (i / (history.length - 1));
      const y = padding.top + (height - padding.top - padding.bottom) * (1 - (point.yesPrice - minPrice) / (maxPrice - minPrice));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw points
    ctx.fillStyle = 'var(--accent)';
    history.forEach((point, i) => {
      const x = padding.left + (width - padding.left - padding.right) * (i / (history.length - 1));
      const y = padding.top + (height - padding.top - padding.bottom) * (1 - (point.yesPrice - minPrice) / (maxPrice - minPrice));
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw labels
    ctx.fillStyle = 'var(--text-secondary)';
    ctx.font = '10px var(--font-mono)';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const price = minPrice + (maxPrice - minPrice) * (1 - i / 5);
      const y = padding.top + (height - padding.top - padding.bottom) * (i / 5);
      ctx.fillText(`${(price * 100).toFixed(0)}%`, padding.left - 8, y + 3);
    }

  }, [history]);

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 20,
    }}>
      <div style={{
        background: 'var(--bg)',
        borderRadius: 12,
        maxWidth: 600,
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        border: '1px solid var(--border)',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
              {title}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
              Probability history (YES price)
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--text-primary)',
            }}
          >
            Close
          </button>
        </div>

        {/* Chart */}
        <div style={{ padding: 20 }}>
          {loading ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="skeleton" style={{ width: '100%', height: '100%' }} />
            </div>
          ) : error ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              {error}
            </div>
          ) : history.length === 0 ? (
            <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No history available yet
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              style={{
                width: '100%',
                height: 300,
                display: 'block',
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--text-muted)',
          fontFamily: mono,
        }}>
          {history.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Current: {(history[history.length - 1].yesPrice * 100).toFixed(1)}%</span>
              <span>Points: {history.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
