'use client';

import { useState } from 'react';

const LIVE_FEEDS = [
  { id: 'aljazeera', name: 'Al Jazeera English', channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg' },
  { id: 'sky', name: 'Sky News Live', channelId: 'UCoMdktPbSTixAyNGwb-UYkQ', videoId: 'YDvsBbKfLPA' },
  { id: 'dw', name: 'DW News', channelId: 'UCknLrEdhRCp1aegoMqRaCZg' },
  { id: 'france24', name: 'France 24', channelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg' },
];

export default function LiveVideoWidget() {
  const [activeFeedId, setActiveFeedId] = useState(LIVE_FEEDS[0].id);
  const activeFeed = LIVE_FEEDS.find(f => f.id === activeFeedId) || LIVE_FEEDS[0];

  return (
    <div className="article-card" style={{ 
      background: 'var(--surface)', 
      border: '1px solid var(--border-light)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header / Feed Selector */}
      <div style={{ 
        padding: '10px 14px', 
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--surface)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="live-dot" />
          <h3 style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: 10, 
            color: 'var(--badge-brk-color)', 
            letterSpacing: '0.08em', 
            textTransform: 'uppercase', 
            margin: 0,
            fontWeight: 600
          }}>
            Live Feed
          </h3>
        </div>

        <select 
          value={activeFeedId}
          onChange={(e) => setActiveFeedId(e.target.value)}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            background: 'var(--bg)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            padding: '2px 6px',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          {LIVE_FEEDS.map(feed => (
            <option key={feed.id} value={feed.id}>{feed.name}</option>
          ))}
        </select>
      </div>

      {/* Video Container (16:9 aspect ratio) */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', background: '#000' }}>
        <iframe
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            border: 'none'
          }}
          src={activeFeed.videoId 
            ? `https://www.youtube.com/embed/${activeFeed.videoId}?autoplay=1&mute=1&playsinline=1`
            : `https://www.youtube.com/embed/live_stream?channel=${activeFeed.channelId}&autoplay=1&mute=1&playsinline=1`
          }
          title={`${activeFeed.name} Live Stream`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
