/**
 * POST /api/beta/unlock — check the private-beta access code.
 *
 * Body: { code: string }. On a match, set the tl-beta cookie and return
 * { ok: true }; a wrong code is 401. This is what the landing page's gate
 * calls, so /login and new-account creation (both of which now require the
 * cookie) can no longer be reached by typing the URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { memoryLimit, clientIp } from "@/lib/rate-limit";
import { codeMatches, betaToken, BETA_COOKIE, BETA_MAX_AGE } from "@/lib/beta/gate";

export async function POST(req: NextRequest) {
  // A wrong code should not be a free guessing machine.
  if (!memoryLimit(`beta-unlock:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many tries. Wait a minute." }, { status: 429 });
  }

  const { code } = (await req.json().catch(() => ({}))) as { code?: unknown };
  if (typeof code !== "string" || !codeMatches(code)) {
    return NextResponse.json({ error: "That code isn’t right." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(BETA_COOKIE, betaToken(), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   BETA_MAX_AGE,
  });
  return res;
}
