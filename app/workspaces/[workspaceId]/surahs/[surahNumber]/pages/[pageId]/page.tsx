/**
 * /workspaces/[workspaceId]/surahs/[surahNumber]/pages/[pageId]
 *
 * Optimised to 2 true parallel rounds — no hidden serial chains.
 *
 * Round 1: session + cached Quran data (no DB)
 * Round 2: ALL 7 DB queries fire simultaneously, zero redundant
 *          getWorkspaceWithRole calls inside service helpers.
 */

export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { isAdmin, MemberRole } from "@/lib/services/workspaces.service";
import { ProgressStatus } from "@/lib/services/progress.service";
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

  // ── Round 1: session + cached Quran data (no DB round-trip for Quran) ──
  const [{ userId }, chapter, verses] = await Promise.all([
    getSession(),
    fetchChapter(surahNumber),
    fetchVerses(surahNumber),
  ]);

  // ── Round 2: all 7 DB queries fire in parallel ──────────────────────────
  const [
    workspace,
    membership,
    workspaceSurah,
    rawPages,
    activePage,
    userPrefs,
    progressRecords,
  ] = await Promise.all([
    // Access control
    db.workspace.findUnique({
      where:  { id: workspaceId },
      select: { id: true, name: true, type: true, ownerId: true },
    }),
    db.workspaceMember.findUnique({
      where:  { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    }),
    // Surah session
    db.workspaceSurah.findUnique({
      where:  { workspaceId_surahNumber: { workspaceId, surahNumber } },
      select: { id: true },
    }),
    // Pages list — filter via relation so we don't need workspaceSurahId first
    db.page.findMany({
      where:   { workspaceSurah: { workspaceId, surahNumber } },
      orderBy: { orderIndex: "asc" },
      select: {
        id:              true,
        title:           true,
        orderIndex:      true,
        status:          true,
        isAdminAuthored: true,
        createdById:     true,
        createdAt:       true,
        publishedAt:     true,
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    }),
    // Active page with full content
    db.page.findUnique({
      where: { id: pageId },
      include: {
        workspaceSurah: {
          include: {
            workspace: { select: { id: true, name: true, type: true, ownerId: true } },
          },
        },
        createdBy:   { select: { id: true, name: true, avatarUrl: true } },
        publishedBy: { select: { id: true, name: true, avatarUrl: true } },
        template:    { select: { id: true, name: true } },
        notes: {
          orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        },
      },
    }),
    // User prefs for this page
    db.pageUserPrefs.findUnique({
      where: { pageId_userId: { pageId, userId } },
    }),
    // Group progress
    db.groupAyahProgress.findMany({
      where:  { pageId },
      select: { surahNumber: true, ayahNumber: true, status: true, lastChangedBy: true },
    }),
  ]);

  // ── Access control ──────────────────────────────────────────────────────
  if (!workspace)    notFound();
  if (!membership)   redirect("/home");   // not a member
  if (!workspaceSurah) notFound();

  const role = membership.role as MemberRole;

  // ── Inline visibility helpers (mirrors pages.service logic) ────────────
  function canSeeDraft(page: { createdById: string }) {
    if (workspace!.type === "private") return workspace!.ownerId === userId;
    return isAdmin(role) || page.createdById === userId;
  }

  const pages = rawPages.filter((p) => {
    if (p.status === "published") return true;
    if (p.status === "draft")     return canSeeDraft(p);
    return false; // archived excluded from sidebar
  });

  // ── Active page visibility + prefs injection ────────────────────────────
  let normalizedPage = null;
  if (activePage) {
    const visible =
      activePage.status === "published" ||
      (activePage.status === "draft"    && canSeeDraft(activePage)) ||
      (activePage.status === "archived" && isAdmin(role));

    if (visible) {
      normalizedPage = {
        ...activePage,
        userPrefs: userPrefs
          ? { ...userPrefs, canvasViewport: userPrefs.canvasViewport as CanvasViewport | null }
          : null,
      };
    }
  }

  // ── Group progress map ──────────────────────────────────────────────────
  const groupProgress = Object.fromEntries(
    progressRecords.map((r) => [
      `${r.surahNumber}:${r.ayahNumber}`,
      { status: r.status as ProgressStatus, lastChangedBy: r.lastChangedBy },
    ])
  );

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
      currentUserId={userId}
    />
  );
}
