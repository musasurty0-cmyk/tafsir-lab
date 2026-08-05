/**
 * GET  /api/pages/[pageId]/drawings
 *   Returns { myStrokes, otherLayers } where
 *     myStrokes   = current user's stroke array (may be empty; both surfaces)
 *     otherLayers = [{ authorId, authorName, strokes }] for all other users
 *
 * PUT  /api/pages/[pageId]/drawings
 *   Body: { strokes: Stroke[], surface?: "canvas" | "editor", deletedIds?: string[] }
 *   MERGES the given surface's strokes by id: the client's copies win for
 *   ids it sends, strokes it doesn't know about are PRESERVED (same account
 *   on another device, or a stroke drawn before this client's initial load),
 *   and only ids listed in deletedIds are removed. The other surface is
 *   untouched (canvas and editor ink save independently; a missing surface
 *   means "canvas" for backward compatibility). Returns { ok: true }.
 *
 *   The old replace-the-surface semantics silently destroyed strokes the
 *   writing client didn't have in memory — the root cause of annotation
 *   layers "randomly disappearing".
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { assertPageAccess } from "@/lib/services/pages.service";
import { apiError } from "@/lib/api-errors";

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  try {
    const { userId }  = await getSession();
    const { pageId }  = await params;
    // Membership gate: this route reads every author's ink on the page, so a
    // non-member must not reach it. Was previously ungated (IDOR).
    await assertPageAccess(pageId, userId);

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
    return apiError(err);
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
    // Membership is the gate, matching saveDrawing()'s existing policy: any
    // member may annotate, a non-member cannot reach the page at all.
    await assertPageAccess(pageId, userId);

    const body = await req.json() as { strokes?: unknown; surface?: unknown; deletedIds?: unknown };
    const incoming = Array.isArray(body.strokes) ? body.strokes as { id?: string; surface?: string }[] : [];
    const surface  = body.surface === "editor" ? "editor" : "canvas";
    const deleted  = new Set(
      Array.isArray(body.deletedIds)
        ? (body.deletedIds as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
    );

    // Stamp the surface on incoming strokes.
    const stamped = incoming.map((s) => ({ ...s, surface }));

    const existing = await db.canvasDrawing.findUnique({
      where:  { pageId_authorId: { pageId, authorId: userId } },
      select: { strokes: true },
    });
    const prev = Array.isArray(existing?.strokes)
      ? (existing!.strokes as { id?: string; surface?: string }[])
      : [];

    // Other surface passes through untouched. Within the saved surface,
    // merge by id: client copies win, unknown-to-client strokes survive,
    // explicit deletions are honored. Additive-by-default means a client
    // that loaded an empty/stale set can never wipe strokes it never saw.
    const keptOther   = prev.filter((s) => (s?.surface === "editor" ? "editor" : "canvas") !== surface);
    const clientIds   = new Set(stamped.map((s) => s.id).filter(Boolean));
    const keptSame    = prev.filter((s) =>
      (s?.surface === "editor" ? "editor" : "canvas") === surface &&
      s.id != null && !clientIds.has(s.id) && !deleted.has(s.id));
    const merged = [...keptOther, ...keptSame, ...stamped.filter((s) => s.id == null || !deleted.has(s.id))];

    await db.canvasDrawing.upsert({
      where:  { pageId_authorId: { pageId, authorId: userId } },
      create: { pageId, authorId: userId, strokes: merged },
      update: { strokes: merged },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
