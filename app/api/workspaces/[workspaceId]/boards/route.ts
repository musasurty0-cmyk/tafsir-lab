/**
 * POST /api/workspaces/[workspaceId]/boards
 *   Create a new blank board in the workspace. Body: { title? }.
 *   Returns { board: { id, title } }.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as PagesService from "@/lib/services/pages.service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const body = await req.json().catch(() => ({})) as { title?: unknown };
    const title = typeof body.title === "string" ? body.title : "";

    const board = await PagesService.createWorkspaceBoard(workspaceId, userId, title);
    return NextResponse.json({ board }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
