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
import HadithHome from "@/components/workspace/HadithHome";
import ArabicHome from "@/components/workspace/arabic/ArabicHome";
import * as ArabicService from "@/lib/services/arabic.service";
import * as PagesService from "@/lib/services/pages.service";

export type WorkspaceSurahSummary = {
  id: string;
  surahNumber: number;
  startedAt: Date;
  pageCount: number;
  publishedCount: number;
  firstPageId: string | null;
  /** Something has actually been written here: a note, ink, or text in the
      page document. Opening a sūrah creates its session, but that alone is
      not studying it. */
  hasWork: boolean;
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

  // Arabic study → the course's levels and lessons are home.
  if (gate.workspace.kind === "arabic") {
    const lessons = await ArabicService.listLessons(workspaceId, userId);
    return <ArabicHome workspaceId={workspaceId} workspace={gate.workspace} role={gate.role} lessons={lessons} />;
  }

  /* Nawawi workspace -> the forty-two are home. The sessions that already
     exist are read in one query so each card can say whether it has been
     opened, exactly as the surah grid does. */
  if (gate.workspace.kind === "nawawi") {
    const rows = await db.workspaceSurah.findMany({
      where:  { workspaceId, surahNumber: { gte: 1 } },
      select: {
        surahNumber: true,
        _count: { select: { pages: true } },
        pages: { orderBy: { orderIndex: "asc" }, take: 1, select: { id: true } },
      },
    });
    return (
      <HadithHome
        workspaceId={workspaceId}
        currentUserId={userId}
        workspace={gate.workspace}
        role={gate.role}
        sessions={rows.map((r) => ({
          hadithNumber: r.surahNumber,
          pageCount:    r._count.pages,
          firstPageId:  r.pages[0]?.id ?? null,
        }))}
      />
    );
  }

  const { workspace, role } = gate;
  const [chapters, rawSurahs, workRows] = await Promise.all([
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
    /* Which sūrahs have real work in them: any note, any ink, or any written
       text in a page document. One query, cheap EXISTS checks; the ink is
       never read, only whether its array is non-empty. */
    db.$queryRaw<{ id: string; hasWork: boolean }[]>`
      SELECT ws.id,
        (EXISTS (SELECT 1 FROM "StructuredNote" sn JOIN "Page" p ON p.id = sn."pageId" WHERE p."workspaceSurahId" = ws.id)
         OR EXISTS (SELECT 1 FROM "CanvasDrawing" c JOIN "Page" p ON p.id = c."pageId"
                    WHERE p."workspaceSurahId" = ws.id AND jsonb_typeof(c.strokes) = 'array' AND jsonb_array_length(c.strokes) > 0)
         OR EXISTS (SELECT 1 FROM "Page" p WHERE p."workspaceSurahId" = ws.id
                    AND p."tiptapContent"::text ~ '"text":"[^"]*[^[:space:]"]')) AS "hasWork"
      FROM "WorkspaceSurah" ws
      WHERE ws."workspaceId" = ${workspaceId}::uuid AND ws."surahNumber" >= 1`,
  ]);
  const worked = new Set(workRows.filter((r) => r.hasWork).map((r) => r.id));

  const workspaceSurahs: WorkspaceSurahSummary[] = rawSurahs.map((s) => ({
    id: s.id,
    surahNumber: s.surahNumber,
    startedAt: s.startedAt,
    pageCount: s._count.pages,
    publishedCount: s.pages.filter((p) => p.status === "published").length,
    firstPageId: s.pages[0]?.id ?? null,
    hasWork: worked.has(s.id),
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
