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

export function ensureInk(sql: InkSql): void {
  sql.exec(`CREATE TABLE IF NOT EXISTS ink_stroke (
    seq     INTEGER PRIMARY KEY AUTOINCREMENT,  -- drawing order
    author  TEXT NOT NULL,
    id      TEXT NOT NULL,
    surface TEXT NOT NULL,
    data    TEXT NOT NULL,                      -- the stroke, as JSON
    UNIQUE (author, id)
  )`);
  sql.exec(`CREATE TABLE IF NOT EXISTS ink_head (
    author  TEXT PRIMARY KEY,
    updated INTEGER NOT NULL,                   -- ms; the author's version
    name    TEXT NOT NULL DEFAULT ''
  )`);
}

type Head = { author: string; updated: number; name: string };

/* ── The room's ink, held in memory ──────────────────────────────────────────
   Every browser on a page asks for its ink every 15 seconds, and whenever
   anyone drew, each one's next request read every stroke on the page back out
   of storage. On 15 Nov 2026, with the cohort on one heavily annotated page,
   that came to 5.3 million rows in a morning: the whole of the free plan's
   daily allowance, after which no room could load anything until midnight UTC.
   The same page's reply was built from four copies of its ink at once, ran
   past the room's 128 MB, and failed, so every browser asked again, forever.

   So a room reads its ink from storage once, when it wakes, keeps it here,
   and applies each save, import and wipe to this copy as well as to storage.
   A request that finds nothing new costs no rows at all, and one that does is
   answered from memory. A page whose ink is too large to keep (CACHE_MAX)
   keeps only its heads here and reads its strokes from storage when they
   have changed, building the reply in a single pass. */

const CACHE_MAX = 24_000_000;   // characters of stroke JSON

export class InkCache {
  heads = new Map<string, Head>();
  /** author -> stroke id -> stroke JSON, in drawing order. Null: too large to keep. */
  strokes: Map<string, Map<string, string>> | null = new Map();
  size = 0;
}

export function loadInk(sql: InkSql): InkCache {
  const c = new InkCache();
  for (const h of sql.exec<Head>(`SELECT author, updated, name FROM ink_head`)) c.heads.set(h.author, { ...h });
  for (const r of sql.exec<{ author: string; id: string; data: string }>(`SELECT author, id, data FROM ink_stroke ORDER BY seq`)) {
    c.size += r.data.length;
    if (c.size > CACHE_MAX) { c.strokes = null; break; }
    (c.strokes!.get(r.author) ?? c.strokes!.set(r.author, new Map()).get(r.author)!).set(r.id, r.data);
  }
  return c;
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

export function readInk(sql: InkSql, c: InkCache, me: InkUser, seenMine: string | null, seenOthers: string | null): Response {
  const heads = [...c.heads.values()];
  const mine = c.heads.get(me.uid);
  const others = heads.filter((h) => h.author !== me.uid);
  const mineV = String(mine ? mine.updated : 0);
  const othersV = `${others.reduce((m, h) => Math.max(m, h.updated), 0)}.${others.length}`;
  const needMine = seenMine !== mineV;
  const needOthers = seenOthers !== othersV;
  if (!needMine && !needOthers) return json(JSON.stringify({ unchanged: true, mine: mineV, others: othersV }));

  // Strokes are stored as JSON text and joined back into arrays as text, never parsed.
  const out = new Body();
  out.add("{");
  const list = (strokes: Iterable<string>) => {
    let first = true;
    for (const d of strokes) { out.add(first ? d : "," + d); first = false; }
  };
  const fromStorage = function* (author: string) {
    for (const r of sql.exec<{ data: string }>(`SELECT data FROM ink_stroke WHERE author = ? ORDER BY seq`, author)) yield r.data;
  };
  if (needMine) {
    out.add(`"myStrokes":[`);
    list(c.strokes ? (c.strokes.get(me.uid)?.values() ?? []) : fromStorage(me.uid));
    out.add("],");
  }
  if (needOthers) {
    // Sent whenever it changed, even empty, so ink erased elsewhere clears here.
    out.add(`"otherLayers":[`);
    let firstLayer = true;
    for (const h of others) {
      const strokes = c.strokes ? [...(c.strokes.get(h.author)?.values() ?? [])] : [...fromStorage(h.author)];
      if (!strokes.length) continue;
      out.add(`${firstLayer ? "" : ","}{"authorId":${JSON.stringify(h.author)},"authorName":${JSON.stringify(h.name)},"strokes":[`);
      list(strokes);
      out.add("]}");
      firstLayer = false;
    }
    out.add("],");
  }
  out.add(`"mine":${JSON.stringify(mineV)},"others":${JSON.stringify(othersV)}}`);
  return out.response();
}

export function saveInk(sql: InkSql, c: InkCache, me: InkUser, body: unknown): Response {
  if (!me.canWrite) return json(JSON.stringify({ error: "Read-only" }), 403);
  const b = (body ?? {}) as { strokes?: unknown; surface?: unknown; deletedIds?: unknown; base?: unknown };
  const surface = b.surface === "editor" ? "editor" : "canvas";
  if (surface === "canvas" && me.canvasWrite === false) return json(JSON.stringify({ error: "Only organisers write on the shared board" }), 403);
  const base = typeof b.base === "string" ? b.base : null;
  const deleted = new Set(Array.isArray(b.deletedIds) ? b.deletedIds.filter((x): x is string => typeof x === "string") : []);
  const keep = (Array.isArray(b.strokes) ? b.strokes as { id?: unknown }[] : [])
    .filter((s): s is { id: string } => !!s && typeof s.id === "string" && !deleted.has(s.id))
    .map((s) => ({ ...s, surface }));

  const prev = c.heads.get(me.uid)?.updated ?? 0;
  const roomHadInk = c.strokes
    ? [...c.strokes.values()].some((m) => m.size > 0)
    : sql.exec(`SELECT 1 FROM ink_stroke LIMIT 1`).toArray().length > 0;

  const mineMap = c.strokes ? (c.strokes.get(me.uid) ?? c.strokes.set(me.uid, new Map()).get(me.uid)!) : null;
  for (const id of deleted) {
    sql.exec(`DELETE FROM ink_stroke WHERE author = ? AND id = ?`, me.uid, id);
    if (mineMap) { const d = mineMap.get(id); if (d !== undefined) { c.size -= d.length; mineMap.delete(id); } }
  }
  for (const s of packStrokes(keep as { points?: unknown }[]) as unknown as { id: string }[]) {
    const data = JSON.stringify(s);
    sql.exec(
      `INSERT INTO ink_stroke (author, id, surface, data) VALUES (?, ?, ?, ?)
       ON CONFLICT (author, id) DO UPDATE SET surface = excluded.surface, data = excluded.data`,
      me.uid, s.id, surface, data);
    if (mineMap) {
      // An update keeps its place in the drawing order, as the row keeps its seq.
      c.size += data.length - (mineMap.get(s.id)?.length ?? 0);
      mineMap.set(s.id, data);
    }
  }
  if (c.strokes && c.size > CACHE_MAX) c.strokes = null;   // grew too large to keep
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

/** Replace one author's ink here wholesale: the copy from the database. */
export function importInk(sql: InkSql, c: InkCache, author: string, name: string, updated: number, strokes: { id: string; surface?: string }[]): number {
  sql.exec(`DELETE FROM ink_stroke WHERE author = ?`, author);
  const fresh = new Map<string, string>();
  for (const s of strokes) {
    const data = JSON.stringify(s);
    sql.exec(`INSERT OR REPLACE INTO ink_stroke (author, id, surface, data) VALUES (?, ?, ?, ?)`,
      author, s.id, s.surface === "editor" ? "editor" : "canvas", data);
    fresh.set(s.id, data);
  }
  sql.exec(`INSERT INTO ink_head (author, updated, name) VALUES (?, ?, ?)
            ON CONFLICT (author) DO UPDATE SET updated = excluded.updated, name = excluded.name`, author, updated, name);
  c.heads.set(author, { author, updated, name });
  if (c.strokes) {
    for (const d of c.strokes.get(author)?.values() ?? []) c.size -= d.length;
    for (const d of fresh.values()) c.size += d.length;
    c.strokes.delete(author);   // re-added at the end, as the rows now are
    c.strokes.set(author, fresh);
    if (c.size > CACHE_MAX) c.strokes = null;
  }
  return strokes.length;
}

/** Remove ink: one author's (a departing account), or everyone's (a deleted page). */
export function wipeInk(sql: InkSql, c: InkCache, author?: string): void {
  if (author) {
    sql.exec(`DELETE FROM ink_stroke WHERE author = ?`, author);
    sql.exec(`DELETE FROM ink_head WHERE author = ?`, author);
    c.heads.delete(author);
    if (c.strokes) { for (const d of c.strokes.get(author)?.values() ?? []) c.size -= d.length; c.strokes.delete(author); }
  } else {
    sql.exec(`DELETE FROM ink_stroke`);
    sql.exec(`DELETE FROM ink_head`);
    c.heads.clear();
    c.strokes = new Map();
    c.size = 0;
  }
}

/** Per-author stroke counts and ids in order — to check a copy against its source. */
export function inkSummary(sql: InkSql): { author: string; count: number; updated: number; ids: string }[] {
  return sql.exec<{ author: string; count: number; updated: number; ids: string }>(
    `SELECT h.author, h.updated,
            (SELECT COUNT(*) FROM ink_stroke s WHERE s.author = h.author) AS count,
            COALESCE((SELECT group_concat(id, ',') FROM (SELECT id FROM ink_stroke s WHERE s.author = h.author ORDER BY seq)), '') AS ids
     FROM ink_head h`).toArray();
}
