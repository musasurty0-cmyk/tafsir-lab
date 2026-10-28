/**
 * GET  /api/workspaces/[workspaceId]/arabic/words
 *   Every single-word card, with this reader's box. → { cards: [...] }
 * POST /api/workspaces/[workspaceId]/arabic/words
 *   Body: { arabic, english, translit? } — add a word to "My words".
 *   → { cardId, added }
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as ArabicService from "@/lib/services/arabic.service";
import { apiError } from "@/lib/api-errors";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    return NextResponse.json({ cards: await ArabicService.wordCards(workspaceId, userId) });
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
    const body = await req.json().catch(() => ({})) as { arabic?: unknown; english?: unknown; translit?: unknown };
    return NextResponse.json(await ArabicService.addMyWord(workspaceId, userId, body), { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
