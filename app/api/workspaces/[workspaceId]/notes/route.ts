/**
 * GET /api/workspaces/[workspaceId]/notes
 *
 * All notes across every page of the workspace (visibility-filtered),
 * for the Notes review view.
 *
 * Query params (all optional):
 *   q      — free-text search over note content
 *   type   — filter by noteType (text|callout|linguistic|thematic|ruling|question|textbox)
 *   surah  — filter by surah number
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as NotesService from "@/lib/services/notes.service";
import { WorkspaceError } from "@/lib/services/workspaces.service";
import { apiError } from "@/lib/api-errors";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { workspaceId } = await params;

    const sp = req.nextUrl.searchParams;
    const surahRaw = sp.get("surah");
    const surahNumber = surahRaw ? parseInt(surahRaw, 10) : undefined;

    const notes = await NotesService.listWorkspaceNotes(workspaceId, userId, {
      query:       sp.get("q") ?? undefined,
      noteType:    sp.get("type") ?? undefined,
      surahNumber: surahNumber && !isNaN(surahNumber) ? surahNumber : undefined,
    });

    return NextResponse.json({ notes });
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "NOT_FOUND" ? 404 : 403 });
    }
    return apiError(err);
  }
}
