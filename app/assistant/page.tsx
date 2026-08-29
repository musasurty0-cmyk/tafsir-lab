/**
 * /assistant — ask the tafsīr corpus a question.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as Analytics from "@/lib/services/analytics.service";
import { availableSources } from "@/lib/services/tafsir-search.service";
import AssistantClient from "./AssistantClient";

export default async function AssistantRoute() {
  const { userId } = await getSession();

  const [user, summary, sources] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { name: true, avatarUrl: true } }),
    Analytics.summary(userId, 0).catch(() => null),
    // Rendered on the server so the picker is populated on first paint; an
    // empty picker that fills in a moment later reads as broken.
    availableSources().catch(() => []),
  ]);

  return (
    <AssistantClient
      user={user ?? null}
      sources={sources}
      streak={summary
        ? { current: summary.streak, today: summary.todayCount, goal: summary.dailyGoal }
        : { current: 0, today: 0, goal: 10 }}
    />
  );
}
