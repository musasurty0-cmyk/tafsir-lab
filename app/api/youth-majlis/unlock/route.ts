/**
 * POST   /api/youth-majlis/unlock   { area: "majlis" | "ilmi", password }
 *   200 { ok: true } and a gate cookie, or 401 { error } for a wrong password.
 *   The ʿIlmī area is only reachable once the main portal is unlocked.
 * DELETE /api/youth-majlis/unlock   — leave: clears both gate cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import { hasAccess, lock, unlock, type GateArea } from "@/lib/youth-majlis/gate";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { area?: unknown; password?: unknown } | null;
  const area: GateArea | null = body?.area === "ilmi" ? "ilmi" : body?.area === "majlis" ? "majlis" : null;
  const typed = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
  if (!area || !typed) return NextResponse.json({ error: "Enter the password." }, { status: 400 });

  if (area === "ilmi" && !(await hasAccess("majlis"))) {
    return NextResponse.json({ error: "Open the Youth Majlis portal first." }, { status: 403 });
  }

  if (await unlock(area, typed)) return NextResponse.json({ ok: true });

  // A beat before answering, so the gate is not a free guessing machine.
  await new Promise((r) => setTimeout(r, 600));
  return NextResponse.json({ error: "That password isn’t right." }, { status: 401 });
}

export async function DELETE() {
  await lock();
  return NextResponse.json({ ok: true });
}
