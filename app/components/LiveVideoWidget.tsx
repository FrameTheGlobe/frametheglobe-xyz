'use client';

import { useEffect, useState } from 'react';

type LiveFeed = {
  id: string;
  name: string;
  channelId: string;
  videoId: string | null;
  link: string | null;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  embedUrl: string;
  source: 'override' | 'rss' | 'fallback';
};

export default function LiveVideoWidget() {
  const [feeds, setFeeds] = useState<LiveFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFeedId, setActiveFeedId] = useState<string>('');
  // Tracks which feeds the user has explicitly clicked to load — avoids
  // mounting any iframe until the user opts in, saving ~500KB of YouTube JS.
  const [loaded, setLoaded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/live-feeds');
        const data = await res.json();
        const list = Array.isArray(data?.feeds) ? (data.feeds as LiveFeed[]) : [];
        if (cancelled) return;
        setFeeds(list);
        setActiveFeedId(list[0]?.id ?? '');
      } catch {
        if (cancelled) return;
        setFeeds([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const activeFeed = feeds.find(f => f.id === activeFeedId) ?? feeds[0] ?? null;
  const isLoaded     = loaded.has(activeFeedId);

  const handlePlay = () => {
    setLoaded(prev => new Set(prev).add(activeFeedId));
  };

  const handleFeedChange = (id: string) => {
    setActiveFeedId(id);
    // Don't auto-load the new feed — let the user click play
  };

  if (loading) {
    return (
      <div className="article-card" style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light)' }}>
          <div className="skeleton" style={{ height: 10, width: 120 }} />
        </div>
        <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }} />
      </div>
    );
  }

  if (!activeFeed) {
    return (
      <div className="article-card" style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-light)',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          Live feeds are temporarily unavailable. Retry in a moment.
        </div>
      </div>
    );
  }

  return (
    <div className="article-card" style={{
      background:    'var(--surface)',
      border:        '1px solid var(--border-light)',
      overflow:      'hidden',
      display:       'flex',
      flexDirection: 'column',
    }}>
      {/* Header / Feed Selector */}
      <div style={{
        padding:        '10px 14px',
        borderBottom:   '1px solid var(--border-light)',
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'center',
        background:     'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="live-dot" />
          <h3 style={{
            fontFamily:    'var(--font-mono)',
            fontSize:      10,
            color:         'var(--brand-blue)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            margin:        0,
            fontWeight:    600,
          }}>
            Live Feed
          </h3>
        </div>

        <select
          id="live-feed-selector"
          name="live-feed-selector"
          value={activeFeedId}
          onChange={(e) => handleFeedChange(e.target.value)}
          style={{
            fontFamily:  'var(--font-mono)',
            fontSize:    10,
            background:  'var(--bg)',
            color:       'var(--text-primary)',
            border:      '1px solid var(--border)',
            borderRadius: 3,
            padding:     '2px 6px',
            outline:     'none',
            cursor:      'pointer',
          }}
        >
          {feeds.map(feed => (
            <option key={feed.id} value={feed.id}>{feed.name}</option>
          ))}
        </select>
      </div>

      {/* Video Container (16:9 aspect ratio) */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
        {isLoaded ? (
          <iframe
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            src={activeFeed.embedUrl}
            title={`${activeFeed.name} Live Stream`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          /* Facade: thumbnail + play button — zero YouTube JS until clicked */
          <button
            onClick={handlePlay}
            aria-label={`Play ${activeFeed.name}`}
            style={{
              position:   'absolute',
              inset:      0,
              width:      '100%',
              height:     '100%',
              border:     'none',
              padding:    0,
              cursor:     'pointer',
              background: '#000',
              display:    'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Thumbnail */}
            {activeFeed.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeFeed.thumbnailUrl}
                alt={activeFeed.name}
                style={{
                  position:   'absolute',
                  inset:      0,
                  width:      '100%',
                  height:     '100%',
                  objectFit:  'cover',
                  opacity:    0.7,
                }}
              />
            )}

            {/* Play button circle */}
            <div style={{
              position:        'relative',
              zIndex:          1,
              width:           52,
              height:          52,
              borderRadius:    '50%',
              background:      'rgba(0,0,0,0.75)',
              border:          '2px solid rgba(255,255,255,0.8)',
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              transition:      'transform 0.15s ease, background 0.15s ease',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(220,30,30,0.85)'; (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.75)'; (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
            >
              {/* SVG play triangle */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>

            {/* Feed name label */}
            <span style={{
              position:      'absolute',
              bottom:        10,
              left:          0,
              right:         0,
              textAlign:     'center',
              fontSize:      10,
              color:         'rgba(255,255,255,0.8)',
              fontFamily:    'var(--font-mono)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>
              {activeFeed.name} · Click to load
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
