/**
 * /workspaces/[workspaceId]/surahs/[surahNumber]
 *
 * Resolves the surah session and redirects to the first available page.
 * If no pages exist, shows an empty-state shell (Phase 2 — page creation UI
 * comes in a later phase).
 */

import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService from "@/lib/services/pages.service";
import { db } from "@/lib/db";
import { fetchChapter } from "@/lib/quran-api";
import SurahNoPages from "@/components/workspace/SurahNoPages";

export default async function SurahIndexPage({
  params,
}: {
  params: Promise<{ workspaceId: string; surahNumber: string }>;
}) {
  const { workspaceId, surahNumber: surahNumberStr } = await params;
  const surahNumber = parseInt(surahNumberStr, 10);

  if (isNaN(surahNumber) || surahNumber < 1 || surahNumber > 114) notFound();

  const { userId } = await getSession();

  const workspaceSurah = await db.workspaceSurah.findUnique({
    where: { workspaceId_surahNumber: { workspaceId, surahNumber } },
    select: { id: true },
  });
  if (!workspaceSurah) notFound();

  const [{ workspace, role }, pages, chapter] = await Promise.all([
    WorkspacesService.getWorkspaceWithRole(workspaceId, userId),
    PagesService.listPages(workspaceSurah.id, userId),
    fetchChapter(surahNumber),
  ]);

  // Redirect to first page if any exist.
  if (pages.length > 0) {
    redirect(
      `/workspaces/${workspaceId}/surahs/${surahNumber}/pages/${pages[0].id}`
    );
  }

  // No pages yet.
  return (
    <SurahNoPages
      workspaceId={workspaceId}
      workspace={workspace}
      role={role}
      chapter={chapter}
      surahNumber={surahNumber}
    />
  );
}
