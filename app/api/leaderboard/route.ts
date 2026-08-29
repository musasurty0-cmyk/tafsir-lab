/**
 * GET /api/leaderboard?scope=global|friends
 *   Ranking by annotation count. Counts the same rows analytics does, so a
 *   user's rank and their own total can never disagree.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as Social from "@/lib/services/social.service";
import { apiError } from "@/lib/api-errors";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const scope = req.nextUrl.searchParams.get("scope") === "friends" ? "friends" : "global";
    return NextResponse.json({ scope, rows: await Social.leaderboard(userId, scope) });
  } catch (err) { return apiError(err); }
}
