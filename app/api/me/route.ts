/**
 * PATCH /api/me
 *   Body: { name: string }
 *   Updates the display name of the currently signed-in user.
 *   Returns { ok: true, name: string }.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const body = await req.json() as { name?: unknown };
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const user = await db.user.update({
      where:  { id: userId },
      data:   { name },
      select: { id: true, name: true },
    });

    return NextResponse.json({ ok: true, name: user.name });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
