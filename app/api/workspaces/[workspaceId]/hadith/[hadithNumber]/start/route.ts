/**
 * POST /api/workspaces/[workspaceId]/hadith/[n]/start
 *
 * Open a hadith for study: create its session and a first page if they do not
 * exist yet, and answer with the page to land on.
 *
 * Idempotent on purpose. Two devices tapping the same hadith at once, or a
 * reader who double-taps, must end up on ONE session with ONE first page —
 * so the session is upserted on the unique (workspace, number) pair and the
 * page is only created when the session has none.
 *
 * A hadith session is an ordinary WorkspaceSurah row with the hadith's number
 * in `surahNumber`. That is not a hack so much as the point: pages, notes,
 * ink, presence, export and the assistant all hang off that row already, so a
 * hadith inherits every one of them without a second implementation to keep
 * in step. The workspace's `kind` is what says which text the number means.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getWorkspaceWithRole } from "@/lib/services/workspaces.service";
import { isHadithNumber, getHadith } from "@/lib/hadith";
import { apiError } from "@/lib/api-errors";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; hadithNumber: string }> },
) {
  try {
    const { userId } = await getSession();
    const { workspaceId, hadithNumber } = await params;
    const n = parseInt(hadithNumber, 10);

    if (!isHadithNumber(n)) {
      return NextResponse.json({ error: "No such hadith in this collection" }, { status: 404 });
    }

    const { workspace } = await getWorkspaceWithRole(workspaceId, userId);
    if (workspace.kind !== "nawawi") {
      return NextResponse.json(
        { error: "This workspace does not study the forty hadith" },
        { status: 400 },
      );
    }

    const hadith = getHadith(n)!;

    const session = await db.workspaceSurah.upsert({
      where:  { workspaceId_surahNumber: { workspaceId, surahNumber: n } },
      update: {},
      create: { workspaceId, surahNumber: n },
      select: { id: true },
    });

    const existing = await db.page.findFirst({
      where:   { workspaceSurahId: session.id },
      orderBy: { orderIndex: "asc" },
      select:  { id: true },
    });
    if (existing) return NextResponse.json({ pageId: existing.id });

    const page = await db.page.create({
      /* Titled from the hadith rather than "Page 1": the first thing in a
         notes list should say which hadith it belongs to. */
      data: {
        workspaceSurahId: session.id,
        title: hadith.title,
        orderIndex: 0,
        status: "draft",
        createdById: userId,
      },
      select: { id: true },
    });

    return NextResponse.json({ pageId: page.id }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
