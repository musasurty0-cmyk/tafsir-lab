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
 *   Body: { strokes: Stroke[], surface?: "canvas" | "editor", deletedIds?: string[], base?: string }
 *   MERGES by id: the client's copies win for ids it sends, strokes it
 *   doesn't know about are PRESERVED (same account on another device, or a
 *   stroke drawn before this client's initial load), and only ids listed in
 *   deletedIds are removed. `surface` is stamped on the strokes sent (a
 *   missing surface means "canvas" for backward compatibility). `base` is the
 *   `mine` version the client last read or wrote; when nobody else wrote since,
 *   the reply is { ok: true, mine } and the client is up to date without
 *   reading its own ink back. Otherwise { ok: true }.
 *
 *   The old replace-the-surface semantics silently destroyed strokes the
 *   writing client didn't have in memory — the root cause of annotation
 *   layers "randomly disappearing".
 *
 * Storage (prisma/sql/020): one InkStroke row per stroke, and one InkHead row
 * per author per page whose updatedAt is the version. Ink used to be one JSON
 * array per author per page, up to 2.8 MB, rewritten whole on every save;
 * Supabase warned that this was exhausting the database's Disk IO budget. A
 * save now writes only the strokes it touches.
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

    /* The reader says what it already has, in two halves: its own ink
       (`mine`) and everyone else's (`others`). Only the heads are read first —
       one tiny row per author — and a half is fetched and sent only when it
       changed. Ink is the largest thing a page reads and the ink layers poll
       it, so this is most of what keeps the database inside its egress. */
    const sp = req.nextUrl.searchParams;
    const heads = await db.inkHead.findMany({ where: { pageId }, select: { authorId: true, updatedAt: true } });
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

    const wantOthers = needOthers && otherHeads.length > 0;
    const rows = needMine || wantOthers
      ? await db.inkStroke.findMany({
          where:   { pageId, ...(needMine && wantOthers ? {} : needMine ? { authorId: userId } : { authorId: { not: userId } }) },
          orderBy: { seq: "asc" },
          select:  { authorId: true, data: true },
        })
      : [];

    const byAuthor = new Map<string, object[]>();
    for (const r of rows) {
      const list = byAuthor.get(r.authorId) ?? [];
      list.push(r.data as object);
      byAuthor.set(r.authorId, list);
    }
    const names = wantOthers
      ? new Map((await db.user.findMany({
          where:  { id: { in: otherHeads.map((h) => h.authorId) } },
          select: { id: true, name: true },
        })).map((u) => [u.id, u.name]))
      : new Map<string, string>();

    const json = JSON.stringify({
      ...(needMine ? { myStrokes: byAuthor.get(userId) ?? [] } : {}),
      // Sent whenever it changed, even empty, so ink erased elsewhere clears here.
      ...(needOthers
        ? { otherLayers: otherHeads
            .filter((h) => byAuthor.has(h.authorId))
            .map((h) => ({ authorId: h.authorId, authorName: names.get(h.authorId) ?? "", strokes: byAuthor.get(h.authorId)! })) }
        : {}),
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
    // Membership is the gate: any member may annotate, a non-member cannot
    // reach the page at all.
    await assertPageAccess(pageId, userId);

    const body = await req.json() as { strokes?: unknown; surface?: unknown; deletedIds?: unknown; base?: unknown };
    const base = typeof body.base === "string" ? body.base : null;
    const incoming = Array.isArray(body.strokes) ? body.strokes as { id?: string; surface?: string }[] : [];
    const surface  = body.surface === "editor" ? "editor" : "canvas";
    const deleted  = [...new Set(
      Array.isArray(body.deletedIds)
        ? (body.deletedIds as unknown[]).filter((x): x is string => typeof x === "string")
        : [],
    )];
    const gone = new Set(deleted);

    /* Pack on the SERVER, not in each client: coordinates arrive at float64
       precision with per-point keys, and rounding to 0.1px into tuples is ~10x
       smaller with every point kept. A stroke without an id cannot be merged
       by id, so it is not stored. */
    const keep = incoming
      .filter((s) => typeof s?.id === "string" && !gone.has(s.id))
      .map((s) => ({ ...s, surface }));
    const packed = JSON.stringify(packStrokes(keep as { points?: unknown }[]));

    /* One transaction, in this order:
       1. the author's head row exists (dated at the epoch, so a first save's
          `prev` is version "0");
       2. the head moves on, locked: this serialises one author's saves on a
          page, and `prev` is the version before this save. clock_timestamp(),
          taken after the lock, and never the same millisecond twice, keeps
          versions strictly increasing;
       3. erased strokes go;
       4. sent strokes are inserted or replaced, keeping their drawing order. */
    const [, moved] = await db.$transaction([
      db.$executeRaw`
        INSERT INTO "InkHead" ("pageId", "authorId", "updatedAt")
        VALUES (${pageId}::uuid, ${userId}::uuid, 'epoch'::timestamptz)
        ON CONFLICT DO NOTHING`,
      db.$queryRaw<{ updatedAt: Date; prev: Date }[]>`
        UPDATE "InkHead" h
        SET "updatedAt" = GREATEST(clock_timestamp(), o.old + interval '1 millisecond')
        FROM (SELECT ctid, "updatedAt" AS old FROM "InkHead"
              WHERE "pageId" = ${pageId}::uuid AND "authorId" = ${userId}::uuid FOR UPDATE) o
        WHERE h.ctid = o.ctid
        RETURNING h."updatedAt", o.old AS prev`,
      db.$executeRaw`
        DELETE FROM "InkStroke"
        WHERE "pageId" = ${pageId}::uuid AND "authorId" = ${userId}::uuid AND "id" = ANY(${deleted}::text[])`,
      db.$executeRaw`
        INSERT INTO "InkStroke" ("pageId", "authorId", "id", "surface", "data", "updatedAt")
        SELECT ${pageId}::uuid, ${userId}::uuid, t.e->>'id', ${surface}, t.e, now()
        FROM jsonb_array_elements(${packed}::jsonb) WITH ORDINALITY AS t(e, ord)
        ORDER BY t.ord
        ON CONFLICT ("pageId", "authorId", "id") DO UPDATE
          SET "data" = EXCLUDED."data", "surface" = EXCLUDED."surface", "updatedAt" = EXCLUDED."updatedAt"`,
    ]);

    const row = moved[0];
    const upToDate = row && base === String(new Date(row.prev).getTime());
    const mine = upToDate ? String(new Date(row.updatedAt).getTime()) : null;
    return NextResponse.json(mine ? { ok: true, mine } : { ok: true });
  } catch (err) {
    return apiError(err);
  }
}
