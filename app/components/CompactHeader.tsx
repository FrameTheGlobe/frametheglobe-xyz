'use client';

import MarketTicker from './MarketTicker';

interface CompactHeaderProps {
  hasMounted: boolean;
  loading: boolean;
  missionTime: string | null;
  theme: 'light' | 'dark';
  storyCount: number;
  sourceCount: number;
  onThemeToggle: () => void;
  onRefresh: () => void;
}

export default function CompactHeader({ 
  hasMounted, 
  loading, 
  missionTime, 
  theme, 
  storyCount,
  sourceCount,
  onThemeToggle, 
  onRefresh 
}: CompactHeaderProps) {
  return (
    <div className="ftg-compact-header">
      <div className="ftg-compact-left">
        <h1
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="ftg-compact-brand"
        >
          FrameTheGlobe<span className="ftg-compact-brand-accent">News</span>
          <span className="ftg-beta-badge">BETA</span>
        </h1>
        <span className="ftg-compact-meta">
          v6.0.1 · {storyCount.toLocaleString()} stories · {sourceCount} sources
        </span>
        <div className="ftg-compact-live">
          <span
            className={`ftg-compact-live-dot ${(hasMounted && !loading) ? 'live-dot hud-glitch-active' : ''}`}
            style={{
              background: (hasMounted && loading) ? 'var(--neon-amber)' : 'var(--neon-green)',
            }}
          />
          <span
            className={`ftg-compact-live-text ${(hasMounted && loading) ? 'loading' : ''}`}
          >
            {(hasMounted && loading) ? 'SYNCING' : 'LIVE'}
          </span>
        </div>
      </div>

      <div className="ftg-compact-ticker-wrap">
        <MarketTicker />
      </div>

      <div className="ftg-compact-right">
        <div className="ftg-compact-time-wrap">
          <span className="ftg-compact-time-label">UTC</span>
          <span className="ftg-compact-time-value">
            {hasMounted ? (missionTime || '--:--:--') : '--:--:--'}
          </span>
        </div>

        <div className="ftg-compact-divider" />

        <div className="ftg-compact-actions" aria-label="Social links">
          <a
            href="https://x.com/FrameTheGlobe"
            target="_blank"
            rel="noopener noreferrer"
            className="icon-link-ghost"
            title="X"
            aria-label="FrameTheGlobe on X"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.842L2.25 2.25h6.993l4.261 5.633L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
          </a>
          <a
            href="https://www.threads.net/@frametheglobe"
            target="_blank"
            rel="noopener noreferrer"
            className="icon-link-ghost"
            title="Threads"
            aria-label="FrameTheGlobe on Threads"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </a>
          <a
            href="https://www.frametheglobenews.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="icon-link-ghost"
            title="Substack"
            aria-label="FrameTheGlobe Newsletter"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
            </svg>
          </a>
        </div>

        <div className="ftg-compact-actions">
          <button 
            className="icon-link-ghost" 
            onClick={onThemeToggle} 
            title="THEME_TOGGLE"
            aria-label="Toggle theme"
          >
            {hasMounted && theme === 'light' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            ) : hasMounted && theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="18.36" x2="5.64" y2="19.78"></line><line x1="18.36" y1="4.22" x2="19.78" y2="5.64"></line></svg>
            ) : (
              <div style={{ width: 16, height: 16, opacity: 0.2 }} />
            )}
          </button>
          <button 
            onClick={onRefresh} 
            disabled={loading}
            className="hud-action-btn-refined"
            style={{ height: 28, fontSize: 10, padding: '0 10px' }}
          >
            {loading ? <span className="loader-dots">···</span> : 'Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}
