/**
 * Next.js proxy (middleware) — runs on every matched request before the page renders.
 *
 * Two-layer gate:
 *   1. Beta access  — all routes except "/" and "/beta" require the beta_access cookie.
 *      Visitors without it are redirected to /beta (password gate).
 *   2. Auth         — /home and /workspaces additionally require a valid tl-session JWT.
 *      Unauthenticated users are sent to /login.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify }                 from "jose";

const SESSION_COOKIE = "tl-session";
const BETA_COOKIE    = "beta_access";

// Paths that bypass the beta gate entirely (public)
const BETA_EXEMPT = ["/", "/beta", "/api/beta/verify"];

function isBetaExempt(pathname: string) {
  return BETA_EXEMPT.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return new TextEncoder().encode(s);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. Beta gate ──────────────────────────────────────────────────────────
  if (!isBetaExempt(pathname)) {
    const betaCookie = req.cookies.get(BETA_COOKIE)?.value;
    if (!betaCookie) {
      const url = req.nextUrl.clone();
      url.pathname = "/beta";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  // ── 2. Auth gate (app routes only) ───────────────────────────────────────
  const AUTH_PATHS = ["/home", "/workspaces", "/workspace"];
  const needsAuth  = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (needsAuth) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;

    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    try {
      await jwtVerify(token, sessionSecret());
    } catch {
      const res = NextResponse.redirect(new URL("/login", req.url));
      res.cookies.delete(SESSION_COOKIE);
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Run on everything except Next.js internals and static assets.
     * Both the beta gate and auth gate are handled inside the function above.
     */
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
