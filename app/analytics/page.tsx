/**
 * /analytics — what you have actually written, counted two ways.
 *
 *   Activity       — the shape of your habit: totals, a month calendar, streak
 *   Annotation Map — the shape of your coverage: which pages, surahs, verses
 *                    and words carry notes
 *
 * The numbers are computed on read from the notes themselves (see
 * analytics.service), so this page cannot show a total that no longer matches
 * the notes behind it.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as Analytics from "@/lib/services/analytics.service";
import AnalyticsClient from "./AnalyticsClient";

export default async function AnalyticsRoute() {
  const { userId } = await getSession();

  const [user, summary, workspaces] = await Promise.all([
    db.user.findUnique({
      where:  { id: userId },
      select: { name: true, avatarUrl: true },
    }),
    // Server render uses UTC; the client re-fetches with its real offset on
    // mount, which corrects the calendar for anyone not on UTC without
    // blocking first paint on a round trip.
    Analytics.summary(userId, 0),
    db.workspace.findMany({
      where:   { members: { some: { userId } } },
      orderBy: { createdAt: "asc" },
      select:  { id: true, name: true },
    }),
  ]);

  return (
    <AnalyticsClient
      user={user ?? null}
      initialSummary={summary}
      workspaces={workspaces}
    />
  );
}
