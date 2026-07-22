import type { NextConfig } from "next";

// ── Firebase Auth first-party proxy ──────────────────────────────────────────
// iOS/iPadOS (all browsers = WebKit) partitions storage per-domain. When the
// Firebase authDomain (`<project>.firebaseapp.com`) differs from the app's own
// domain, signInWithRedirect/Popup write their pending-sign-in state to
// firebaseapp.com storage, which WebKit then hides from our domain — so
// getRedirectResult resolves to null and sign-in silently fails on iPad.
//
// Fix: proxy Firebase's auth handler (`/__/auth/*`, `/__/firebase/*`) through
// THIS domain, and point NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN at this domain too.
// The auth iframe/handler then runs first-party and iOS sign-in works.
//
// Proxy target defaults to `<projectId>.firebaseapp.com`; override with
// FIREBASE_AUTH_PROXY_TARGET if the project uses a non-default auth host.
const authProxyTarget =
  process.env.FIREBASE_AUTH_PROXY_TARGET ||
  (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    ? `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`
    : null);

const nextConfig: NextConfig = {
  // MuPDF's WASM glue (used client-side to rasterise book PDFs) imports Node's
  // built-in "module" inside a Node-only branch. Stub it for the BROWSER build
  // so turbopack can resolve it; the branch never runs in a browser.
  turbopack: {
    resolveAlias: {
      module: { browser: "./lib/mupdf-module-stub.js" },
    },
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "api.quran.com" },
      { protocol: "https", hostname: "cdn.islamic.network" },
    ],
  },

  async rewrites() {
    const authProxy = authProxyTarget
      ? [
          { source: "/__/auth/:path*",     destination: `https://${authProxyTarget}/__/auth/:path*` },
          { source: "/__/firebase/:path*", destination: `https://${authProxyTarget}/__/firebase/:path*` },
        ]
      : [];

    // beforeFiles runs before the App Router, so "/" always serves the static
    // landing page without app/page.tsx getting a chance to redirect, and the
    // Firebase auth handler is proxied before any route can claim its path.
    return {
      beforeFiles: [
        { source: "/", destination: "/landing.html" },
        ...authProxy,
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
