/**
 * /explore — find anywhere in the muṣḥaf.
 *
 * Four ways in, because people hold a reference in four different shapes:
 * a name, a juzʾ, a page number, or a half-remembered phrase.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { fetchChapters } from "@/lib/quran-api";
import * as Analytics from "@/lib/services/analytics.service";
import ExploreClient from "./ExploreClient";

export default async function ExploreRoute() {
  const { userId } = await getSession();

  const [user, chapters, summary, workspaces] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true } }),
    fetchChapters().catch(() => []),
    Analytics.summary(userId, 0).catch(() => null),
    /* Where a result should open. A surah is not a place on its own — it needs
       a notebook to be opened in — so the picker needs the list. */
    db.workspace.findMany({
      where:   { members: { some: { userId } }, kind: "study" },
      orderBy: { createdAt: "asc" },
      select:  { id: true, name: true },
    }),
  ]);

  return (
    <ExploreClient
      user={user ?? null}
      chapters={chapters}
      workspaces={workspaces}
      streak={summary
        ? { current: summary.streak, today: summary.todayCount, goal: summary.dailyGoal }
        : { current: 0, today: 0, goal: 10 }}
    />
  );
}
