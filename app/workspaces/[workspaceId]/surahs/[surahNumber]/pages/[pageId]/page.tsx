/**
 * /workspaces/[workspaceId]/surahs/[surahNumber]/pages/[pageId]
 *
 * Full workspace view: Rail + Sidebar + TopBar + ModeAPage (Phase 3).
 * All stable data fetched server-side; interactive state lives in WorkspacePageView.
 */

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService from "@/lib/services/pages.service";
import * as ProgressService from "@/lib/services/progress.service";
import { db } from "@/lib/db";
import WorkspacePageView from "@/components/workspace/WorkspacePageView";
import type { CanvasViewport } from "@/components/workspace/ModeBPage";
import { fetchChapter, fetchVerses } from "@/lib/quran-api";

export default async function PageViewPage({
  params,
}: {
  params: Promise<{
    workspaceId: string;
    surahNumber: string;
    pageId: string;
  }>;
}) {
  const { workspaceId, surahNumber: surahNumberStr, pageId } = await params;
  const surahNumber = parseInt(surahNumberStr, 10);

  if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) notFound();

  const { userId } = await getSession();

  // Resolve workspace_surah.
  const workspaceSurah = await db.workspaceSurah.findUnique({
    where: { workspaceId_surahNumber: { workspaceId, surahNumber } },
    select: { id: true },
  });
  if (!workspaceSurah) notFound();

  // Fetch all stable data in parallel.
  const [{ workspace, role }, pages, page, chapter, verses] = await Promise.all([
    WorkspacesService.getWorkspaceWithRole(workspaceId, userId),
    PagesService.listPages(workspaceSurah.id, userId, { includeArchived: false }),
    PagesService.getPage(pageId, userId).catch(() => null),
    fetchChapter(surahNumber),
    fetchVerses(surahNumber),
  ]);

  // Group progress for the active page — fetch only if page exists.
  const groupProgressMap = page
    ? await ProgressService.getGroupProgress(pageId, userId)
    : new Map<string, { status: ProgressService.ProgressStatus; lastChangedBy: string }>();

  // Serialize Map → plain object for the RSC → client boundary.
  const groupProgress = Object.fromEntries(groupProgressMap);

  // Cast Prisma's JsonValue for canvasViewport to the expected CanvasViewport type.
  const normalizedPage = page
    ? {
        ...page,
        userPrefs: page.userPrefs
          ? {
              ...page.userPrefs,
              canvasViewport: page.userPrefs.canvasViewport as CanvasViewport | null,
            }
          : null,
      }
    : null;

  return (
    <WorkspacePageView
      workspaceId={workspaceId}
      workspace={workspace}
      role={role}
      chapter={chapter}
      surahNumber={surahNumber}
      verses={verses}
      pages={pages}
      activePageId={pageId}
      page={normalizedPage}
      groupProgress={groupProgress}
    />
  );
}
