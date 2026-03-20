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
    return [
      {
        // Static chunks are content-hashed — safe to cache forever.
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // HTML pages must never be cached. Each rebuild changes the chunk
        // filenames embedded in the HTML; serving stale HTML causes every
        // JS/CSS chunk to 404 and breaks React hydration.
        source: '/((?!_next/static|_next/image|favicon\\.ico).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
        ],
      },
    ];
  },
};

export default nextConfig;
