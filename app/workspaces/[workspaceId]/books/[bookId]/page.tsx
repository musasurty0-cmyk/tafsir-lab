/**
 * /workspaces/[workspaceId]/books/[bookId] — a single book to annotate around.
 */

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService from "@/lib/services/pages.service";
import BookShell from "@/components/workspace/BookShell";

export default async function BookRoute({
  params,
}: {
  params: Promise<{ workspaceId: string; bookId: string }>;
}) {
  const { workspaceId, bookId } = await params;
  const { userId } = await getSession();

  const [{ workspace, role }, book, currentUser] = await Promise.all([
    WorkspacesService.getWorkspaceWithRole(workspaceId, userId),
    PagesService.getWorkspaceBook(workspaceId, bookId, userId),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  if (!book || !book.pdfUrl) notFound();

  return (
    <BookShell
      workspaceId={workspaceId}
      workspaceName={workspace.name}
      pageId={book.id}
      bookTitle={book.title}
      pdfUrl={book.pdfUrl}
      role={role}
      currentUserId={userId}
      currentUserName={currentUser?.name ?? "Anonymous"}
    />
  );
}
