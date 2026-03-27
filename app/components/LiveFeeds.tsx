'use client';

import { useState } from 'react';

const LIVE_STREAMS = [
  {
    id: 'feed-1',
    videoId: 'Khfdb7qUvjk',
    label: 'Live Feed 1',
    description: 'Breaking News',
  },
  {
    id: 'feed-2',
    videoId: 'fIurYTprwzg',
    label: 'Live Feed 2',
    description: 'World Report',
  },
  {
    id: 'feed-3',
    videoId: 'gmtlJ_m2r5A',
    label: 'Live Feed 3',
    description: 'Global Affairs',
  },
  {
    id: 'feed-4',
    videoId: '-zGuR1qVKrU',
    label: 'Live Feed 4',
    description: 'Geopolitics',
  },
];

type LayoutMode = '2x2' | 'single' | 'pip';

export default function LiveFeeds() {
  const [collapsed, setCollapsed] = useState(false);
  const [layout, setLayout] = useState<LayoutMode>('2x2');
  const [focused, setFocused] = useState<string>(LIVE_STREAMS[0].id);
  const [muted, setMuted] = useState(true);

  const focusedStream = LIVE_STREAMS.find(s => s.id === focused) ?? LIVE_STREAMS[0];

  return (
    <section style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-light)',
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 14,
    }}>

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: collapsed ? 'none' : '1px solid var(--border-light)',
        background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="live-dot" />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#e74c3c',
            fontWeight: 700,
          }}>
            Live Feeds
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--text-muted)',
            letterSpacing: '0.06em',
          }}>
            // {LIVE_STREAMS.length} streams
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Layout toggle */}
          {['2x2', 'single', 'pip'].map(l => (
            <button
              key={l}
              onClick={() => setLayout(l as LayoutMode)}
              title={l === '2x2' ? 'Grid' : l === 'single' ? 'Focus' : 'Picture-in-Picture'}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                padding: '3px 7px',
                background: layout === l ? 'var(--accent)' : 'var(--bg)',
                color: layout === l ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border-light)',
                borderRadius: 3,
                cursor: 'pointer',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {l === '2x2' ? '⊞' : l === 'single' ? '□' : '⊡'}
            </button>
          ))}

          {/* Mute toggle */}
          <button
            onClick={() => setMuted(m => !m)}
            title={muted ? 'Unmute' : 'Mute'}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              padding: '3px 7px',
              background: muted ? 'var(--bg)' : 'rgba(231,76,60,0.15)',
              color: muted ? 'var(--text-muted)' : '#e74c3c',
              border: `1px solid ${muted ? 'var(--border-light)' : 'rgba(231,76,60,0.4)'}`,
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>

          {/* Collapse */}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              padding: '3px 8px',
              background: 'var(--bg)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border-light)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* ── Feed Grid ───────────────────────────────────────────── */}
      {!collapsed && (
        <div>
          {/* 2x2 Grid Layout */}
          {layout === '2x2' && (
            <div className="ftg-livefeed-grid" style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
              background: 'var(--border)',
            }}>
              {LIVE_STREAMS.map(stream => (
                <FeedCell
                  key={stream.id}
                  stream={stream}
                  muted={muted}
                  onClick={() => { setFocused(stream.id); setLayout('single'); }}
                />
              ))}
            </div>
          )}

          {/* Single focused layout */}
          {layout === 'single' && (
            <div>
              <FeedCell stream={focusedStream} muted={muted} large />
              {/* Stream selector row */}
              <div style={{
                display: 'flex',
                borderTop: '1px solid var(--border-light)',
                background: 'var(--bg)',
              }}>
                {LIVE_STREAMS.map(stream => (
                  <button
                    key={stream.id}
                    onClick={() => setFocused(stream.id)}
                    style={{
                      flex: 1,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      padding: '7px 4px',
                      background: focused === stream.id ? 'var(--accent)' : 'transparent',
                      color: focused === stream.id ? '#fff' : 'var(--text-muted)',
                      border: 'none',
                      borderRight: '1px solid var(--border-light)',
                      cursor: 'pointer',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {stream.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* PiP layout: one large + three small */}
          {layout === 'pip' && (
            <div style={{ display: 'flex', gap: 1, background: 'var(--border)' }}>
              <div style={{ flex: 3 }}>
                <FeedCell stream={focusedStream} muted={muted} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {LIVE_STREAMS.filter(s => s.id !== focusedStream.id).map(stream => (
                  <div
                    key={stream.id}
                    onClick={() => setFocused(stream.id)}
                    style={{ cursor: 'pointer', flex: 1 }}
                  >
                    <FeedCell stream={stream} muted={muted} compact />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ── Sub-component: individual feed cell ─────────────────────────────────────
function FeedCell({
  stream,
  muted,
  large,
  compact,
  onClick,
}: {
  stream: typeof LIVE_STREAMS[0];
  muted: boolean;
  large?: boolean;
  compact?: boolean;
  onClick?: () => void;
}) {
  const muteParam = muted ? '1' : '0';
  const src = `https://www.youtube.com/embed/${stream.videoId}?mute=${muteParam}&autoplay=1&playsinline=1&rel=0&modestbranding=1`;

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        background: '#000',
        paddingTop: compact ? '75%' : '56.25%',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <iframe
        key={`${stream.id}-${muteParam}`} // re-mount when mute changes
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%', height: '100%',
          border: 'none',
          display: 'block',
        }}
        src={src}
        title={stream.label}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
      {/* Label overlay */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
        padding: compact ? '12px 8px 5px' : '20px 10px 7px',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: compact ? 9 : 11,
          color: '#fff',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}>
          <span style={{
            width: 5, height: 5,
            borderRadius: '50%',
            background: '#e74c3c',
            display: 'inline-block',
            flexShrink: 0,
          }} />
          {compact ? stream.label : `${stream.label} — ${stream.description}`}
        </div>
      </div>
      {/* Click overlay hint */}
      {onClick && (
        <div style={{
          position: 'absolute',
          top: 6, right: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'rgba(255,255,255,0.5)',
          background: 'rgba(0,0,0,0.4)',
          padding: '2px 5px',
          borderRadius: 2,
          letterSpacing: '0.06em',
        }}>
          FOCUS
        </div>
      )}
    </div>
  );
}
