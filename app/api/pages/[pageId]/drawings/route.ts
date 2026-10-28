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

import { gzipSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";
import { packStrokes } from "@/lib/ink";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { assertPageAccess } from "@/lib/services/pages.service";
import { apiError } from "@/lib/api-errors";

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
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

    const json = JSON.stringify({
      myStrokes:   mine ? parseStrokes(mine.strokes) : [],
      otherLayers: others,
    });

    /* Compressed here, in the function, because Vercel refuses any function
       response over 4.5 MB -- measured on the body the function returns,
       before the edge would have compressed it. This reply carries EVERY
       author's ink on the page, and a page two people had both written on
       came to 4.7 MB: it could not load for either of them, and ink drawn on
       an empty-looking board was the only copy. Stroke JSON is mostly digits
       and gzips about 6x, which puts the largest real board at 0.76 MB. */
    if (/\bgzip\b/.test(req.headers.get("accept-encoding") ?? "")) {
      return new NextResponse(new Uint8Array(gzipSync(json)), {
        headers: {
          "Content-Type":     "application/json",
          "Content-Encoding": "gzip",
          "Vary":             "Accept-Encoding",
        },
      });
    }
    return new NextResponse(json, { headers: { "Content-Type": "application/json" } });
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

    /* Read, merge and write as ONE step per author and page. Two saves in
       flight together -- the canvas and the note page saving at once, a retry
       crossing a fresh save, a closing tab's flush -- each read the row before
       the other wrote it, and the second write threw away the first one's
       strokes. The client had been told they were saved, so nothing sent them
       again.

       Compare-and-swap, not a lock: the write only lands if the row is still
       the one that was read (same updatedAt), else it reads again and
       re-merges. A lock held a database connection for as long as a save
       waited, and the free plan has few to spare -- when the database
       stalled, waiting saves held them all and every page failed with them. */
    let saved = false;
    for (let attempt = 0; attempt < 4 && !saved; attempt++) {
      const existing = await db.canvasDrawing.findUnique({
        where:  { pageId_authorId: { pageId, authorId: userId } },
        select: { strokes: true, updatedAt: true },
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

      /* Pack on the SERVER, not in each client. Coordinates were arriving at
         float64 precision with per-point {"x":…,"y":…} keys — 0.71 MB of ink per
         ayah on disk, ~4.3 GB for one person annotating the whole Qur'an.
         Rounding to 0.1px and storing tuples measured 10.3x smaller on the real
         strokes, with every point kept. Doing it here means no client can forget,
         and every old drawing is re-encoded the next time it is touched. */
      const packed = packStrokes(merged as { points?: unknown }[]) as unknown as Prisma.InputJsonValue;

      if (!existing) {
        // Two first saves can race to create the row; the loser merges into the winner's.
        saved = await db.canvasDrawing.create({ data: { pageId, authorId: userId, strokes: packed } })
          .then(() => true)
          .catch((e: { code?: string }) => { if (e?.code === "P2002") return false; throw e; });
      } else {
        const { count } = await db.canvasDrawing.updateMany({
          where: { pageId, authorId: userId, updatedAt: existing.updatedAt },
          data:  { strokes: packed, updatedAt: new Date() },
        });
        saved = count === 1;
      }
    }
    // Still contended after four tries: say so, and the client saves again.
    if (!saved) return NextResponse.json({ error: "Busy, try again" }, { status: 409 });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
