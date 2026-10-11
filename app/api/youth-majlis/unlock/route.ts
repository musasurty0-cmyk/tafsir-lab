/**
 * POST   /api/youth-majlis/unlock   { password }
 *   200 { ok: true } and the gate cookie, or 401 { error } for a wrong password.
 * DELETE /api/youth-majlis/unlock   — leave: clears the gate cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { lock, unlock } from "@/lib/youth-majlis/gate";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null) as { password?: unknown } | null;
  const typed = typeof body?.password === "string" ? body.password.slice(0, 200) : "";
  if (!typed) return NextResponse.json({ error: "Enter the password." }, { status: 400 });

  if (await unlock("majlis", typed)) return NextResponse.json({ ok: true });

  // A beat before answering, so the gate is not a free guessing machine.
  await new Promise((r) => setTimeout(r, 600));
  return NextResponse.json({ error: "That password isn’t right." }, { status: 401 });
}

export async function DELETE() {
  await lock();
  return NextResponse.json({ ok: true });
}
