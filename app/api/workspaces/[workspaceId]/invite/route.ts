import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import { apiError } from "@/lib/api-errors";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { userId } = await getSession();
    const { workspaceId } = await params;
    await WorkspacesService.getWorkspaceWithRole(workspaceId, userId); // verify membership
    const code = await WorkspacesService.ensureInviteCode(workspaceId);
    return NextResponse.json({ code });
  } catch (err) {
    if (err instanceof WorkspacesService.WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "NOT_FOUND" ? 404 : 403 });
    }
    return apiError(err);
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { userId } = await getSession();
    const { workspaceId } = await params;
    const code = await WorkspacesService.regenerateInviteCode(workspaceId, userId);
    return NextResponse.json({ code });
  } catch (err) {
    if (err instanceof WorkspacesService.WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "NOT_FOUND" ? 404 : 403 });
    }
    return apiError(err);
  }
}
