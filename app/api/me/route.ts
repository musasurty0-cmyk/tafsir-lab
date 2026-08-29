/**
 * PATCH /api/me
 *   Body: any of { name, publicLeaderboard, dailyGoal }
 *   Updates the signed-in user's own profile. Fields are independent: sending
 *   one does not clear the others, so the leaderboard toggle and the settings
 *   form can share this route without stepping on each other.
 *   Returns { ok: true, user: {...} }.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { apiError } from "@/lib/api-errors";

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const body = await req.json().catch(() => ({})) as {
      name?: unknown; publicLeaderboard?: unknown; dailyGoal?: unknown;
    };

    const data: { name?: string; publicLeaderboard?: boolean; dailyGoal?: number } = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
      data.name = name.slice(0, 80);
    }

    if (body.publicLeaderboard !== undefined) {
      if (typeof body.publicLeaderboard !== "boolean")
        return NextResponse.json({ error: "publicLeaderboard must be a boolean" }, { status: 400 });
      data.publicLeaderboard = body.publicLeaderboard;
    }

    if (body.dailyGoal !== undefined) {
      const n = Number(body.dailyGoal);
      // Clamped rather than rejected: the stepper cannot produce an out-of-range
      // value, so anything odd here is not worth an error the user has to read.
      if (!Number.isFinite(n)) return NextResponse.json({ error: "dailyGoal must be a number" }, { status: 400 });
      data.dailyGoal = Math.max(1, Math.min(200, Math.round(n)));
    }

    if (Object.keys(data).length === 0)
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });

    const user = await db.user.update({
      where:  { id: userId },
      data,
      select: { id: true, name: true, publicLeaderboard: true, dailyGoal: true },
    });

    return NextResponse.json({ ok: true, user, name: user.name });
  } catch (err) {
    return apiError(err);
  }
}
