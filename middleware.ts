/**
 * Next.js middleware — runs on every matched request before the page renders.
 *
 * Protected routes (/home, /workspaces) redirect to /login when no valid
 * session cookie is present. Public routes (/login, /api/auth/*) are excluded.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify }                 from "jose";

const COOKIE  = "tl-session";
const LOGIN   = "/login";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return new TextEncoder().encode(s);
}

export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL(LOGIN, req.url));
  }

  try {
    await jwtVerify(token, secret());
    return NextResponse.next();
  } catch {
    // Expired or tampered — send to login
    const res = NextResponse.redirect(new URL(LOGIN, req.url));
    res.cookies.delete(COOKIE);
    return res;
  }
}

export const config = {
  matcher: [
    "/home/:path*",
    "/workspaces/:path*",
    // Protect all API routes except public ones
    "/api/((?!auth|ayah|tafsir|chapters|verses).*)",
  ],
};
