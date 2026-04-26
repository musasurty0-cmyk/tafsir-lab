/**
 * GET  /api/pages/[pageId]/drawings
 *   Returns { myStrokes, otherLayers } where
 *     myStrokes   = current user's stroke array (may be empty)
 *     otherLayers = [{ authorId, authorName, strokes }] for all other users
 *
 * PUT  /api/pages/[pageId]/drawings
 *   Body: { strokes: Stroke[] }
 *   Upserts the current user's CanvasDrawing record for this page.
 *   Returns { ok: true }.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  try {
    const { userId }  = await getSession();
    const { pageId }  = await params;

    const drawings = await db.canvasDrawing.findMany({
      where:   { pageId },
      include: { author: { select: { id: true, name: true } } },
    });

    // Safely parse strokes — they are stored as Json which may be any value.
    function parseStrokes(raw: unknown): object[] {
      if (Array.isArray(raw)) return raw as object[];
      return [];
    }

    const mine = drawings.find((d) => d.authorId === userId);
    const others = drawings
      .filter((d) => d.authorId !== userId)
      .map((d) => ({
        authorId:   d.authorId,
        authorName: d.author.name,
        strokes:    parseStrokes(d.strokes),
      }));

    return NextResponse.json({
      myStrokes:   mine ? parseStrokes(mine.strokes) : [],
      otherLayers: others,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ── PUT ────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;

    const body = await req.json() as { strokes?: unknown };
    const strokes = Array.isArray(body.strokes) ? body.strokes : [];

    await db.canvasDrawing.upsert({
      where:  { pageId_authorId: { pageId, authorId: userId } },
      create: { pageId, authorId: userId, strokes },
      update: { strokes },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
