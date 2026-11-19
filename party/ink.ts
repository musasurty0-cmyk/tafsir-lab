/**
 * Handwriting, stored in the page's own room (one Durable Object per page).
 *
 * Ink lived in the Supabase database: first as one JSON array per author per
 * page, rewritten whole on every save, then as one row per stroke. Both ran
 * against the free plan's limits — egress (5 GB a month, and the site went
 * down when it ran out) and disk IO (Supabase warned the budget was being
 * exhausted). The room already holds the page's live document; it now holds
 * its ink too, in its SQLite storage, and the database never sees a stroke.
 *
 * Same contract as the old /api/pages/[pageId]/drawings route, so the
 * browser code that reads and merges ink did not change:
 *
 *   read  (?mine=&others=)  → { myStrokes?, otherLayers?, mine, others }
 *                             or { unchanged: true, mine, others }
 *   save  { strokes, surface, deletedIds, base }
 *                           → { ok: true, mine?, first? }
 *
 * `mine` is the version of this author's ink (its head's time) and `others`
 * that of everyone else's ("<newest>.<authors>"). A save moves the head even
 * when it only erases, so a deletion is a change. A Durable Object handles one
 * request at a time, so saves are serialised without any locking here.
 */

import { packStrokes } from "../lib/ink-pack";

export interface InkSql {
  exec<T extends Record<string, SqlStorageValue>>(query: string, ...bindings: unknown[]): SqlStorageCursor<T>;
}

/** Who is asking, from the verified token (see server.ts). */
export interface InkUser {
  uid: string; name: string; canWrite: boolean;
  /** False on a shared board in a workspace with private boards: Mushaf ink there is the admins'. */
  canvasWrite?: boolean;
}

/* ── How ink is stored, and why ──────────────────────────────────────────────
   Cloudflare's free plan allows 5 million storage rows read a day and counts
   by the ROW, whatever is in it. Ink used to be one row per stroke, so every
   time a room woke it read every stroke on its page: a page with 2,747
   strokes cost 2,747 rows per wake. Rooms sleep a few seconds after the last
   request (that is what keeps them inside the free time allowance) and the
   browser asks for ink every 15 seconds, so a single person writing on that
   page burned through ~700,000 rows in a day; on 15 Nov 2026 a full Majlis
   session ran past 5 million by mid-morning and no room could load anything
   until midnight UTC.

   So strokes are packed into BUCKETS: one row holds up to BUCKET_STROKES
   strokes of one author, in drawing order, as lines of "id\tsurface\tjson".
   Waking a page now costs its bucket count (a dozen for that page), and a
   request that finds nothing new reads only ink_head (one row per author),
   never a stroke. A save rewrites only the buckets it touched (usually the
   author's last one), so writes stay one row or two per save, as before.

   Old rooms still have the one-row-per-stroke table (ink_stroke). The first
   time such a room's strokes are needed they are moved into buckets, once,
   in one transaction, and the old rows deleted. */

/* ── Memory: an index, never the ink ─────────────────────────────────────────
   A room keeps only an INDEX in memory: for each stroke, which bucket holds
   it and how big it is. The ink itself stays in storage. One page (25,556
   Mushaf strokes, 68 MB) is far past what a room can hold in its 128 MB, and
   with the whole page in memory a reply for it ran the room out of memory
   (15 Nov 2026), and a 48 MB ceiling added after that refused that page's
   every new stroke (17-19 Nov). Now:
   - a reply is STREAMED, one bucket row at a time, so no page is ever in
     memory whole, whatever its size;
   - a save reads and rewrites only the buckets it touches (usually one).
   ROOM_MAX is a guard against runaway storage, not memory. */

const BUCKET_STROKES = 250;
const BUCKET_CHARS = 400_000;        // stays far below SQLite's 2 MB value limit
const STROKE_MAX = 1_000_000;        // one stroke's JSON, beyond any real stroke
const ROOM_MAX = 400_000_000;        // a page's ink in storage; a runaway guard only

export function ensureInk(sql: InkSql): void {
  // The old per-stroke table: only read, to move a room's ink into buckets.
  sql.exec(`CREATE TABLE IF NOT EXISTS ink_stroke (
    seq     INTEGER PRIMARY KEY AUTOINCREMENT,
    author  TEXT NOT NULL,
    id      TEXT NOT NULL,
    surface TEXT NOT NULL,
    data    TEXT NOT NULL,
    UNIQUE (author, id)
  )`);
  sql.exec(`CREATE TABLE IF NOT EXISTS ink_head (
    author  TEXT PRIMARY KEY,
    updated INTEGER NOT NULL,                   -- ms; the author's version
    name    TEXT NOT NULL DEFAULT ''
  )`);
  sql.exec(`CREATE TABLE IF NOT EXISTS ink_bucket (
    author  TEXT NOT NULL,
    n       INTEGER NOT NULL,                   -- order of the buckets
    data    TEXT NOT NULL,                      -- lines of "id\tsurface\tstroke json"
    PRIMARY KEY (author, n)
  )`);
}

type Head = { author: string; updated: number; name: string };
type Bucket = { n: number; ids: string[]; size: number };
/** Where a stroke is, and what it is on: its surface, and its Mushaf page (null: none, shown on every page). */
type Entry = { b: Bucket; size: number; surface: string; page: number | null };
type AuthorIdx = { buckets: Bucket[]; strokes: Map<string, Entry> };
type Line = { id: string; surface: string; data: string };

/** A room's ink in memory: heads from waking, and (when first needed) an index of where each stroke is. */
export class InkCache {
  heads = new Map<string, Head>();
  idx: Map<string, AuthorIdx> | null = null;
  size = 0;
}

export function loadInk(sql: InkSql): InkCache {
  const c = new InkCache();
  for (const h of sql.exec<Head>(`SELECT author, updated, name FROM ink_head`)) c.heads.set(h.author, { ...h });
  return c;
}

const authorOf = (idx: Map<string, AuthorIdx>, author: string): AuthorIdx =>
  idx.get(author) ?? idx.set(author, { buckets: [], strokes: new Map() }).get(author)!;

function parseLines(data: string): Line[] {
  const out: Line[] = [];
  for (const line of data.split("\n")) {
    if (!line) continue;
    const t1 = line.indexOf("\t"), t2 = line.indexOf("\t", t1 + 1);
    out.push({ id: line.slice(0, t1), surface: line.slice(t1 + 1, t2), data: line.slice(t2 + 1) });
  }
  return out;
}
const PAGE_RE = /"mushafPage":(-?\d+)/;
const pageOf = (data: string): number | null => { const m = PAGE_RE.exec(data); return m ? Number(m[1]) : null; };

/**
 * Which strokes a read wants. No scope: all of them (older browsers, and the
 * board snapshot). A Mushaf page is read on its own, so a page with a whole
 * sūrah of ink (one has 25,556 strokes, 68 MB) sends only the page being
 * looked at. Strokes with no Mushaf page are on every page, as the browser
 * already treats them.
 */
export interface InkScope { surface?: "canvas" | "editor"; mushafPage?: number }
function inScope(scope: InkScope | undefined, surface: string, page: number | null): boolean {
  if (!scope?.surface) return true;
  if (surface !== scope.surface) return false;
  if (scope.surface !== "canvas" || scope.mushafPage === undefined) return true;
  return page === null || page === scope.mushafPage;
}

const linesText = (lines: Line[]) => lines.map((l) => `${l.id}\t${l.surface}\t${l.data}`).join("\n");

function readBucket(sql: InkSql, author: string, n: number): Line[] {
  const row = sql.exec<{ data: string }>(`SELECT data FROM ink_bucket WHERE author = ? AND n = ?`, author, n).toArray()[0];
  return row ? parseLines(row.data) : [];
}

function writeBucket(sql: InkSql, author: string, n: number, lines: Line[]): void {
  if (!lines.length) { sql.exec(`DELETE FROM ink_bucket WHERE author = ? AND n = ?`, author, n); return; }
  sql.exec(
    `INSERT INTO ink_bucket (author, n, data) VALUES (?, ?, ?)
     ON CONFLICT (author, n) DO UPDATE SET data = excluded.data`,
    author, n, linesText(lines));
}

/** Where the next new stroke goes: the author's last bucket, or a new one when that is full. */
function lastBucketFor(a: AuthorIdx, size: number): Bucket {
  let last = a.buckets[a.buckets.length - 1];
  if (!last || last.ids.length >= BUCKET_STROKES || (last.ids.length > 0 && last.size + size > BUCKET_CHARS)) {
    last = { n: last ? last.n + 1 : 0, ids: [], size: 0 };
    a.buckets.push(last);
  }
  return last;
}

/** Writes a whole author's strokes as fresh buckets (a move or an import). */
function writeAll(sql: InkSql, author: string, lines: Line[]): void {
  sql.exec(`DELETE FROM ink_bucket WHERE author = ?`, author);
  const a: AuthorIdx = { buckets: [], strokes: new Map() };
  const pending = new Map<number, Line[]>();
  for (const l of lines) {
    const b = lastBucketFor(a, l.data.length);
    b.ids.push(l.id); b.size += l.data.length;
    (pending.get(b.n) ?? pending.set(b.n, []).get(b.n)!).push(l);
  }
  for (const [n, ls] of pending) writeBucket(sql, author, n, ls);
}

/** Moves a room still stored one row per stroke into buckets. Once per room, ever. */
function migrate(sql: InkSql): void {
  if (!sql.exec(`SELECT 1 FROM ink_stroke LIMIT 1`).toArray().length) return;
  const by = new Map<string, Line[]>();
  for (const r of sql.exec<{ author: string; id: string; surface: string; data: string }>(
    `SELECT author, id, surface, data FROM ink_stroke ORDER BY seq`)) {
    (by.get(r.author) ?? by.set(r.author, []).get(r.author)!).push({ id: r.id, surface: r.surface, data: r.data });
  }
  for (const [author, lines] of by) writeAll(sql, author, lines);
  sql.exec(`DELETE FROM ink_stroke`);
}

/**
 * The room's index, read from storage the first time it is needed after a
 * wake: one row per bucket, each parsed for its ids and sizes and then let
 * go. `txn` runs the one-off move from the old table atomically; callers
 * already inside a transaction pass none.
 */
export function strokesOf(sql: InkSql, c: InkCache, txn?: <T>(fn: () => T) => T): Map<string, AuthorIdx> {
  if (c.idx) return c.idx;
  if (txn) txn(() => migrate(sql)); else migrate(sql);
  const idx = new Map<string, AuthorIdx>();
  let size = 0;
  for (const r of sql.exec<{ author: string; n: number; data: string }>(`SELECT author, n, data FROM ink_bucket ORDER BY author, n`)) {
    const a = authorOf(idx, r.author);
    const b: Bucket = { n: r.n, ids: [], size: 0 };
    for (const l of parseLines(r.data)) {
      b.ids.push(l.id);
      b.size += l.data.length;
      a.strokes.set(l.id, { b, size: l.data.length, surface: l.surface, page: pageOf(l.data) });
    }
    a.buckets.push(b);
    size += b.size;
  }
  c.idx = idx;
  c.size = size;
  return idx;
}

const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export function readInk(
  sql: InkSql, c: InkCache, me: InkUser, seenMine: string | null, seenOthers: string | null,
  txn?: <T>(fn: () => T) => T, scope?: InkScope,
): Response {
  const heads = [...c.heads.values()];
  const mine = c.heads.get(me.uid);
  const others = heads.filter((h) => h.author !== me.uid);
  const mineV = String(mine ? mine.updated : 0);
  const othersV = `${others.reduce((m, h) => Math.max(m, h.updated), 0)}.${others.length}`;
  const needMine = seenMine !== mineV;
  const needOthers = seenOthers !== othersV;
  // Nothing new: answered from the heads alone, without reading a stroke.
  if (!needMine && !needOthers) return json(JSON.stringify({ unchanged: true, mine: mineV, others: othersV }));

  const idx = strokesOf(sql, c, txn);
  /* The reply is a plan of text and bucket references, streamed one piece at
     a time: a bucket is read from storage only when the stream reaches it,
     and dropped once sent. Strokes are JSON text, never parsed. */
  type Piece = string | { author: string; n: number };
  const plan: Piece[] = ["{"];
  // Only the buckets holding something in scope are read at all.
  const wanted = (a: AuthorIdx, b: Bucket) => b.ids.some((id) => { const e = a.strokes.get(id); return !!e && inScope(scope, e.surface, e.page); });
  const list = (a: AuthorIdx | undefined) => { for (const b of a?.buckets ?? []) if (b.ids.length && wanted(a!, b)) plan.push({ author: "", n: b.n }); };
  const listFor = (author: string) => {
    const at = plan.length;
    list(idx.get(author));
    for (let i = at; i < plan.length; i++) (plan[i] as { author: string }).author = author;
  };
  if (needMine) { plan.push(`"myStrokes":[`); listFor(me.uid); plan.push("],"); }
  if (needOthers) {
    // Sent whenever it changed, even empty, so ink erased elsewhere clears here.
    plan.push(`"otherLayers":[`);
    let firstLayer = true;
    for (const h of others) {
      const a = idx.get(h.author);
      if (!a || !a.strokes.size || !a.buckets.some((b) => wanted(a, b))) continue;
      plan.push(`${firstLayer ? "" : ","}{"authorId":${JSON.stringify(h.author)},"authorName":${JSON.stringify(h.name)},"strokes":[`);
      listFor(h.author);
      plan.push("]}");
      firstLayer = false;
    }
    plan.push("],");
  }
  plan.push(`"mine":${JSON.stringify(mineV)},"others":${JSON.stringify(othersV)}}`);

  const enc = new TextEncoder();
  let i = 0;
  let firstInList = true;
  const stream = new ReadableStream<Uint8Array>({
    pull(ctrl) {
      // Text pieces go together; each bucket is its own chunk.
      let text = "";
      while (i < plan.length) {
        const p = plan[i++];
        if (typeof p === "string") {
          if (p.endsWith("[")) firstInList = true;
          text += p;
          continue;
        }
        const strokes = readBucket(sql, p.author, p.n)
          .filter((l) => inScope(scope, l.surface, scope?.surface === "canvas" ? pageOf(l.data) : null))
          .map((l) => l.data);
        if (strokes.length) { text += (firstInList ? "" : ",") + strokes.join(","); firstInList = false; }
        break;
      }
      if (text) ctrl.enqueue(enc.encode(text));
      if (i >= plan.length) ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

/** Call inside a transaction, with the index already loaded (strokesOf). */
export function saveInk(sql: InkSql, c: InkCache, me: InkUser, body: unknown): Response {
  if (!me.canWrite) return json(JSON.stringify({ error: "Read-only" }), 403);
  const b = (body ?? {}) as { strokes?: unknown; surface?: unknown; deletedIds?: unknown; base?: unknown };
  const surface = b.surface === "editor" ? "editor" : "canvas";
  if (surface === "canvas" && me.canvasWrite === false) return json(JSON.stringify({ error: "Only organisers write on the shared board" }), 403);
  const base = typeof b.base === "string" ? b.base : null;
  const deleted = new Set(Array.isArray(b.deletedIds) ? b.deletedIds.filter((x): x is string => typeof x === "string") : []);
  const keep = (Array.isArray(b.strokes) ? b.strokes as { id?: unknown }[] : [])
    .filter((s): s is { id: string } => !!s && typeof s.id === "string" && !s.id.includes("\t") && !s.id.includes("\n") && !deleted.has(s.id))
    .map((s) => ({ ...s, surface }));
  const packed = (packStrokes(keep as { points?: unknown }[]) as unknown as { id: string }[])
    .map((s) => ({ id: s.id, data: JSON.stringify(s) }));
  if (packed.some((s) => s.data.length > STROKE_MAX)) return json(JSON.stringify({ error: "That stroke is too large to save." }), 413);

  const idx = strokesOf(sql, c);
  const prev = c.heads.get(me.uid)?.updated ?? 0;
  const roomHadInk = [...idx.values()].some((a) => a.strokes.size > 0);
  const a = authorOf(idx, me.uid);
  const added = packed.reduce((n, s) => n + s.data.length - (a.strokes.get(s.id)?.size ?? 0), 0);
  if (added > 0 && c.size + added > ROOM_MAX) return json(JSON.stringify({ error: "This page holds as much handwriting as it can." }), 413);

  // The buckets this save touches, read once each, changed, and written back.
  const open = new Map<Bucket, Line[]>();
  const linesOf = (bk: Bucket) => open.get(bk) ?? open.set(bk, readBucket(sql, me.uid, bk.n)).get(bk)!;

  for (const id of deleted) {
    const e = a.strokes.get(id);
    if (!e) continue;
    const lines = linesOf(e.b);
    open.set(e.b, lines.filter((l) => l.id !== id));
    e.b.ids = e.b.ids.filter((x) => x !== id);
    e.b.size -= e.size;
    c.size -= e.size;
    a.strokes.delete(id);
  }
  for (const s of packed) {
    const was = a.strokes.get(s.id);
    if (was) {
      // An edit keeps its place in the drawing order.
      const lines = linesOf(was.b);
      const l = lines.find((x) => x.id === s.id);
      if (l) { l.data = s.data; l.surface = surface; }
      else lines.push({ id: s.id, surface, data: s.data });   // the index and storage disagreed: storage wins, then this
      was.b.size += s.data.length - was.size;
      c.size += s.data.length - was.size;
      was.size = s.data.length;
      was.surface = surface;
      was.page = pageOf(s.data);
    } else {
      const bk = lastBucketFor(a, s.data.length);
      linesOf(bk).push({ id: s.id, surface, data: s.data });
      bk.ids.push(s.id);
      bk.size += s.data.length;
      c.size += s.data.length;
      a.strokes.set(s.id, { b: bk, size: s.data.length, surface, page: pageOf(s.data) });
    }
  }
  for (const [bk, lines] of open) {
    writeBucket(sql, me.uid, bk.n, lines);
    if (!lines.length) a.buckets = a.buckets.filter((x) => x !== bk);
  }

  // Strictly later than the last version, even within one millisecond.
  const now = Math.max(Date.now(), prev + 1);
  sql.exec(
    `INSERT INTO ink_head (author, updated, name) VALUES (?, ?, ?)
     ON CONFLICT (author) DO UPDATE SET updated = excluded.updated, name = excluded.name`,
    me.uid, now, me.name);
  c.heads.set(me.uid, { author: me.uid, updated: now, name: me.name });

  return json(JSON.stringify({
    ok: true,
    // Nobody else wrote since the client's version: it is up to date without reading its ink back.
    ...(base === String(prev) ? { mine: String(now) } : {}),
    // The page's first ink: the app marks the page as having some (Page.inkAt).
    ...(!roomHadInk && keep.length ? { first: true } : {}),
  }));
}

/** Replace one author's ink here wholesale: the copy from the database. Inside a transaction, index loaded. */
export function importInk(sql: InkSql, c: InkCache, author: string, name: string, updated: number, strokes: { id: string; surface?: string }[]): number {
  strokesOf(sql, c);
  // A repeated id keeps its last copy, at the place of that copy (as the old
  // INSERT OR REPLACE did).
  const last = new Map<string, Line>();
  for (const s of strokes) { last.delete(s.id); last.set(s.id, { id: s.id, surface: s.surface === "editor" ? "editor" : "canvas", data: JSON.stringify(s) }); }
  writeAll(sql, author, [...last.values()]);
  sql.exec(`INSERT INTO ink_head (author, updated, name) VALUES (?, ?, ?)
            ON CONFLICT (author) DO UPDATE SET updated = excluded.updated, name = excluded.name`, author, updated, name);
  c.heads.set(author, { author, updated, name });
  c.idx = null;   // re-read on next use: cheap, and never out of step
  return strokes.length;
}

/** Remove ink: one author's (a departing account), or everyone's (a deleted page). */
export function wipeInk(sql: InkSql, c: InkCache, author?: string): void {
  if (author) {
    sql.exec(`DELETE FROM ink_bucket WHERE author = ?`, author);
    sql.exec(`DELETE FROM ink_stroke WHERE author = ?`, author);
    sql.exec(`DELETE FROM ink_head WHERE author = ?`, author);
    c.heads.delete(author);
  } else {
    sql.exec(`DELETE FROM ink_bucket`);
    sql.exec(`DELETE FROM ink_stroke`);
    sql.exec(`DELETE FROM ink_head`);
    c.heads.clear();
  }
  c.idx = null;
}

/** Per-author stroke counts and ids in order, to check a copy against its source. */
export function inkSummary(sql: InkSql, c: InkCache, txn?: <T>(fn: () => T) => T): { author: string; count: number; updated: number; ids: string; chars: number; buckets: number }[] {
  const idx = strokesOf(sql, c, txn);
  return [...c.heads.values()].map((h) => {
    const a = idx.get(h.author);
    const ids = a ? a.buckets.flatMap((b) => b.ids) : [];
    const chars = a ? a.buckets.reduce((n, b) => n + b.size, 0) : 0;
    return { author: h.author, count: ids.length, updated: h.updated, ids: ids.join(","), chars, buckets: a?.buckets.length ?? 0 };
  });
}

/**
 * Admin: aggregate numbers about a room's ink, never the ink itself: how many
 * strokes per surface and Mushaf page, point counts, and how many strokes
 * are exact copies of another (same geometry, different id). Reads bucket by
 * bucket, so it is safe on any size of page.
 */
export function inkStats(sql: InkSql, c: InkCache, txn?: <T>(fn: () => T) => T) {
  const idx = strokesOf(sql, c, txn);
  const out: Record<string, unknown>[] = [];
  for (const [author, a] of idx) {
    const bySurface: Record<string, number> = {}, byPage: Record<string, number> = {};
    const seen = new Set<string>();
    let strokes = 0, points = 0, maxPoints = 0, dupes = 0, chars = 0;
    for (const bk of a.buckets) {
      for (const l of readBucket(sql, author, bk.n)) {
        let o: { surface?: string; mushafPage?: number; anchor?: string; points?: unknown[]; tool?: string } = {};
        try { o = JSON.parse(l.data); } catch { /* unreadable: counted with no page */ }
        strokes++; chars += l.data.length;
        bySurface[o.surface ?? l.surface] = (bySurface[o.surface ?? l.surface] ?? 0) + 1;
        const pg = String(o.mushafPage ?? "-");
        byPage[pg] = (byPage[pg] ?? 0) + 1;
        const n = Array.isArray(o.points) ? o.points.length : 0;
        points += n; if (n > maxPoints) maxPoints = n;
        const key = `${o.tool}|${o.surface}|${o.mushafPage}|${o.anchor}|${JSON.stringify(o.points)}`;
        if (seen.has(key)) dupes++; else seen.add(key);
      }
    }
    out.push({ author, strokes, chars, buckets: a.buckets.length, bySurface, byPage, points, avgPoints: Math.round(points / Math.max(1, strokes)), maxPoints, dupes });
  }
  return out;
}
