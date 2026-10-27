/**
 * POST /api/workspaces/[workspaceId]/arabic/lessons/[lessonId]/board
 *   The lesson's board (notes document + canvas), made on first use.
 *   → { pageId }
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as ArabicService from "@/lib/services/arabic.service";
import { apiError } from "@/lib/api-errors";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string; lessonId: string }> },
) {
  try {
    const { workspaceId, lessonId } = await params;
    const { userId } = await getSession();
    return NextResponse.json({ pageId: await ArabicService.lessonBoard(workspaceId, userId, lessonId) });
  } catch (err) {
    return apiError(err);
  }
}
