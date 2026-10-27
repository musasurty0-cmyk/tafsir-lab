/**
 * POST /api/workspaces/[workspaceId]/arabic/import
 *   Body: { lessons: [{ level, fileNo, title, cards: [{ english, arabic,
 *   translit, gender, group, isSentence }] }] } — parsed in the browser from
 *   the reader's own deck files; re-validated and bounded by the service.
 *   Optional currentAt: { level, fileNo } — the lesson the reader is on.
 *   Returns { added, skipped, cards }.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as ArabicService from "@/lib/services/arabic.service";
import { apiError } from "@/lib/api-errors";

export const maxDuration = 60;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const body = await req.json().catch(() => null) as { lessons?: unknown; currentAt?: unknown } | null;
    const c = body?.currentAt as { level?: unknown; fileNo?: unknown } | undefined;
    const currentAt = c && Number.isInteger(c.level) && Number.isInteger(c.fileNo)
      ? { level: c.level as number, fileNo: c.fileNo as number }
      : null;
    const result = await ArabicService.importLessons(workspaceId, userId, body?.lessons, currentAt);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
