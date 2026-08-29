/**
 * GET /api/analytics
 *   One request, everything the Activity tab needs: summary + a month of
 *   daily counts. Kept as one round trip because the page renders both at
 *   once and two requests would show two different loading states.
 *
 *   Query: ?month=YYYY-MM      (default: the current month in the viewer's tz)
 *          &tz=<minutes>       (getTimezoneOffset(); default 0)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as Analytics from "@/lib/services/analytics.service";
import { apiError } from "@/lib/api-errors";

/** Last day of the given YYYY-MM, as YYYY-MM-DD. */
function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(days).padStart(2, "0")}` };
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const q  = req.nextUrl.searchParams;

    // The offset is a number of minutes and nothing else. A junk value must
    // not silently become NaN and shift every date by an invalid amount.
    const tzRaw = Number(q.get("tz"));
    const tz = Number.isFinite(tzRaw) && Math.abs(tzRaw) <= 900 ? tzRaw : 0;

    const month = /^\d{4}-\d{2}$/.test(q.get("month") ?? "")
      ? q.get("month")!
      : new Date(Date.now() - tz * 60_000).toISOString().slice(0, 7);

    const { from, to } = monthBounds(month);
    const [summary, days] = await Promise.all([
      Analytics.summary(userId, tz),
      Analytics.daily(userId, from, to, tz),
    ]);

    return NextResponse.json({ summary, month, days });
  } catch (err) {
    return apiError(err);
  }
}
