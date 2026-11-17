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

const BUCKET_STROKES = 250;
const BUCKET_CHARS = 400_000;        // stays far below SQLite's 2 MB value limit
const STROKE_MAX = 1_000_000;        // one stroke's JSON, beyond any real stroke
const ROOM_MAX = 48_000_000;         // a page's ink in memory stays well inside 128 MB

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
type Stroke = { data: string; surface: string; b: Bucket };
type Bucket = { n: number; ids: string[]; size: number };
type AuthorInk = { buckets: Bucket[]; strokes: Map<string, Stroke> };

/** A room's ink in memory. Heads are read when the room wakes; strokes only when first needed. */
export class InkCache {
  heads = new Map<string, Head>();
  ink: Map<string, AuthorInk> | null = null;
  size = 0;
}

export function loadInk(sql: InkSql): InkCache {
  const c = new InkCache();
  for (const h of sql.exec<Head>(`SELECT author, updated, name FROM ink_head`)) c.heads.set(h.author, { ...h });
  return c;
}

const authorOf = (ink: Map<string, AuthorInk>, author: string): AuthorInk =>
  ink.get(author) ?? ink.set(author, { buckets: [], strokes: new Map() }).get(author)!;

function bucketText(a: AuthorInk, b: Bucket): string {
  return b.ids.map((id) => { const s = a.strokes.get(id)!; return `${id}\t${s.surface}\t${s.data}`; }).join("\n");
}

function putBucket(sql: InkSql, author: string, a: AuthorInk, b: Bucket): void {
  if (!b.ids.length) {
    sql.exec(`DELETE FROM ink_bucket WHERE author = ? AND n = ?`, author, b.n);
    a.buckets = a.buckets.filter((x) => x !== b);
    return;
  }
  sql.exec(
    `INSERT INTO ink_bucket (author, n, data) VALUES (?, ?, ?)
     ON CONFLICT (author, n) DO UPDATE SET data = excluded.data`,
    author, b.n, bucketText(a, b));
}

/** Adds a stroke at the end of an author's drawing order, starting a new bucket when the last is full. */
function append(a: AuthorInk, id: string, surface: string, data: string): Bucket {
  let last = a.buckets[a.buckets.length - 1];
  if (!last || last.ids.length >= BUCKET_STROKES || (last.ids.length > 0 && last.size + data.length > BUCKET_CHARS)) {
    last = { n: last ? last.n + 1 : 0, ids: [], size: 0 };
    a.buckets.push(last);
  }
  last.ids.push(id);
  last.size += data.length;
  a.strokes.set(id, { data, surface, b: last });
  return last;
}

/** Moves a room still stored one row per stroke into buckets. Once per room, ever. */
function migrate(sql: InkSql): void {
  if (!sql.exec(`SELECT 1 FROM ink_stroke LIMIT 1`).toArray().length) return;
  const ink = new Map<string, AuthorInk>();
  for (const r of sql.exec<{ author: string; id: string; surface: string; data: string }>(
    `SELECT author, id, surface, data FROM ink_stroke ORDER BY seq`)) {
    append(authorOf(ink, r.author), r.id, r.surface, r.data);
  }
  for (const [author, a] of ink) {
    sql.exec(`DELETE FROM ink_bucket WHERE author = ?`, author);
    for (const b of a.buckets) putBucket(sql, author, a, b);
  }
  sql.exec(`DELETE FROM ink_stroke`);
}

/**
 * The room's strokes, read from storage the first time they are needed after
 * a wake: one row per bucket. `txn` runs the one-off move from the old table
 * atomically; callers already inside a transaction pass none.
 */
export function strokesOf(sql: InkSql, c: InkCache, txn?: <T>(fn: () => T) => T): Map<string, AuthorInk> {
  if (c.ink) return c.ink;
  if (txn) txn(() => migrate(sql)); else migrate(sql);
  const ink = new Map<string, AuthorInk>();
  let size = 0;
  for (const r of sql.exec<{ author: string; n: number; data: string }>(`SELECT author, n, data FROM ink_bucket ORDER BY author, n`)) {
    const a = authorOf(ink, r.author);
    const b: Bucket = { n: r.n, ids: [], size: 0 };
    for (const line of r.data.split("\n")) {
      if (!line) continue;
      const t1 = line.indexOf("\t"), t2 = line.indexOf("\t", t1 + 1);
      const id = line.slice(0, t1), data = line.slice(t2 + 1);
      b.ids.push(id);
      b.size += data.length;
      a.strokes.set(id, { data, surface: line.slice(t1 + 1, t2), b });
    }
    a.buckets.push(b);
    size += b.size;
  }
  c.ink = ink;
  c.size = size;
  return ink;
}

const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Text joined into a body in one pass, in UTF-8 chunks, never as one giant string. */
class Body {
  private parts: Uint8Array[] = [];
  private buf: string[] = [];
  private n = 0;
  private enc = new TextEncoder();
  add(s: string) {
    this.buf.push(s); this.n += s.length;
    if (this.n > 256_000) this.flush();
  }
  private flush() {
    if (this.buf.length) this.parts.push(this.enc.encode(this.buf.join("")));
    this.buf = []; this.n = 0;
  }
  response(): Response {
    this.flush();
    return new Response(new Blob(this.parts), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  }
}

function* strokeData(a: AuthorInk | undefined): Generator<string> {
  if (!a) return;
  for (const b of a.buckets) for (const id of b.ids) yield a.strokes.get(id)!.data;
}

export function readInk(
  sql: InkSql, c: InkCache, me: InkUser, seenMine: string | null, seenOthers: string | null,
  txn?: <T>(fn: () => T) => T,
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

  const ink = strokesOf(sql, c, txn);
  // Strokes are stored as JSON text and joined back into arrays as text, never parsed.
  const out = new Body();
  out.add("{");
  const list = (strokes: Iterable<string>) => {
    let first = true;
    for (const d of strokes) { out.add(first ? d : "," + d); first = false; }
  };
  if (needMine) {
    out.add(`"myStrokes":[`);
    list(strokeData(ink.get(me.uid)));
    out.add("],");
  }
  if (needOthers) {
    // Sent whenever it changed, even empty, so ink erased elsewhere clears here.
    out.add(`"otherLayers":[`);
    let firstLayer = true;
    for (const h of others) {
      const a = ink.get(h.author);
      if (!a || !a.strokes.size) continue;
      out.add(`${firstLayer ? "" : ","}{"authorId":${JSON.stringify(h.author)},"authorName":${JSON.stringify(h.name)},"strokes":[`);
      list(strokeData(a));
      out.add("]}");
      firstLayer = false;
    }
    out.add("],");
  }
  out.add(`"mine":${JSON.stringify(mineV)},"others":${JSON.stringify(othersV)}}`);
  return out.response();
}

/** Call inside a transaction, with the strokes already loaded (strokesOf). */
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

  const ink = strokesOf(sql, c);
  const prev = c.heads.get(me.uid)?.updated ?? 0;
  const roomHadInk = [...ink.values()].some((a) => a.strokes.size > 0);
  const a = authorOf(ink, me.uid);
  const added = packed.reduce((n, s) => n + s.data.length - (a.strokes.get(s.id)?.data.length ?? 0), 0);
  if (added > 0 && c.size + added > ROOM_MAX) return json(JSON.stringify({ error: "This page holds as much handwriting as it can." }), 413);

  const touched = new Set<Bucket>();
  for (const id of deleted) {
    const s = a.strokes.get(id);
    if (!s) continue;
    s.b.ids = s.b.ids.filter((x) => x !== id);
    s.b.size -= s.data.length;
    c.size -= s.data.length;
    a.strokes.delete(id);
    touched.add(s.b);
  }
  for (const s of packed) {
    const was = a.strokes.get(s.id);
    if (was) {
      // An edit keeps its place in the drawing order.
      was.b.size += s.data.length - was.data.length;
      c.size += s.data.length - was.data.length;
      was.data = s.data;
      was.surface = surface;
      touched.add(was.b);
    } else {
      c.size += s.data.length;
      touched.add(append(a, s.id, surface, s.data));
    }
  }
  for (const bk of touched) putBucket(sql, me.uid, a, bk);

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

/** Replace one author's ink here wholesale: the copy from the database. Inside a transaction, strokes loaded. */
export function importInk(sql: InkSql, c: InkCache, author: string, name: string, updated: number, strokes: { id: string; surface?: string }[]): number {
  const ink = strokesOf(sql, c);
  for (const s of ink.get(author)?.strokes.values() ?? []) c.size -= s.data.length;
  sql.exec(`DELETE FROM ink_bucket WHERE author = ?`, author);
  ink.delete(author);
  const a = authorOf(ink, author);
  // A repeated id keeps its last copy, at the place of that copy (as the old
  // INSERT OR REPLACE did).
  const last = new Map<string, { id: string; surface?: string }>();
  for (const s of strokes) { last.delete(s.id); last.set(s.id, s); }
  for (const s of last.values()) {
    const data = JSON.stringify(s);
    append(a, s.id, s.surface === "editor" ? "editor" : "canvas", data);
    c.size += data.length;
  }
  for (const b of [...a.buckets]) putBucket(sql, author, a, b);
  sql.exec(`INSERT INTO ink_head (author, updated, name) VALUES (?, ?, ?)
            ON CONFLICT (author) DO UPDATE SET updated = excluded.updated, name = excluded.name`, author, updated, name);
  c.heads.set(author, { author, updated, name });
  return strokes.length;
}

/** Remove ink: one author's (a departing account), or everyone's (a deleted page). */
export function wipeInk(sql: InkSql, c: InkCache, author?: string): void {
  if (author) {
    sql.exec(`DELETE FROM ink_bucket WHERE author = ?`, author);
    sql.exec(`DELETE FROM ink_stroke WHERE author = ?`, author);
    sql.exec(`DELETE FROM ink_head WHERE author = ?`, author);
    c.heads.delete(author);
    if (c.ink) { for (const s of c.ink.get(author)?.strokes.values() ?? []) c.size -= s.data.length; c.ink.delete(author); }
  } else {
    sql.exec(`DELETE FROM ink_bucket`);
    sql.exec(`DELETE FROM ink_stroke`);
    sql.exec(`DELETE FROM ink_head`);
    c.heads.clear();
    c.ink = new Map();
    c.size = 0;
  }
}

/** Per-author stroke counts and ids in order, to check a copy against its source. */
export function inkSummary(sql: InkSql, c: InkCache, txn?: <T>(fn: () => T) => T): { author: string; count: number; updated: number; ids: string }[] {
  const ink = strokesOf(sql, c, txn);
  return [...c.heads.values()].map((h) => {
    const a = ink.get(h.author);
    const ids = a ? a.buckets.flatMap((b) => b.ids) : [];
    return { author: h.author, count: ids.length, updated: h.updated, ids: ids.join(",") };
  });
}
