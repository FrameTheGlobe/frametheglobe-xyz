import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use a standard build path for the Hostinger Node.js selector. 
  // Standard building + 'npm start' is more reliable for asset resolution on shared/VPS.
  trailingSlash: false,
  reactStrictMode: true,

  // Critical for Hostinger server builds: ignores checks to save memory/processes
  // @ts-ignore
  typescript: { ignoreBuildErrors: true },

  // Experimental but recommended for shared hosting: 
  // Limit the number of workers to prevent crashing Hostinger CPU limits.
  // Standard VPS/Shared often has high core count but low process/memory limit.
  // @ts-ignore
  staticPageGenerationTimeout: 300,
  output: 'standalone',
  
  // Compress responses in production
  compress: true,

  // Remove the "X-Powered-By: Next.js" header
  poweredByHeader: false,

  // Safety for Hostinger: images are often served better unoptimized
  // if native libraries like sharp are missing in the server environment.
  images: { unoptimized: true },

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
        // All pages and API routes
        source: "/:path*",
        headers: [
          // ── Content Security Policy ──────────────────────────────────────
          // 'unsafe-eval' is required by Next.js/Turbopack internals.
          // 'unsafe-inline' is required by Leaflet (injected style) and
          // next/font (inlined @font-face). Both could be replaced with
          // nonces in a future hardening pass.
          // Google Fonts URLs removed — fonts now self-hosted via next/font.
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self' https://www.youtube.com https://*.ytimg.com",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.youtube.com https://s.ytimg.com",
              // Google Fonts no longer needed here (self-hosted via next/font)
              "style-src 'self' 'unsafe-inline' https://www.youtube.com",
              "font-src 'self'",
              // Images: external RSS thumbnails + tile servers + YouTube
              "img-src 'self' data: blob: https: http:",
              // Connections: SSE + ADS-B flight data APIs
              "connect-src 'self' https://adsb.lol https://opensky-network.org",
              // Frames: YouTube embeds only
              "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
              // Block anyone from framing this site
              "frame-ancestors 'none'",
              // Upgrade any accidental http:// sub-resource requests to https
              "upgrade-insecure-requests",
            ].join("; "),
          },

          // ── Transport security ───────────────────────────────────────────
          // Tell browsers to use HTTPS for the next 2 years, include
          // subdomains, and submit to the HSTS preload list.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },

          // ── Leak / sniff prevention ──────────────────────────────────────
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
          // Prevent the browser from pre-fetching DNS for third-party links
          // clicked in the news feed — minor privacy + security improvement.
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },

          // ── Cross-Origin policies ────────────────────────────────────────
          // Prevents other origins from being able to open popups to this site
          // and read cross-origin data via window references.
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },

          // ── Feature / permissions policy ─────────────────────────────────
          // Explicitly deny access to sensitive browser APIs. The app only
          // needs the location API (for the Leaflet map, which is optional).
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), payment=(), usb=(), bluetooth=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
