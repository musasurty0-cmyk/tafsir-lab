/**
 * /friends — who you study alongside.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as Social from "@/lib/services/social.service";
import * as Analytics from "@/lib/services/analytics.service";
import FriendsClient from "./FriendsClient";

export default async function FriendsRoute() {
  const { userId } = await getSession();

  const [user, friends, summary] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true } }),
    Social.friendsOf(userId),
    Analytics.summary(userId, 0),
  ]);

  return (
    <FriendsClient
      user={user ?? null}
      initialFriends={friends}
      streak={{ current: summary.streak, today: summary.todayCount, goal: summary.dailyGoal }}
    />
  );
}
