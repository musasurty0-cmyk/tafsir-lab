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

  // A board that holds an Arabic lesson's notes goes back to that lesson.
  const lesson = workspace.kind === "arabic"
    ? await db.arabicLesson.findFirst({ where: { pageId: board.id, workspaceId }, select: { id: true, title: true } })
    : null;

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
      back={lesson ? { href: `/workspaces/${workspaceId}/arabic/${lesson.id}`, label: lesson.title } : undefined}
      notesOnly={workspace.kind === "arabic"}
    />
  );
}
