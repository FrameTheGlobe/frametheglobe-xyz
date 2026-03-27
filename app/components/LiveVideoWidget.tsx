'use client';

import { useState } from 'react';

const LIVE_FEEDS = [
  { id: 'aljazeera', name: 'Al Jazeera English', channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
  { id: 'sky',       name: 'Sky News Live',       channelId: 'UCoMdktPbSTixAyNGwb-UYkQ', videoId: 'YDvsBbKfLPA' },
  { id: 'dw',        name: 'DW News',             channelId: 'UCknLrEdhRCp1aegoMqRaCZg' },
  { id: 'france24',  name: 'France 24',           channelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg' },
];

function thumbnailUrl(feed: typeof LIVE_FEEDS[0]): string {
  // Prefer the direct videoId thumbnail; fall back to a placeholder for channels
  if (feed.videoId) return `https://img.youtube.com/vi/${feed.videoId}/hqdefault.jpg`;
  return `https://img.youtube.com/vi/0/hqdefault.jpg`; // generic fallback
}

function embedSrc(feed: typeof LIVE_FEEDS[0]): string {
  if (feed.videoId) {
    return `https://www.youtube.com/embed/${feed.videoId}?autoplay=1&mute=1&playsinline=1`;
  }
  return `https://www.youtube.com/embed/live_stream?channel=${feed.channelId}&autoplay=1&mute=1&playsinline=1`;
}

export default function LiveVideoWidget() {
  const [activeFeedId, setActiveFeedId] = useState(LIVE_FEEDS[0].id);
  // Tracks which feeds the user has explicitly clicked to load — avoids
  // mounting any iframe until the user opts in, saving ~500KB of YouTube JS.
  const [loaded, setLoaded] = useState<Set<string>>(new Set());

  const activeFeed   = LIVE_FEEDS.find(f => f.id === activeFeedId) ?? LIVE_FEEDS[0];
  const isLoaded     = loaded.has(activeFeedId);

  const handlePlay = () => {
    setLoaded(prev => new Set(prev).add(activeFeedId));
  };

  const handleFeedChange = (id: string) => {
    setActiveFeedId(id);
    // Don't auto-load the new feed — let the user click play
  };

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
          {LIVE_FEEDS.map(feed => (
            <option key={feed.id} value={feed.id}>{feed.name}</option>
          ))}
        </select>
      </div>

      {/* Video Container (16:9 aspect ratio) */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
        {isLoaded ? (
          <iframe
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
            src={embedSrc(activeFeed)}
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
            {activeFeed.videoId && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl(activeFeed)}
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
