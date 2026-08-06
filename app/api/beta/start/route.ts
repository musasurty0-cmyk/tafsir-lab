/**
 * GET /api/beta/start — the public tour entry.
 *
 * Mints a demo session and redirects straight into its seeded page with the
 * tour armed. A GET with side effects is deliberate: this is a link people
 * follow, not an API call, so it has to work by navigation alone.
 *
 * Gated on DEMO_CODE being SET, not on the caller knowing it. That variable
 * already means "demo mode is on" (see .env.example) — with it unset the demo
 * login is off, and the tour that hands out demo accounts should be off with
 * it rather than quietly becoming an ungated way to mint sessions.
 */

import { NextRequest, NextResponse } from "next/server";
import { memoryLimit, clientIp } from "@/lib/rate-limit";
import { provisionDemoSession, DemoBusyError } from "@/lib/demo/provision";

export async function GET(req: NextRequest) {
  const base = new URL(req.url);

  if (!process.env.DEMO_CODE) {
    return NextResponse.redirect(new URL("/beta?unavailable=1", base));
  }

  /* Stricter than the demo login's limit: this one needs no code, so the
     brake is the only thing between a script and a run of new accounts. */
  if (!memoryLimit(`beta-start:${clientIp(req)}`, 3, 60_000)) {
    return NextResponse.redirect(new URL("/beta?busy=1", base));
  }

  try {
    const demo = await provisionDemoSession();

    /* Land in the seeded page with the tour armed. Without a page — seeding
       failed — fall back to the workspace, where the tour still has somewhere
       sensible to run. */
    const dest = demo.pageId
      ? `/workspaces/${demo.workspaceId}/surahs/1/pages/${demo.pageId}?tour=1`
      : `/workspaces/${demo.workspaceId}?tour=1`;

    return NextResponse.redirect(new URL(dest, base));
  } catch (err) {
    if (err instanceof DemoBusyError) {
      return NextResponse.redirect(new URL("/beta?busy=1", base));
    }
    console.error("[beta-start] could not provision demo:", err);
    return NextResponse.redirect(new URL("/beta?failed=1", base));
  }
}
