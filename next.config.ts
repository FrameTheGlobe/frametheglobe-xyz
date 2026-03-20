import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone: bundles the minimal server + node_modules into .next/standalone/.
  // The standalone server.js handles /_next/static/ serving IN-PROCESS, so
  // Hostinger's reverse proxy never needs to know about the _next path at all.
  // Post-build we copy .next/static → .next/standalone/.next/static and
  // public/ → .next/standalone/public/ so the standalone server finds them.
  output: 'standalone',

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
