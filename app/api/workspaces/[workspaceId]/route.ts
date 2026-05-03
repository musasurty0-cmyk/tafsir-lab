/**
 * PATCH /api/workspaces/[workspaceId]
 *
 * Rename a workspace. Only the owner may do this.
 *
 * Body: { name: string }
 * Response: { workspace: { id, name, type, ownerId } }
 */

import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import { WorkspaceError } from "@/lib/services/workspaces.service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const body = await req.json() as { name?: unknown };

    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const workspace = await WorkspacesService.renameWorkspace(workspaceId, userId, body.name);
    return NextResponse.json({ workspace });
  } catch (err) {
    if (err instanceof WorkspaceError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("[workspaces PATCH]", err);
    return NextResponse.json({ error: "Failed to rename workspace" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { userId } = await getSession();
    const { workspaceId } = await params;
    await WorkspacesService.deleteWorkspace(workspaceId, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof WorkspaceError) {
      const s = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status: s });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
