/**
 * GET  /api/pages/[pageId]/drawings
 *   Returns { myStrokes, otherLayers } where
 *     myStrokes   = current user's stroke array (may be empty; both surfaces)
 *     otherLayers = [{ authorId, authorName, strokes }] for all other users
 *
 * PUT  /api/pages/[pageId]/drawings
 *   Body: { strokes: Stroke[], surface?: "canvas" | "editor" }
 *   Replaces ONLY the given surface's strokes in the user's record and
 *   preserves the other surface (the Mushaf canvas and the editor ink
 *   overlay save independently; a missing surface means "canvas" for
 *   backward compatibility). Returns { ok: true }.
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

    const body = await req.json() as { strokes?: unknown; surface?: unknown };
    const incoming = Array.isArray(body.strokes) ? body.strokes as { surface?: string }[] : [];
    const surface  = body.surface === "editor" ? "editor" : "canvas";

    // Stamp the surface on incoming strokes, then merge with the OTHER
    // surface's existing strokes so canvas and editor saves never clobber
    // each other (both save the full array for their own surface only).
    const stamped = incoming.map((s) => ({ ...s, surface }));

    const existing = await db.canvasDrawing.findUnique({
      where:  { pageId_authorId: { pageId, authorId: userId } },
      select: { strokes: true },
    });
    const prev = Array.isArray(existing?.strokes)
      ? (existing!.strokes as { surface?: string }[])
      : [];
    const kept   = prev.filter((s) => (s?.surface === "editor" ? "editor" : "canvas") !== surface);
    const merged = [...kept, ...stamped];

    await db.canvasDrawing.upsert({
      where:  { pageId_authorId: { pageId, authorId: userId } },
      create: { pageId, authorId: userId, strokes: merged },
      update: { strokes: merged },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
