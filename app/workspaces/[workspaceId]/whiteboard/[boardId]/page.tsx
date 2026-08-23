/**
 * /workspaces/[workspaceId]/whiteboard/[boardId] — a single blank board.
 */

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService from "@/lib/services/pages.service";
import WhiteboardShell from "@/components/workspace/WhiteboardShell";

export default async function BoardRoute({
  params,
}: {
  params: Promise<{ workspaceId: string; boardId: string }>;
}) {
  const { workspaceId, boardId } = await params;
  const { userId } = await getSession();

  const [{ workspace, role }, board, currentUser] = await Promise.all([
    WorkspacesService.getWorkspaceWithRole(workspaceId, userId),
    PagesService.getWorkspaceBoard(workspaceId, boardId, userId),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  if (!board) notFound();

  return (
    <WhiteboardShell
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      pageId={board.id}
      boardTitle={board.title}
      boardContent={board.tiptapContent}
      role={role}
      currentUserId={userId}
      currentUserName={currentUser?.name ?? "Anonymous"}
    />
  );
}
