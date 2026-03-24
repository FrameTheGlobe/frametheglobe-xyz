'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FlashBriefPayload } from '@/app/api/flash-brief/route';

type FeedItem = {
  title: string;
  summary?: string;
  sourceName?: string;
  region?: string;
  pubDate?: string;
  relevanceScore?: number;
};

interface Props { items: FeedItem[]; }

function useTypewriter(text: string, speed = 16) {
  const [displayed, setDisplayed] = useState('');
  const raf = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const tick = () => {
      if (i < text.length) {
        setDisplayed(text.slice(0, ++i));
        raf.current = setTimeout(tick, speed);
      }
    };
    raf.current = setTimeout(tick, 60);
    return () => { if (raf.current) clearTimeout(raf.current); };
  }, [text, speed]);
  return displayed;
}

export default function FlashBrief({ items }: Props) {
  const [data,        setData]        = useState<FlashBriefPayload | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [collapsed,   setCollapsed]   = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const briefText = useTypewriter(data?.brief ?? '', 12);

  const load = useCallback(async (force = false) => {
    if (!items.length) return;
    setLoading(true);
    try {
      const res = await fetch('/api/flash-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.slice(0, 20), forceRefresh: force }),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
      setLastRefresh(new Date());
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }, [items]);

  useEffect(() => { if (items.length > 0) load(); }, [load, items.length]);
  useEffect(() => {
    const id = setInterval(() => load(), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const sigColor = data?.generatedBy === 'groq-ai' ? '#22c55e' : '#f59e0b';

  return (
    <section style={{
      background: 'var(--bg)',
      border: '1px solid var(--border-light)',
      borderLeft: '3px solid #e74c3c',
      borderRadius: '0 4px 4px 0',
      overflow: 'hidden',
    }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 14px',
        borderBottom: collapsed ? 'none' : '1px solid var(--border-light)',
        background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
            background: loading ? '#f97316' : data ? '#e74c3c' : '#6b7280',
            boxShadow: `0 0 6px ${loading ? '#f97316' : data ? '#e74c3c80' : 'transparent'}`,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 900,
            letterSpacing: '0.18em', color: '#e74c3c', textTransform: 'uppercase',
          }}>
            ⚡ Flash Brief
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 8,
            color: 'var(--text-muted)', letterSpacing: '0.08em',
          }}>
            // AI Situation Summary · Updates hourly
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 8,
              color: sigColor,
              background: `${sigColor}15`,
              border: `1px solid ${sigColor}35`,
              padding: '1px 6px', borderRadius: 2, letterSpacing: '0.06em',
            }}>
              {data.generatedBy === 'groq-ai' ? '🤖 AI' : '🔢 ALG'}
            </span>
          )}
          {lastRefresh && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-muted)' }}>
              {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading || !items.length}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 8px',
              background: 'var(--bg)', color: loading ? 'var(--text-muted)' : 'var(--text-primary)',
              border: '1px solid var(--border-light)', borderRadius: 3,
              cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.06em',
            }}
          >
            {loading ? '⟳' : '⟳'}
          </button>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 7px',
              background: 'var(--bg)', color: 'var(--text-muted)',
              border: '1px solid var(--border-light)', borderRadius: 3, cursor: 'pointer',
            }}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{
          padding: '14px 16px',
          height: 256,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          {loading && !data && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)',
              letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              Generating intelligence brief…
            </div>
          )}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
              {/* Main brief text — fixed region, text fills in */}
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: 'var(--text-primary)',
                lineHeight: 1.7,
                margin: 0,
                fontWeight: 400,
                flex: 1,
                overflow: 'hidden',
              }}>
                {(briefText || '').slice(0, 600) || <span style={{ color: 'var(--text-muted)', opacity: 0.5 }}>▋</span>}
              </p>

              {/* Footer */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
                paddingTop: 10, borderTop: '1px solid var(--border-light)',
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: 'var(--text-muted)', letterSpacing: '0.06em',
                }}>
                  {data.storiesAnalysed} stories · {new Date(data.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {data.topThemes.length > 0 && (
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {data.topThemes.map(t => (
                      <span key={t} style={{
                        fontFamily: 'var(--font-mono)', fontSize: 8, fontWeight: 700,
                        color: '#e74c3c', background: 'rgba(231,76,60,0.08)',
                        border: '1px solid rgba(231,76,60,0.25)',
                        padding: '1px 6px', borderRadius: 2, letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
