/**
 * /workspaces/[workspaceId] — Workspace home
 *
 * Renders the full 114-surah grid with workspace-aware state:
 * which surahs have been started, how many pages each has.
 * The Rail fetches the workspace list client-side.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import { db } from "@/lib/db";
import { fetchChapters } from "@/lib/quran-api";
import WorkspaceHome from "@/components/workspace/WorkspaceHome";
import BoardsHome from "@/components/workspace/BoardsHome";
import BooksHome from "@/components/workspace/BooksHome";
import * as PagesService from "@/lib/services/pages.service";

export type WorkspaceSurahSummary = {
  id: string;
  surahNumber: number;
  startedAt: Date;
  pageCount: number;
  publishedCount: number;
  firstPageId: string | null;
};

export default async function WorkspaceHomePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const { userId } = await getSession();

  // Boards workspace → the boards list is home (no surah grid).
  const gate = await WorkspacesService.getWorkspaceWithRole(workspaceId, userId);
  if (gate.workspace.kind === "boards") {
    const boards = await PagesService.listWorkspaceBoards(workspaceId, userId);
    return (
      <BoardsHome
        workspaceId={workspaceId}
        workspace={gate.workspace}
        role={gate.role}
        boards={boards.map((b) => ({ id: b.id, title: b.title, createdAt: b.createdAt }))}
      />
    );
  }

  // Books workspace → the book library is home (no surah grid).
  if (gate.workspace.kind === "books") {
    const books = await PagesService.listWorkspaceBooks(workspaceId, userId);
    return (
      <BooksHome
        workspaceId={workspaceId}
        workspace={gate.workspace}
        role={gate.role}
        books={books.map((b) => ({ id: b.id, title: b.title, pdfUrl: b.pdfUrl!, pdfName: b.pdfName, createdAt: b.createdAt }))}
      />
    );
  }

  const { workspace, role } = gate;
  const [chapters, rawSurahs] = await Promise.all([
    fetchChapters(),
    db.workspaceSurah.findMany({
      where: { workspaceId, surahNumber: { gte: 1 } }, // exclude the whiteboard sentinel (0)
      select: {
        id: true,
        surahNumber: true,
        startedAt: true,
        _count: { select: { pages: true } },
        pages: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, status: true },
        },
      },
    }),
  ]);

  const workspaceSurahs: WorkspaceSurahSummary[] = rawSurahs.map((s) => ({
    id: s.id,
    surahNumber: s.surahNumber,
    startedAt: s.startedAt,
    pageCount: s._count.pages,
    publishedCount: s.pages.filter((p) => p.status === "published").length,
    firstPageId: s.pages[0]?.id ?? null,
  }));

  return (
    <WorkspaceHome
      workspaceId={workspaceId}
      workspace={workspace}
      role={role}
      chapters={chapters}
      workspaceSurahs={workspaceSurahs}
    />
  );
}
