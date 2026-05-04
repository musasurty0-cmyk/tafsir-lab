/**
 * Next.js proxy (middleware) — runs on every matched request before the page renders.
 *
 * Auth gate: /home, /workspaces, and /workspace require a valid tl-session JWT.
 * Unauthenticated users are redirected to /login.
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

  const AUTH_PATHS = ["/home", "/workspaces", "/workspace"];
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
  matcher: ["/home/:path*", "/workspaces/:path*", "/workspace/:path*"],
};
