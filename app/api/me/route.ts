/**
 * PATCH /api/me
 *   Body: any of { name, publicLeaderboard, dailyGoal, avatarUrl }
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
      avatarUrl?: unknown;
    };

    const data: {
      name?: string; publicLeaderboard?: boolean; dailyGoal?: number;
      avatarUrl?: string | null;
    } = {};

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

    if (body.avatarUrl !== undefined) {
      /* null clears the picture and falls back to initials. */
      if (body.avatarUrl === null) {
        data.avatarUrl = null;
      } else {
        const url = typeof body.avatarUrl === "string" ? body.avatarUrl : "";

        /* Only an inline image. A remote URL here would let anyone point every
           avatar in the app at a host they control — which is a tracking pixel
           on every page that renders a member list, and a broken image the day
           they take it down. */
        if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(url))
          return NextResponse.json({ error: "avatarUrl must be an inline PNG, JPEG or WebP" }, { status: 400 });

        /* The client downscales to 256px before sending, so anything past this
           is either a bug or someone bypassing the form. The row sits in a
           database on a 500 MB tier; an unbounded string column is how that
           budget disappears without anyone noticing. */
        const bytes = Math.floor((url.length - url.indexOf(",") - 1) * 3 / 4);
        if (bytes > 200_000)
          return NextResponse.json({ error: "image too large — 200 KB maximum" }, { status: 413 });

        data.avatarUrl = url;
      }
    }

    if (Object.keys(data).length === 0)
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });

    const user = await db.user.update({
      where:  { id: userId },
      data,
      select: { id: true, name: true, publicLeaderboard: true, dailyGoal: true, avatarUrl: true },
    });

    return NextResponse.json({ ok: true, user, name: user.name });
  } catch (err) {
    return apiError(err);
  }
}
