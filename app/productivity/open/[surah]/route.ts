/**
 * GET /productivity/open/[surah]?ws=<workspaceId>
 *
 * "Open in TafsirLab" from a tafsīr block: the sūrah in one of your own
 * study workspaces, the one given if you belong to it, otherwise the first
 * study workspace you own (or, failing that, any you are in). Not signed in
 * to TafsirLab → the login page.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionOrNull } from "@/lib/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ surah: string }> },
) {
  const { surah: raw } = await params;
  const surah = Number(raw);
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return to("/home");

  const session = await getSessionOrNull();
  if (!session) return to("/login");

  const mine = await db.workspace.findMany({
    where: { kind: "study", OR: [{ ownerId: session.userId }, { members: { some: { userId: session.userId } } }] },
    select: { id: true, ownerId: true },
    orderBy: { createdAt: "asc" },
  });
  if (!mine.length) return to("/home");

  const asked = req.nextUrl.searchParams.get("ws");
  const ws = mine.find((w) => w.id === asked) ?? mine.find((w) => w.ownerId === session.userId) ?? mine[0];
  return to(`/workspaces/${ws.id}/surahs/${surah}`);
}
