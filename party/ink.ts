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
export interface InkUser { uid: string; name: string; canWrite: boolean }

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

const json = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export function readInk(sql: InkSql, me: InkUser, seenMine: string | null, seenOthers: string | null): Response {
  const heads = sql.exec<Head>(`SELECT author, updated, name FROM ink_head`).toArray();
  const mine = heads.find((h) => h.author === me.uid);
  const others = heads.filter((h) => h.author !== me.uid);
  const mineV = String(mine ? mine.updated : 0);
  const othersV = `${others.reduce((m, h) => Math.max(m, h.updated), 0)}.${others.length}`;
  const needMine = seenMine !== mineV;
  const needOthers = seenOthers !== othersV;
  if (!needMine && !needOthers) return json(JSON.stringify({ unchanged: true, mine: mineV, others: othersV }));

  // Strokes are stored as JSON text and joined back into arrays as text — never parsed.
  const parts: string[] = [];
  if (needMine) {
    const rows = sql.exec<{ data: string }>(`SELECT data FROM ink_stroke WHERE author = ? ORDER BY seq`, me.uid).toArray();
    parts.push(`"myStrokes":[${rows.map((r) => r.data).join(",")}]`);
  }
  if (needOthers) {
    const rows = sql.exec<{ author: string; data: string }>(
      `SELECT author, data FROM ink_stroke WHERE author <> ? ORDER BY seq`, me.uid).toArray();
    const by = new Map<string, string[]>();
    for (const r of rows) (by.get(r.author) ?? by.set(r.author, []).get(r.author)!).push(r.data);
    const layers = others
      .filter((h) => by.has(h.author))
      .map((h) => `{"authorId":${JSON.stringify(h.author)},"authorName":${JSON.stringify(h.name)},"strokes":[${by.get(h.author)!.join(",")}]}`);
    // Sent whenever it changed, even empty, so ink erased elsewhere clears here.
    parts.push(`"otherLayers":[${layers.join(",")}]`);
  }
  parts.push(`"mine":${JSON.stringify(mineV)}`, `"others":${JSON.stringify(othersV)}`);
  return json(`{${parts.join(",")}}`);
}

export function saveInk(sql: InkSql, me: InkUser, body: unknown): Response {
  if (!me.canWrite) return json(JSON.stringify({ error: "Read-only" }), 403);
  const b = (body ?? {}) as { strokes?: unknown; surface?: unknown; deletedIds?: unknown; base?: unknown };
  const surface = b.surface === "editor" ? "editor" : "canvas";
  const base = typeof b.base === "string" ? b.base : null;
  const deleted = new Set(Array.isArray(b.deletedIds) ? b.deletedIds.filter((x): x is string => typeof x === "string") : []);
  const keep = (Array.isArray(b.strokes) ? b.strokes as { id?: unknown }[] : [])
    .filter((s): s is { id: string } => !!s && typeof s.id === "string" && !deleted.has(s.id))
    .map((s) => ({ ...s, surface }));

  const prev = sql.exec<{ updated: number }>(`SELECT updated FROM ink_head WHERE author = ?`, me.uid).toArray()[0]?.updated ?? 0;
  const roomHadInk = sql.exec(`SELECT 1 FROM ink_stroke LIMIT 1`).toArray().length > 0;

  for (const id of deleted) sql.exec(`DELETE FROM ink_stroke WHERE author = ? AND id = ?`, me.uid, id);
  for (const s of packStrokes(keep as { points?: unknown }[]) as unknown as { id: string }[]) {
    sql.exec(
      `INSERT INTO ink_stroke (author, id, surface, data) VALUES (?, ?, ?, ?)
       ON CONFLICT (author, id) DO UPDATE SET surface = excluded.surface, data = excluded.data`,
      me.uid, s.id, surface, JSON.stringify(s));
  }
  // Strictly later than the last version, even within one millisecond.
  const now = Math.max(Date.now(), prev + 1);
  sql.exec(
    `INSERT INTO ink_head (author, updated, name) VALUES (?, ?, ?)
     ON CONFLICT (author) DO UPDATE SET updated = excluded.updated, name = excluded.name`,
    me.uid, now, me.name);

  return json(JSON.stringify({
    ok: true,
    // Nobody else wrote since the client's version: it is up to date without reading its ink back.
    ...(base === String(prev) ? { mine: String(now) } : {}),
    // The page's first ink: the app marks the page as having some (Page.inkAt).
    ...(!roomHadInk && keep.length ? { first: true } : {}),
  }));
}

/** Replace one author's ink here wholesale: the copy from the database. */
export function importInk(sql: InkSql, author: string, name: string, updated: number, strokes: { id: string; surface?: string }[]): number {
  sql.exec(`DELETE FROM ink_stroke WHERE author = ?`, author);
  for (const s of strokes) {
    sql.exec(`INSERT OR REPLACE INTO ink_stroke (author, id, surface, data) VALUES (?, ?, ?, ?)`,
      author, s.id, s.surface === "editor" ? "editor" : "canvas", JSON.stringify(s));
  }
  sql.exec(`INSERT INTO ink_head (author, updated, name) VALUES (?, ?, ?)
            ON CONFLICT (author) DO UPDATE SET updated = excluded.updated, name = excluded.name`, author, updated, name);
  return strokes.length;
}

/** Remove ink: one author's (a departing account), or everyone's (a deleted page). */
export function wipeInk(sql: InkSql, author?: string): void {
  if (author) {
    sql.exec(`DELETE FROM ink_stroke WHERE author = ?`, author);
    sql.exec(`DELETE FROM ink_head WHERE author = ?`, author);
  } else {
    sql.exec(`DELETE FROM ink_stroke`);
    sql.exec(`DELETE FROM ink_head`);
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
