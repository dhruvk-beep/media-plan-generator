import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed "output: export" and basePath — now deploying on Vercel with API routes
  images: { unoptimized: true },
};

export default nextConfig;
