/**
 * /contact — reach the team.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as Analytics from "@/lib/services/analytics.service";
import ContactClient from "./ContactClient";

export default async function ContactRoute() {
  const { userId } = await getSession();

  const [user, summary] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, email: true, avatarUrl: true } }),
    Analytics.summary(userId, 0),
  ]);

  return (
    <ContactClient
      user={user ? { name: user.name, avatarUrl: user.avatarUrl } : null}
      email={user?.email ?? ""}
      streak={{ current: summary.streak, today: summary.todayCount, goal: summary.dailyGoal }}
    />
  );
}
