/**
 * /leaderboard — ranking by annotations written.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as Social from "@/lib/services/social.service";
import * as Analytics from "@/lib/services/analytics.service";
import LeaderboardClient from "./LeaderboardClient";

export default async function LeaderboardRoute() {
  const { userId } = await getSession();

  const [user, rows, summary] = await Promise.all([
    db.user.findUnique({
      where:  { id: userId },
      select: { name: true, avatarUrl: true, publicLeaderboard: true },
    }),
    Social.leaderboard(userId, "global"),
    Analytics.summary(userId, 0),
  ]);

  return (
    <LeaderboardClient
      user={user ? { name: user.name, avatarUrl: user.avatarUrl } : null}
      isPublic={user?.publicLeaderboard ?? true}
      initialRows={rows}
      streak={{ current: summary.streak, today: summary.todayCount, goal: summary.dailyGoal }}
    />
  );
}
