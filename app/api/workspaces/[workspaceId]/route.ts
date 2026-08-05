/**
 * PATCH /api/workspaces/[workspaceId]
 *
 * Update a workspace:
 *   { name: string }                       — rename (owner)
 *   { icon: string | null }                 — set/clear icon (admin+)
 *   { membersCanManagePages: boolean }      — permission toggle (admin+)
 */

import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import { WorkspaceError } from "@/lib/services/workspaces.service";
import { apiError } from "@/lib/api-errors";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const body = await req.json() as {
      name?: unknown; membersCanManagePages?: unknown; icon?: unknown;
    };

    // Permission policy toggle (admins).
    if (typeof body.membersCanManagePages === "boolean") {
      const result = await WorkspacesService.setMembersCanManagePages(
        workspaceId, userId, body.membersCanManagePages,
      );
      return NextResponse.json({ workspace: result });
    }

    /* Icon (admins). `null` is meaningful — it clears the icon back to
       initials — so this tests for the KEY, not for a truthy value. */
    if ("icon" in body && (typeof body.icon === "string" || body.icon === null)) {
      const result = await WorkspacesService.setWorkspaceIcon(
        workspaceId, userId, body.icon as string | null,
      );
      return NextResponse.json({ workspace: result });
    }

    // Rename (owner).
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
    return apiError(err);
  }
}
