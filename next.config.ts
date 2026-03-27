import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: output:'standalone' is intentionally NOT set here.
  // Hostinger's Apache intercepts /_next/static/ requests before they reach
  // the Node.js process and serves them from the filesystem (public/ webroot).
  // Standalone mode copies static files to .next/standalone/.next/static/ —
  // the wrong location. The build script copies .next/static → public/_next/static
  // so Apache finds them. Node.js handles only SSR pages and API routes.

  trailingSlash: false,
  reactStrictMode: true,
  compress: true,
  poweredByHeader: false,

  // Safety for Hostinger: images are often served better unoptimized
  // if native libraries like sharp are missing in the server environment.
  images: { unoptimized: true },

  // rss-parser → xml2js → sax tries to modify global intrinsics at load time.
  // Hostinger's Node.js sandbox (SES) strips those modifications and logs
  // "Removing unpermitted intrinsics", which breaks /api/rss and /api/news.
  // Marking them external lets them run through Node's native require() instead
  // of webpack's sandboxed module wrapper, which is what triggers the restriction.
  serverExternalPackages: ['rss-parser', 'xml2js', 'sax'],

  async headers() {
    // Content-Security-Policy:
    // • script-src: 'unsafe-inline' + 'unsafe-eval' required for Next.js
    //   hydration chunks and TradingView widgets respectively.
    // • frame-src: YouTube live embeds and TradingView chart iframes.
    // • connect-src: all external API calls are proxied through /api/* (self);
    //   the only direct browser connection is the SSE stream, also self.
    // • img-src https: covers OSM tiles (Leaflet), YouTube thumbnails, favicons.
    const CSP = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://s.tradingview.com https://cdn.tradingview.com",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "img-src 'self' data: blob: https:",
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://s.tradingview.com https://www.tradingview.com",
      "connect-src 'self'",
      "worker-src 'self' blob:",
      "media-src 'self' https://www.youtube.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ');

    const SECURITY_HEADERS = [
      { key: 'Content-Security-Policy',         value: CSP },
      { key: 'X-Frame-Options',                  value: 'DENY' },
      { key: 'X-Content-Type-Options',            value: 'nosniff' },
      { key: 'Referrer-Policy',                   value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy',                value: 'camera=(), microphone=(), geolocation=(), payment=()' },
      { key: 'Strict-Transport-Security',         value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-DNS-Prefetch-Control',            value: 'on' },
    ];

    return [
      {
        // Static chunks are content-hashed — safe to cache forever.
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Social card image - allow caching for X crawler
        source: '/img/social-card.png',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600, s-maxage=3600' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
      {
        // HTML pages must never be cached. Each rebuild changes the chunk
        // filenames embedded in the HTML; serving stale HTML causes every
        // JS/CSS chunk to 404 and breaks React hydration.
        source: '/((?!_next/static|_next/image|favicon\\.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma',        value: 'no-cache' },
          { key: 'Expires',       value: '0' },
          ...SECURITY_HEADERS,
        ],
      },
    ];
  },
};

export default nextConfig;
