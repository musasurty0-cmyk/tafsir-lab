/**
 * GET /api/workspaces/[workspaceId]/shown-surahs
 *   The sūrahs this workspace's organisers chose for its grid, for the sūrah
 *   switcher. `[]` means all 114. Any member may read it.
 */
import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import { apiError } from "@/lib/api-errors";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const { workspace } = await WorkspacesService.getWorkspaceWithRole(workspaceId, userId);
    return NextResponse.json({ shownSurahs: workspace.shownSurahs });
  } catch (err) {
    return apiError(err);
  }
}
