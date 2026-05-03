import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";

function errRes(err: unknown) {
  if (err instanceof WorkspacesService.WorkspaceError) {
    const s = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status: s });
  }
  return NextResponse.json({ error: String(err) }, { status: 500 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ workspaceId: string; userId: string }> }) {
  try {
    const { userId: actingUserId } = await getSession();
    const { workspaceId, userId: targetUserId } = await params;
    const { role } = await req.json() as { role?: string };
    if (role !== "admin" && role !== "member") return NextResponse.json({ error: "role must be admin or member" }, { status: 400 });
    await WorkspacesService.setMemberRole(workspaceId, targetUserId, role, actingUserId);
    return NextResponse.json({ ok: true });
  } catch (err) { return errRes(err); }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ workspaceId: string; userId: string }> }) {
  try {
    const { userId: actingUserId } = await getSession();
    const { workspaceId, userId: targetUserId } = await params;
    if (actingUserId === targetUserId) {
      await WorkspacesService.leaveWorkspace(workspaceId, actingUserId);
    } else {
      await WorkspacesService.removeMember(workspaceId, targetUserId, actingUserId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) { return errRes(err); }
}
