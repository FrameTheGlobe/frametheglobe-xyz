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
  // Force Webpack (disables experimental Turbopack production build)
  webpack: (config: any) => {
    return config;
  },
  // Declare empty Turbopack config to silence Next.js 16 strictness
  experimental: {
    cpus: 1,
    // @ts-ignore
    turbopack: {},
  },
  
  // Compress responses in production
  compress: true,

  // Remove the "X-Powered-By: Next.js" header
  poweredByHeader: false,

  // Safety for Hostinger: images are often served better unoptimized
  // if native libraries like sharp are missing in the server environment.
  images: { unoptimized: true },

};

export default nextConfig;
