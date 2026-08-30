/**
 * /home — personal study dashboard.
 *
 * Fetches in parallel:
 *   1. All workspaces (with surah counts + role)
 *   2. Most recently created page (resume card)
 *   3. User profile (name + avatar)
 *   4. Latest-started surah per workspace (card subtitles + last-studied date)
 *   5. Chapter list (surah names for display)
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { listForUser } from "@/lib/services/workspaces.service";
import { fetchChapters } from "@/lib/quran-api";
import * as Bookmarks from "@/lib/services/bookmarks.service";
import * as Analytics from "@/lib/services/analytics.service";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let userId: string;
  try {
    ({ userId } = await getSession());
  } catch (err) {
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    redirect("/login");
  }

  const [workspaces, lastPage, user, latestSurahs, chapters] = await Promise.all([
    listForUser(userId).catch((e) => { console.error("[home] listForUser failed:", e); throw e; }),

    db.page.findFirst({
      where: {
        workspaceSurah: {
          workspace: { members: { some: { userId } } },
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        workspaceSurah: {
          select: {
            surahNumber: true,
            workspace: { select: { id: true, name: true } },
          },
        },
      },
    }).catch((e) => { console.error("[home] lastPage query failed:", e); throw e; }),

    db.user.findUnique({
      where:  { id: userId },
      select: { name: true, avatarUrl: true },
    }).catch((e) => { console.error("[home] user query failed:", e); throw e; }),

    db.workspaceSurah.findMany({
      where:    { workspace: { members: { some: { userId } } }, surahNumber: { gte: 1 } }, // skip whiteboard sentinel
      orderBy:  { startedAt: "desc" },
      distinct: ["workspaceId"],
      select:   { workspaceId: true, surahNumber: true, startedAt: true },
    }).catch((e) => { console.error("[home] latestSurahs query failed:", e); throw e; }),

    fetchChapters().catch((e) => { console.error("[home] fetchChapters failed:", e); throw e; }),
  ]);

  // Build lightweight lookup: surahNumber → { name, arabic }
  const surahNames: Record<number, { name: string; arabic: string }> = {};
  for (const ch of chapters) {
    surahNames[ch.id] = { name: ch.name_simple, arabic: ch.name_arabic };
  }

  // Build workspaceId → { surahNumber, startedAt }
  const lastSurahMap = new Map(
    latestSurahs.map((s) => [s.workspaceId, { surahNumber: s.surahNumber, startedAt: s.startedAt }])
  );

  const enrichedWorkspaces = workspaces.map((ws) => {
    const last = lastSurahMap.get(ws.id);
    return {
      ...ws,
      lastSurahNumber: last?.surahNumber ?? null,
      lastStudiedAt:   last?.startedAt   ?? null,
    };
  });

  // Total surahs in progress across all workspaces
  const totalSurahs = workspaces.reduce((n, ws) => n + ws._count.surahs, 0);

  /* The rail and the streak. Separate from the block above only because they
     were added later; still one round of parallel queries, and each one is
     allowed to fail on its own — an empty rail is a worse dashboard, a
     missing dashboard is no dashboard. */
  const [bookmarks, summary] = await Promise.all([
    Bookmarks.listBookmarks(userId, 6).catch(() => []),
    Analytics.summary(userId, 0).catch(() => null),
  ]);

  return (
    <HomeClient
      workspaces={enrichedWorkspaces}
      lastPage={lastPage ?? null}
      user={user ?? null}
      surahNames={surahNames}
      totalSurahs={totalSurahs}
      bookmarks={bookmarks}
      streak={summary
        ? { current: summary.streak, today: summary.todayCount, goal: summary.dailyGoal }
        : null}
    />
  );
}
