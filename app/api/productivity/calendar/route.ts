/**
 * GET    /api/productivity/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD → { connected, events }
 * PUT    /api/productivity/calendar { url }                      → { connected, upcoming }
 * DELETE /api/productivity/calendar                              → { connected: false }
 *
 * The Apple Calendar shown beside the plan (lib/productivity/calendar.ts).
 * Behind the Productivity password. The link itself never leaves the server:
 * it is the only key to the calendar, so the browser gets events and nothing
 * else.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasAccess, PLAN_ID } from "@/lib/productivity/gate";
import { checkUrl, eventsBetween } from "@/lib/productivity/calendar";

const DAY = /^\d{4}-\d\d-\d\d$/;
const MAX_DAYS = 70;

const locked = () => NextResponse.json({ error: "Locked" }, { status: 401 });

async function link(): Promise<string | null> {
  const row = await db.productivityPlan.findUnique({ where: { id: PLAN_ID }, select: { calendarUrl: true } });
  return row?.calendarUrl ?? null;
}

/** Why iCloud didn't hand the calendar over, in words for the page. */
function reason(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m === "Not shared") return "That calendar isn’t shared any more. Turn on Public Calendar for it again, or paste its new link.";
  if (m === "Not a calendar") return "That link didn’t lead to a calendar.";
  return "Couldn’t reach iCloud just now.";
}

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function GET(req: NextRequest) {
  if (!(await hasAccess())) return locked();
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  if (!DAY.test(from) || !DAY.test(to) || to <= from || to > addDays(from, MAX_DAYS)) {
    return NextResponse.json({ error: "Ask for up to ten weeks at a time" }, { status: 400 });
  }
  const url = await link();
  if (!url) return NextResponse.json({ connected: false, events: [] });
  try {
    const events = await eventsBetween(url, from, to);
    return NextResponse.json({ connected: true, events }, { headers: { "Cache-Control": "private, max-age=120" } });
  } catch (e) {
    return NextResponse.json({ connected: true, events: [], error: reason(e) }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await hasAccess())) return locked();
  const body = await req.json().catch(() => null) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? checkUrl(body.url) : null;
  if (!url) {
    return NextResponse.json({ error: "That isn’t an iCloud calendar link. It starts with webcal:// and has icloud.com in it." }, { status: 400 });
  }
  // Read it once before keeping it, so a wrong link is caught here.
  const today = new Date().toISOString().slice(0, 10);
  let upcoming: number;
  try { upcoming = (await eventsBetween(url, today, addDays(today, 30))).length; }
  catch (e) { return NextResponse.json({ error: reason(e) }, { status: 400 }); }
  await db.productivityPlan.update({ where: { id: PLAN_ID }, data: { calendarUrl: url } });
  return NextResponse.json({ connected: true, upcoming });
}

export async function DELETE() {
  if (!(await hasAccess())) return locked();
  await db.productivityPlan.update({ where: { id: PLAN_ID }, data: { calendarUrl: null } });
  return NextResponse.json({ connected: false });
}
