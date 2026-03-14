import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Compress responses in production
  compress: true,

  // Security & caching headers
  async headers() {
    return [
      {
        // Static assets — long-lived cache
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // All pages/API routes
        source: "/:path*",
        headers: [
          // Override any host-level CSP that blocks Next.js chunk loading.
          // 'unsafe-eval' is needed by some Next.js internals in certain
          // hosting environments; 'unsafe-inline' covers injected styles.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Scripts: self + Next.js chunks + any CDN fallbacks
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              // Styles: self + inline (Next.js injects critical CSS)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + data URIs + tile servers + ADS-B
              "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org https://unpkg.com",
              // Connections: self + all feeds + ADS-B APIs + SSE
              "connect-src 'self' https://adsb.lol https://opensky-network.org https://fonts.googleapis.com https://fonts.gstatic.com",
              // Frames
              "frame-ancestors 'none'",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
