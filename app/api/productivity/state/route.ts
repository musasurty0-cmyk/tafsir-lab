/**
 * GET /api/productivity/state   → { state, updatedAt }
 * PUT /api/productivity/state   { state } → { updatedAt }
 *
 * The timetable as edited, so it is the same on every device. Behind the
 * Productivity password; the plan's draft is never sent from here.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasAccess, PLAN_ID } from "@/lib/productivity/gate";

const LIMIT = 1_000_000; // a fortnight of blocks is ~50 KB

export async function GET() {
  if (!(await hasAccess())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const row = await db.productivityPlan.findUnique({ where: { id: PLAN_ID }, select: { state: true, updatedAt: true } });
  return NextResponse.json({ state: row?.state ?? null, updatedAt: row?.updatedAt ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(req: NextRequest) {
  if (!(await hasAccess())) return NextResponse.json({ error: "Locked" }, { status: 401 });
  const text = await req.text();
  if (text.length > LIMIT) return NextResponse.json({ error: "Too large" }, { status: 413 });
  let body: { state?: { days?: unknown } } | null = null;
  try { body = JSON.parse(text); } catch { /* handled below */ }
  if (!body?.state || !Array.isArray(body.state.days)) {
    return NextResponse.json({ error: "Not a timetable" }, { status: 400 });
  }
  const row = await db.productivityPlan.update({
    where: { id: PLAN_ID },
    data: { state: body.state as object },
    select: { updatedAt: true },
  });
  return NextResponse.json({ updatedAt: row.updatedAt });
}
