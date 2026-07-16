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

  const [{ workspace, role }, chapters, rawSurahs] = await Promise.all([
    WorkspacesService.getWorkspaceWithRole(workspaceId, userId),
    fetchChapters(),
    db.workspaceSurah.findMany({
      where: { workspaceId },
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
