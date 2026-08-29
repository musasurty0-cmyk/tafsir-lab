/**
 * GET /api/analytics/map
 *   Rows for the Annotation Map.
 *   Query: ?scope=all|pages|surahs|verses|words   (default all)
 *          &workspaceId=<uuid>                    (optional; scope to one)
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as Analytics from "@/lib/services/analytics.service";
import { apiError } from "@/lib/api-errors";

const SCOPES = ["all", "pages", "surahs", "verses", "words"] as const;

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const q = req.nextUrl.searchParams;

    const raw = q.get("scope") ?? "all";
    const scope = (SCOPES as readonly string[]).includes(raw)
      ? (raw as Analytics.MapScope)
      : "all";

    const workspaceId = q.get("workspaceId") || undefined;

    const rows = await Analytics.map(userId, scope, workspaceId);
    return NextResponse.json({ scope, rows });
  } catch (err) {
    return apiError(err);
  }
}
