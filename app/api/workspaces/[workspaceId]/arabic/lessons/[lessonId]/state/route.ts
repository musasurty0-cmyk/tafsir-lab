/**
 * PUT /api/workspaces/[workspaceId]/arabic/lessons/[lessonId]/state
 *   Body: { state: "covered" | "current" | null }  — this lesson only, or
 *         { placeHere: true }                       — this lesson current and
 *                                                     every earlier one covered.
 *   Per reader. Returns { ok: true }.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as ArabicService from "@/lib/services/arabic.service";
import { apiError } from "@/lib/api-errors";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string; lessonId: string }> },
) {
  try {
    const { workspaceId, lessonId } = await params;
    const { userId } = await getSession();
    const body = await req.json().catch(() => ({})) as { state?: unknown; placeHere?: unknown };

    if (body.placeHere === true) {
      await ArabicService.setCurrentLesson(workspaceId, userId, lessonId);
      return NextResponse.json({ ok: true });
    }
    const state = body.state === "covered" || body.state === "current" ? body.state
                : body.state === null ? null
                : undefined;
    if (state === undefined) {
      return NextResponse.json({ error: "state must be 'covered', 'current' or null" }, { status: 400 });
    }
    await ArabicService.setLessonState(workspaceId, userId, lessonId, state);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
