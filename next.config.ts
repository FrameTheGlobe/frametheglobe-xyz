import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standard Next.js server build for Hostinger
  trailingSlash: false,
  reactStrictMode: true,

  // Compress responses in production
  compress: true,

  // Remove the "X-Powered-By: Next.js" header
  poweredByHeader: false,

  // Safety for Hostinger: images are often served better unoptimized
  // if native libraries like sharp are missing in the server environment.
  images: { unoptimized: true },

};

export default nextConfig;
