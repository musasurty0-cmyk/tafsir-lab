/**
 * Next.js proxy (middleware) — runs on every matched request before the page renders.
 *
 * Auth gate: every signed-in surface requires a valid tl-session JWT.
 * Unauthenticated users are redirected to /login.
 *
 * Block gate: a blocked user (User.blockedAt — see prisma/sql/028) is rewritten
 * to /blocked, which shows only their blockReason. Doing it here, ahead of the
 * page, means no page's own try/catch around getSession can swallow or
 * misroute it. The check is one primary-key lookup, only on an already-valid
 * session, and fails OPEN so a database blip can never lock the app out.
 *
 * The block check reads the database through Prisma. A Next proxy file always
 * runs on the Node.js runtime (so it must not declare one), which is the same
 * runtime and pooled connection the route handlers use — Prisma is fine here.
 *
 * AUTH_PATHS and the matcher below must list the same routes. They are two
 * separate mechanisms — the matcher decides whether this file runs at all, the
 * list decides what it does — so a route added to one and not the other is
 * silently unprotected, which is how a page ends up 500ing on a missing
 * session instead of redirecting.
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify }                 from "jose";
import { db }                        from "@/lib/db";
import { verifyBetaCookie, BETA_COOKIE } from "@/lib/beta/gate";

const SESSION_COOKIE = "tl-session";

function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return new TextEncoder().encode(s);
}

/** Is this user blocked? One PK read; any failure answers "no" so a database
 *  hiccup cannot shut everyone out. */
async function isBlocked(userId: string): Promise<boolean> {
  try {
    const row = await db.user.findUnique({ where: { id: userId }, select: { blockedAt: true } });
    return row?.blockedAt != null;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  /* The private-beta gate in front of sign-in. /login is only reachable with
     the access-code cookie (set by /api/beta/unlock from the landing page) or
     an existing session — otherwise it is back to the landing page to enter
     the code. This is the server half of what public/landing.js used to only
     pretend to enforce. */
  if (pathname === "/login" || pathname.startsWith("/login/")) {
    const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;
    const hasBeta    = verifyBetaCookie(req.cookies.get(BETA_COOKIE)?.value);
    if (!hasSession && !hasBeta) {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  const AUTH_PATHS = [
    "/home", "/workspaces", "/workspace",
    "/analytics", "/leaderboard", "/friends", "/settings", "/contact", "/explore", "/assistant",
    // Sign in before the portal's password, so the organisers know who is in the circle.
    "/youth-majlis",
  ];
  const needsAuth  = AUTH_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );

  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  // Back to where you were going once you have signed in.
  const toLogin = () => {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname + req.nextUrl.search);
    return url;
  };

  if (!token) {
    return NextResponse.redirect(toLogin());
  }

  let userId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, sessionSecret());
    userId = payload.uid as string | undefined;
  } catch {
    const res = NextResponse.redirect(toLogin());
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  // Signed in and verified. A blocked user sees only /blocked.
  if (userId && (await isBlocked(userId))) {
    const url = new URL("/blocked", req.url);
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login", "/login/:path*",
    "/home/:path*", "/workspaces/:path*", "/workspace/:path*",
    "/analytics/:path*", "/leaderboard/:path*", "/friends/:path*",
    "/settings/:path*", "/contact/:path*", "/explore/:path*", "/assistant/:path*",
    "/youth-majlis/:path*",
  ],
};
