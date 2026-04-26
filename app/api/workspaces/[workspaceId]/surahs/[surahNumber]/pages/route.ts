/**
 * GET  /api/workspaces/[workspaceId]/surahs/[surahNumber]/pages
 *   Lists pages for a surah session (draft visibility enforced in service).
 *   Query: includeArchived=true — include archived (admin+ only)
 *
 * POST /api/workspaces/[workspaceId]/surahs/[surahNumber]/pages
 *   Creates a new blank draft page.
 *   Body: { title: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService from "@/lib/services/pages.service";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; surahNumber: string }> }
) {
  try {
    const { userId } = await getSession();
    const { workspaceId, surahNumber: surahNumberStr } = await params;
    const surahNumber = parseInt(surahNumberStr, 10);

    if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return NextResponse.json({ error: "Invalid surahNumber" }, { status: 400 });
    }

    // Verify workspace membership before looking up the session.
    await WorkspacesService.getWorkspaceWithRole(workspaceId, userId);

    // Resolve the workspace_surah ID from workspace + surah number.
    const workspaceSurah = await db.workspaceSurah.findUnique({
      where: { workspaceId_surahNumber: { workspaceId, surahNumber } },
      select: { id: true },
    });

    if (!workspaceSurah) {
      return NextResponse.json({ error: "Surah session not started" }, { status: 404 });
    }

    const includeArchived =
      req.nextUrl.searchParams.get("includeArchived") === "true";

    const pages = await PagesService.listPages(
      workspaceSurah.id,
      userId,
      { includeArchived }
    );

    return NextResponse.json({ pages });
  } catch (err) {
    if (err instanceof WorkspacesService.WorkspaceError) {
      const status = err.code === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ error: err.message }, { status });
    }
    if (err instanceof PagesService.PageError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; surahNumber: string }> }
) {
  try {
    const { userId } = await getSession();
    const { workspaceId, surahNumber: surahNumberStr } = await params;
    const surahNumber = parseInt(surahNumberStr, 10);

    if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) {
      return NextResponse.json({ error: "Invalid surahNumber" }, { status: 400 });
    }

    const body = await req.json() as { title?: unknown };
    if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    await WorkspacesService.getWorkspaceWithRole(workspaceId, userId);

    const workspaceSurah = await db.workspaceSurah.findUnique({
      where: { workspaceId_surahNumber: { workspaceId, surahNumber } },
      select: { id: true },
    });
    if (!workspaceSurah) {
      return NextResponse.json({ error: "Surah session not started" }, { status: 404 });
    }

    const page = await PagesService.createPage(workspaceSurah.id, userId, body.title);
    return NextResponse.json({ page }, { status: 201 });
  } catch (err) {
    if (err instanceof WorkspacesService.WorkspaceError) {
      const status = err.code === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
