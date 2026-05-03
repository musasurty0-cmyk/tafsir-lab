import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const { code } = await req.json() as { code?: string };
    if (!code?.trim()) return NextResponse.json({ error: "Invite code required" }, { status: 400 });
    const workspace = await WorkspacesService.joinByInviteCode(code.trim().toUpperCase(), userId);
    return NextResponse.json({ workspace });
  } catch (err) {
    if (err instanceof WorkspacesService.WorkspaceError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : err.code === "CONFLICT" ? 409 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
