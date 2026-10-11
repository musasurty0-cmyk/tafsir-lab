/**
 * POST /api/auth/demo/presence   { event: "ping" | "close" }
 *
 * How a demo account is deleted once it is closed. The page (DemoPresence)
 * pings every 15s while open; when the tab is closed it sends "close" as a
 * beacon. A browser cannot tell a close from a reload, so "close" only stamps
 * the moment and waits: if the page pings again within 45 seconds it was a
 * reload and the stamp is cleared; if not, the account is deleted there and
 * then. Every check-in also sweeps other finished demos, so nothing depends
 * on a scheduled job.
 *
 * Does nothing for a real account.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { getSessionOrNull } from "@/lib/session";
import { DEMO_FLAG, deleteDemoUser, isDemoEmail, purgeDemos } from "@/lib/demo/provision";

export const maxDuration = 60;

const RELOAD_GRACE_MS = 45_000;

export async function POST(req: NextRequest) {
  const session = await getSessionOrNull();
  const user = session
    ? await db.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true } })
    : null;

  // Not a demo (anymore): tell the browser to stop checking in.
  if (!user || !isDemoEmail(user.email)) {
    const res = new NextResponse(null, { status: 204 });
    res.cookies.delete(DEMO_FLAG);
    return res;
  }

  const body = await req.json().catch(() => null) as { event?: unknown } | null;
  const now = new Date();

  if (body?.event === "close") {
    await db.demoPresence.upsert({
      where: { userId: user.id }, create: { userId: user.id, closedAt: now }, update: { closedAt: now },
    });
    after(async () => {
      await new Promise((r) => setTimeout(r, RELOAD_GRACE_MS));
      const p = await db.demoPresence.findUnique({ where: { userId: user.id }, select: { closedAt: true } });
      // Still marked closed, with no check-in since: the tab really is gone.
      if (p?.closedAt && p.closedAt.getTime() === now.getTime()) await deleteDemoUser(user.id);
      await purgeDemos();
    });
    return new NextResponse(null, { status: 204 });
  }

  await db.demoPresence.upsert({
    where: { userId: user.id }, create: { userId: user.id, seenAt: now }, update: { seenAt: now, closedAt: null },
  });
  after(() => purgeDemos(user.id).then(() => undefined));
  return new NextResponse(null, { status: 204 });
}
