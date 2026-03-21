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
            <svg width="15" height="15" viewBox="0 0 192 192" fill="currentColor" aria-hidden>
              <path d="M141.537 88.9883C140.71 88.5919 139.87 88.2104 139.019 87.8451C137.537 60.5382 122.616 44.905 97.5619 44.745C97.4484 44.7443 97.3355 44.7443 97.222 44.7443C82.2364 44.7443 69.7731 51.1409 62.102 62.7807L75.881 72.2328C81.6116 63.5383 90.6052 61.6848 97.2286 61.6848C97.3051 61.6848 97.3819 61.6848 97.4576 61.6855C105.707 61.7381 111.932 64.1366 115.961 68.814C118.893 72.2193 120.854 76.925 121.825 82.8638C114.511 81.6207 106.601 81.2385 98.145 81.7233C74.3247 83.0954 59.0111 96.9879 60.0396 116.292C60.5615 126.084 65.4397 134.508 73.775 140.011C80.8224 144.663 89.899 146.938 99.3323 146.423C111.79 145.74 121.563 140.987 128.381 132.296C133.559 125.696 136.834 117.143 138.28 106.366C144.217 109.949 148.617 114.664 151.047 120.332C155.179 129.967 155.42 145.8 142.501 158.708C131.182 170.016 117.576 174.908 97.0135 175.059C74.2042 174.89 56.9538 167.575 45.7381 153.317C35.2355 139.966 29.8077 120.682 29.6052 96C29.8077 71.3178 35.2355 52.0336 45.7381 38.6827C56.9538 24.4249 74.2039 17.11 97.0132 16.9405C119.988 17.1113 137.539 24.4614 149.184 38.788C154.894 45.8136 159.199 54.6488 162.037 64.9503L178.184 60.6422C174.744 47.9622 169.331 37.0357 161.965 27.974C147.036 9.60668 125.202 0.195148 97.0695 0H96.9569C68.8816 0.19447 47.2921 9.6418 32.7883 28.0793C19.8819 44.4864 13.2244 67.3157 13.0007 95.9325L13 96L13.0007 96.0675C13.2244 124.684 19.8819 147.514 32.7883 163.921C47.2921 182.358 68.8816 191.806 96.9569 192H97.0695C122.03 191.827 139.624 185.292 154.118 170.811C173.081 151.866 172.51 128.119 166.26 113.541C161.776 103.087 153.227 94.5962 141.537 88.9883ZM98.4405 129.507C88.0005 130.095 77.1544 125.409 76.6196 115.372C76.2232 107.93 81.9158 99.626 99.0812 98.6368C101.047 98.5234 102.976 98.468 104.871 98.468C111.106 98.468 116.939 99.0737 122.242 100.233C120.264 124.935 108.662 128.946 98.4405 129.507Z" />
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
