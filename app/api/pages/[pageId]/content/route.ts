/**
 * PATCH /api/pages/[pageId]/content
 *
 * Saves the TipTap document JSON for a page's free editor.
 * Called debounced on every editor change in Mode A.
 *
 * Body: { tiptapContent: object }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import { apiError } from "@/lib/api-errors";

async function getWorkspaceIdForPage(pageId: string): Promise<string | null> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { workspaceSurah: { select: { workspaceId: true } } },
  });
  return page?.workspaceSurah.workspaceId ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;

    const workspaceId = await getWorkspaceIdForPage(pageId);
    if (!workspaceId)
      return NextResponse.json({ error: "Page not found" }, { status: 404 });

    // Verify membership (any role can save their own edits).
    await WorkspacesService.getWorkspaceWithRole(workspaceId, userId);

    const body = await req.json() as { tiptapContent?: unknown };
    if (body.tiptapContent === undefined)
      return NextResponse.json({ error: "tiptapContent is required" }, { status: 400 });

    await db.page.update({
      where: { id: pageId },
      data: { tiptapContent: body.tiptapContent as object },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WorkspacesService.WorkspaceError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.code === "NOT_FOUND" ? 404 : 403 }
      );
    }
    return apiError(err);
  }
}
