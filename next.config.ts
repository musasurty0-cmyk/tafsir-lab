import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.quran.com" },
      { protocol: "https", hostname: "cdn.islamic.network" },
    ],
  },
};

export default nextConfig;
