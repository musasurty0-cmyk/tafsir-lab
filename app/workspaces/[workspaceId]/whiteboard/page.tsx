/**
 * /workspaces/[workspaceId]/whiteboard — the workspace's blank whiteboard.
 *
 * A standalone scratch canvas (not tied to any surah). Its notes + ink are
 * stored on a hidden page under a sentinel board (surahNumber 0), which is
 * excluded from every surah listing.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService from "@/lib/services/pages.service";
import WhiteboardShell from "@/components/workspace/WhiteboardShell";

export default async function WhiteboardRoute({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { userId } = await getSession();

  const [{ workspace, role }, { pageId }, currentUser] = await Promise.all([
    WorkspacesService.getWorkspaceWithRole(workspaceId, userId),
    PagesService.getOrCreateWorkspaceWhiteboard(workspaceId, userId),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  return (
    <WhiteboardShell
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      pageId={pageId}
      role={role}
      currentUserId={userId}
      currentUserName={currentUser?.name ?? "Anonymous"}
    />
  );
}
