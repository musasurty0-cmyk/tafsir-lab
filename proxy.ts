/**
 * Next.js proxy (middleware) — runs on every matched request before the page renders.
 *
 * Auth gate: every signed-in surface requires a valid tl-session JWT.
 * Unauthenticated users are redirected to /login.
 *
 * AUTH_PATHS and the matcher below must list the same routes. They are two
 * separate mechanisms — the matcher decides whether this file runs at all, the
 * list decides what it does — so a route added to one and not the other is
 * silently unprotected, which is how a page ends up 500ing on a missing
 * session instead of redirecting.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify }                 from "jose";

const SESSION_COOKIE = "tl-session";

function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return new TextEncoder().encode(s);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const AUTH_PATHS = [
    "/home", "/workspaces", "/workspace",
    "/analytics", "/leaderboard", "/friends", "/settings", "/contact",
  ];
  const needsAuth  = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(token, sessionSecret());
    return NextResponse.next();
  } catch {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }
}

export const config = {
  matcher: [
    "/home/:path*", "/workspaces/:path*", "/workspace/:path*",
    "/analytics/:path*", "/leaderboard/:path*", "/friends/:path*",
    "/settings/:path*", "/contact/:path*",
  ],
};
