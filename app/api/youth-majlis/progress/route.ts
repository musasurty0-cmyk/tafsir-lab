/**
 * GET /api/youth-majlis/progress
 *   200 { signedIn: true, entries }   — the student's saved portal progress
 *   200 { signedIn: false }           — not signed in to TafsirLab; the portal
 *                                       keeps progress on the device instead
 * PUT /api/youth-majlis/progress  { entries }
 *   Merges the sent entries into the stored ones (newest per key wins) and
 *   returns the merged set, so the client can take anything newer from
 *   another device in the same round trip.
 *
 * Behind the portal's gate as well as the TafsirLab session.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSessionOrNull } from "@/lib/session";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { asEntries, merge, type Entries } from "@/lib/youth-majlis/progress";

export async function GET() {
  if (!(await hasAccess("majlis"))) return NextResponse.json({ error: "Locked" }, { status: 403 });
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ signedIn: false });
  const row = await db.youthMajlisProgress.findUnique({ where: { userId: session.userId }, select: { entries: true } });
  return NextResponse.json({ signedIn: true, entries: asEntries(row?.entries) });
}

export async function PUT(req: NextRequest) {
  if (!(await hasAccess("majlis"))) return NextResponse.json({ error: "Locked" }, { status: 403 });
  const session = await getSessionOrNull();
  if (!session) return NextResponse.json({ signedIn: false }, { status: 401 });

  const body = await req.json().catch(() => null) as { entries?: unknown } | null;
  const incoming = asEntries(body?.entries);
  if (JSON.stringify(incoming).length > 200_000) {
    return NextResponse.json({ error: "Too much at once." }, { status: 413 });
  }

  /* Read-merge-write inside one transaction, with the row locked, so two
     devices saving at the same moment cannot overwrite each other. */
  const merged = await db.$transaction(async (tx) => {
    await tx.$executeRaw`INSERT INTO "YouthMajlisProgress" ("userId") VALUES (${session.userId}::uuid) ON CONFLICT ("userId") DO NOTHING`;
    const rows = await tx.$queryRaw<{ entries: unknown }[]>`SELECT "entries" FROM "YouthMajlisProgress" WHERE "userId" = ${session.userId}::uuid FOR UPDATE`;
    const { merged, changed } = merge(asEntries(rows[0]?.entries), incoming);
    if (changed) {
      await tx.youthMajlisProgress.update({
        where: { userId: session.userId },
        data:  { entries: merged as unknown as Prisma.InputJsonValue },
      });
    }
    return merged;
  });

  return NextResponse.json({ signedIn: true, entries: merged as Entries });
}
