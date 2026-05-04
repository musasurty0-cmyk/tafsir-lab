import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.quran.com" },
      { protocol: "https", hostname: "cdn.islamic.network" },
    ],
  },
  async rewrites() {
    return [
      // Serve the static marketing landing page at the root URL
      { source: "/", destination: "/landing.html" },
    ];
  },
};

export default nextConfig;
