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
              "default-src 'self' https://www.youtube.com https://*.ytimg.com",
              // Scripts: self + Next.js chunks + YouTube
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com",
              // Styles: self + inline + Fonts + YouTube
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://www.youtube.com",
              // Fonts
              "font-src 'self' https://fonts.gstatic.com",
              // Images: self + data URIs + tile servers + RSS thumbnails + YouTube
              "img-src 'self' data: blob: https: http:",
              // Connections: self + all feeds + ADS-B APIs + SSE
              "connect-src 'self' https://adsb.lol https://opensky-network.org https://fonts.googleapis.com https://fonts.gstatic.com",
              // Frames: allow embedding YouTube
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
              // Prevent others from framing us
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
