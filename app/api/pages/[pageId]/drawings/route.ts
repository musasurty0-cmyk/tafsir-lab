/**
 * GET  /api/pages/[pageId]/drawings[?mine=…&others=…]
 *   Returns { myStrokes?, otherLayers?, mine, others } where
 *     myStrokes   = current user's stroke array (may be empty; both surfaces)
 *     otherLayers = [{ authorId, authorName, strokes }] for all other users
 *     mine/others = versions of each half; send them back on the next read
 *                   and a half that has not changed is left out (or the whole
 *                   reply is { unchanged: true, mine, others }).
 *
 * PUT  /api/pages/[pageId]/drawings
 *   Body: { strokes: Stroke[], surface?: "canvas" | "editor", deletedIds?: string[] }
 *   MERGES the given surface's strokes by id: the client's copies win for
 *   ids it sends, strokes it doesn't know about are PRESERVED (same account
 *   on another device, or a stroke drawn before this client's initial load),
 *   and only ids listed in deletedIds are removed. The other surface is
 *   untouched (canvas and editor ink save independently; a missing surface
 *   means "canvas" for backward compatibility). Body `base` is the `mine`
 *   version the client last read or wrote; when nobody else wrote the row
 *   since, the reply is { ok: true, mine } and the client is up to date
 *   without reading its own ink back. Otherwise { ok: true }.
 *
 *   The old replace-the-surface semantics silently destroyed strokes the
 *   writing client didn't have in memory — the root cause of annotation
 *   layers "randomly disappearing".
 */

import { gzipSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";
import { packStrokes } from "@/lib/ink";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { assertPageAccess } from "@/lib/services/pages.service";
import { apiError } from "@/lib/api-errors";
import { pollVersion } from "@/lib/poll-version";

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

    /* Ink is by far the largest thing a page reads — one person's on one page
       has reached 2.8 MB — and it was read every 15–20 s by each open page,
       on every return to the tab and on every reconnect. That is what ran the
       database past its monthly egress and took the site down.

       So the reader says what it already has, in two halves: its own ink
       (`mine`, the row's updatedAt) and everyone else's (`others`). Only the
       versions are read first — a few bytes a row — and a half is fetched and
       sent only when it changed. Drawing does not re-download your own ink:
       a save tells the page its new `mine` (see PUT). */
    const sp = req.nextUrl.searchParams;
    const heads = await db.canvasDrawing.findMany({ where: { pageId }, select: { authorId: true, updatedAt: true } });
    const myHead = heads.find((h) => h.authorId === userId);
    const otherHeads = heads.filter((h) => h.authorId !== userId);
    const mineV = String(myHead ? myHead.updatedAt.getTime() : 0);
    const othersV = pollVersion(
      otherHeads.reduce<Date | null>((m, h) => (!m || h.updatedAt > m ? h.updatedAt : m), null),
      otherHeads.length,
    );
    const needMine = sp.get("mine") !== mineV;
    const needOthers = sp.get("others") !== othersV;
    if (!needMine && !needOthers) {
      return NextResponse.json({ unchanged: true, mine: mineV, others: othersV }, { headers: { "Cache-Control": "no-store" } });
    }

    const drawings = await db.canvasDrawing.findMany({
      where:   { pageId, ...(needMine && needOthers ? {} : needMine ? { authorId: userId } : { authorId: { not: userId } }) },
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
      ...(needMine ? { myStrokes: mine ? parseStrokes(mine.strokes) : [] } : {}),
      ...(needOthers ? { otherLayers: others } : {}),
      mine:   mineV,
      others: othersV,
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

    const body = await req.json() as { strokes?: unknown; surface?: unknown; deletedIds?: unknown; base?: unknown };
    const base = typeof body.base === "string" ? body.base : null;
    const incoming = Array.isArray(body.strokes) ? body.strokes as { id?: string; surface?: string }[] : [];
    const surface  = body.surface === "editor" ? "editor" : "canvas";
    const deleted  = new Set(
      Array.isArray(body.deletedIds)
        ? (body.deletedIds as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
    );

    // Stamp the surface on incoming strokes.
    const stamped = incoming.map((s) => ({ ...s, surface }));

    /* One statement, merged inside the database. The row is one author's ink
       on the page — up to megabytes — and an earlier version read it out,
       merged in JavaScript and wrote it back: every save sent the whole row
       out of the database (metered egress) and, with saves overlapping, a
       compare-and-swap retried that up to four times each. On the smallest
       instance that piled up until every connection was a slow ink save and
       the site went down.

       Now only the new strokes travel. Postgres drops the strokes this save
       replaces or deletes (by id) and appends the new ones under the row's
       own lock, so overlapping saves queue rather than lose each other's
       strokes. Packed here, as before, so stored points stay compact. */
    const keep = stamped.filter((s) => s.id == null || !deleted.has(s.id));
    const drop = [...new Set([...stamped.map((s) => s.id).filter((x): x is string => !!x), ...deleted])];
    const packed = JSON.stringify(packStrokes(keep as { points?: unknown }[]));
    type Saved = { updatedAt: Date; prev: Date | null };
    // The existing row, locked in the same statement; `prev` is its version before this save.
    const update = () => db.$queryRaw<Saved[]>`
      UPDATE "CanvasDrawing" d SET
        "strokes" = COALESCE((
          SELECT jsonb_agg(e) FROM jsonb_array_elements(
            CASE WHEN jsonb_typeof(d."strokes") = 'array' THEN d."strokes" ELSE '[]'::jsonb END
          ) e
          WHERE NOT (COALESCE(e->>'id', '') = ANY(${drop}::text[]))
        ), '[]'::jsonb) || ${packed}::jsonb,
        "updatedAt" = now()
      FROM (SELECT ctid, "updatedAt" AS old FROM "CanvasDrawing"
            WHERE "pageId" = ${pageId}::uuid AND "authorId" = ${userId}::uuid FOR UPDATE) o
      WHERE d.ctid = o.ctid
      RETURNING d."updatedAt", o.old AS prev`;
    let [row] = await update();
    if (!row) {
      // This author's first ink on the page. Two first saves can race: the loser updates instead.
      [row] = await db.$queryRaw<Saved[]>`
        INSERT INTO "CanvasDrawing" ("pageId", "authorId", "strokes", "updatedAt")
        VALUES (${pageId}::uuid, ${userId}::uuid, ${packed}::jsonb, now())
        ON CONFLICT ("pageId", "authorId") DO NOTHING
        RETURNING "updatedAt", NULL::timestamptz AS prev`;
      if (!row) [row] = await update();
    }

    /* The row's new version, when this client already had everything else in
       it (nobody else wrote since its `base`): then it need not read its own
       ink back. Otherwise its next read fetches the row. */
    const upToDate = row && base === String(row.prev ? new Date(row.prev).getTime() : 0);
    const mine = upToDate ? String(new Date(row.updatedAt).getTime()) : null;
    return NextResponse.json(mine ? { ok: true, mine } : { ok: true });
  } catch (err) {
    return apiError(err);
  }
}
