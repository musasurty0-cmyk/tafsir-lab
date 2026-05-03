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

export async function GET(_req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { userId } = await getSession();
    const { workspaceId } = await params;
    const members = await WorkspacesService.listMembers(workspaceId, userId);
    return NextResponse.json({ members });
  } catch (err) { return errRes(err); }
}
