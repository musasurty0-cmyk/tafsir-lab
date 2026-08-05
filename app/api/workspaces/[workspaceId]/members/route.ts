import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import { apiError } from "@/lib/api-errors";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { userId } = await getSession();
    const { workspaceId } = await params;
    const members = await WorkspacesService.listMembers(workspaceId, userId);
    return NextResponse.json({ members });
  } catch (err) { return apiError(err); }
}
