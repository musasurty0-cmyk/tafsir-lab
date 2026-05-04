import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.quran.com" },
      { protocol: "https", hostname: "cdn.islamic.network" },
    ],
  },

  async rewrites() {
    // beforeFiles runs before the App Router, so "/" always serves the static
    // landing page without app/page.tsx getting a chance to redirect.
    return {
      beforeFiles: [
        { source: "/", destination: "/landing.html" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
