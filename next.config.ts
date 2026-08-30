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
  /* @huggingface/transformers resolves to a Node build on the server, which
     depends on onnxruntime-node — a native binary that must not be traced into
     a serverless function. Nothing on the server imports it: the only use is a
     dynamic import inside a browser-only path. Marking it external stops the
     bundler following that edge anyway. */
  serverExternalPackages: ["@huggingface/transformers"],

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

  /* ── Security headers ──────────────────────────────────────────────────
     The app renders user-authored rich text, so this is load-bearing rather
     than hygiene.

     Note SAMEORIGIN, not DENY. Firebase's sign-in flow creates an iframe on
     /__/auth/*, which the rewrite below serves from THIS domain — that proxy
     is the whole reason iOS sign-in works. DENY would break it.

     The CSP ships Report-Only on purpose. A blocking policy written blind
     against tldraw, mupdf's WASM, Firebase, PartyKit and 226 inline styles
     will break something, and a broken CSP fails silently in exactly the way
     this codebase has been bitten by all day. Collect violations first,
     then switch the header name to Content-Security-Policy. */
  async headers() {
    const csp = [
      "default-src 'self'",
      /* Next injects inline bootstrap scripts; nonces would need middleware.
         'unsafe-eval' is required by mupdf's WASM glue. */
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      /* 226 inline style props across the components, plus the Google Fonts
         stylesheet loaded in app/layout.tsx. */
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      /* QCF mushaf faces come from quran.foundation; Google serves its own
         font files from gstatic. */
      "font-src 'self' data: https://fonts.gstatic.com https://verses.quran.foundation",
      "img-src 'self' data: blob: https://api.quran.com https://cdn.islamic.network https://verses.quran.foundation",
      /* Realtime collaboration is a WebSocket to PartyKit; Firebase Auth talks
         to Google's identity endpoints. */
      /* Hugging Face serves the embedding model that Lab AI runs in the
         browser; the large files redirect to their CDN, hence the wildcards.
         jsdelivr serves onnxruntime's WASM binary. Both are fetch(), not
         script — the WASM glue ships inside the package, and instantiating it
         is covered by the 'unsafe-eval' above. */
      "connect-src 'self' https://api.quran.com https://*.partykit.dev wss://*.partykit.dev ws://localhost:1999 https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net",
      "worker-src 'self' blob:",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
    ].join("; ");

    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options",        value: "SAMEORIGIN" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy",        value: "strict-origin-when-cross-origin" },
        /* No camera or microphone anywhere in the app. Geolocation neither. */
        { key: "Permissions-Policy",     value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
        /* Vercel serves HTTPS only; two years with preload is the standard
           value once you are sure every subdomain is HTTPS. */
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        { key: "Content-Security-Policy-Report-Only", value: csp },
      ],
    }];
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

  /* Client router cache.
     Dynamic segments default to a 0s stale time, so every visit to a page
     re-fetched its RSC payload even though <Link prefetch> had already pulled
     it — which is what made switching between pages feel like loading rather
     than switching. 60s keeps a page you were just on instantly available on
     the way back, while still being short enough that a page edited elsewhere
     refreshes on the next visit. */
  experimental: {
    staleTimes: {
      dynamic: 60,
      static:  180,
    },
  },
};

export default nextConfig;
