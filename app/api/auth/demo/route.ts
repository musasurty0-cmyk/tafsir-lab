/**
 * POST /api/auth/demo — open a throwaway demo session (no sign-in).
 *
 * Body: { code: string } — must match DEMO_CODE. If that env var is unset,
 * demo mode is OFF entirely and this 404s.
 *
 * The account, its seeded Tutorial Workspace and the browser-session cookie
 * are all created by provisionDemoSession(), shared with the public tour entry
 * at /api/beta/start. Demo data is discarded after 24 hours.
 */

import { NextRequest, NextResponse } from "next/server";
import { memoryLimit, clientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-errors";
import { provisionDemoSession, DemoBusyError } from "@/lib/demo/provision";

export async function POST(req: NextRequest) {
  try {
    // Fail closed. There used to be a fallback of "1653" here, which meant an
    // unset DEMO_CODE left demo mode wide open on a value committed to the
    // repo — anyone could mint real sessions. With no env var set, demo mode
    // is simply OFF, and the endpoint reveals nothing about why.
    const expected = process.env.DEMO_CODE;
    if (!expected) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { code } = await req.json().catch(() => ({})) as { code?: string };
    if (!code || code !== expected) {
      return NextResponse.json({ error: "Invalid code" }, { status: 403 });
    }

    /* Per-instance brake. The global ceiling lives in provisionDemoSession,
       where it can be counted in the database and so survives serverless. */
    if (!memoryLimit(`demo:${clientIp(req)}`, 5, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const demo = await provisionDemoSession();
    return NextResponse.json(
      { ok: true, userId: demo.userId, workspaceId: demo.workspaceId, pageId: demo.pageId },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof DemoBusyError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    return apiError(err);
  }
}
