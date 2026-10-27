/**
 * GET /api/workspaces/[workspaceId]/arabic/search?q=
 *   Cards matching q in English, or in Arabic with or without ḥarakāt.
 *   Returns { results: [...] }, at most 40.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as ArabicService from "@/lib/services/arabic.service";
import { apiError } from "@/lib/api-errors";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const results = await ArabicService.search(workspaceId, userId, q);
    return NextResponse.json({ results });
  } catch (err) {
    return apiError(err);
  }
}
