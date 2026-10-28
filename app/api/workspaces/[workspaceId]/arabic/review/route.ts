/**
 * GET  /api/workspaces/[workspaceId]/arabic/review
 *        ?scope=due|lesson|unlock|cards &lesson=<id> &ids=<id,id…> &sentences=1 &limit=20
 *      → { cards, pool } — what to practise, and the words wrong answers
 *        are drawn from.
 * POST /api/workspaces/[workspaceId]/arabic/review
 *      Body: { answers: [{ cardId, correct, unlock? }] }
 *      → { [cardId]: { box, status } }
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
    const q = new URL(req.url).searchParams;
    const scope = q.get("scope");
    if (scope !== "due" && scope !== "lesson" && scope !== "unlock" && scope !== "cards") {
      return NextResponse.json({ error: "scope must be due, lesson, unlock or cards" }, { status: 400 });
    }
    const limit = Number(q.get("limit") ?? 20);
    const result = await ArabicService.reviewQueue(workspaceId, userId, {
      scope,
      lessonId:  q.get("lesson") ?? undefined,
      cardIds:   q.get("ids")?.split(",") ?? undefined,
      sentences: q.get("sentences") === "1",
      limit:     Number.isFinite(limit) ? limit : 20,
    });
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const body = await req.json().catch(() => null) as { answers?: unknown } | null;
    const result = await ArabicService.recordAnswers(workspaceId, userId, body?.answers);
    return NextResponse.json(result);
  } catch (err) {
    return apiError(err);
  }
}
