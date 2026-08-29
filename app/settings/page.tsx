/**
 * /settings — appearance, account, plan, and how to reach us.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as Analytics from "@/lib/services/analytics.service";
import SettingsClient from "./SettingsClient";

export default async function SettingsRoute() {
  const { userId } = await getSession();

  const [user, summary] = await Promise.all([
    db.user.findUnique({
      where:  { id: userId },
      select: { name: true, email: true, avatarUrl: true, publicLeaderboard: true, dailyGoal: true },
    }),
    Analytics.summary(userId, 0),
  ]);

  return (
    <SettingsClient
      user={user ?? null}
      streak={{ current: summary.streak, today: summary.todayCount, goal: summary.dailyGoal }}
    />
  );
}
