// A check of party/ink.ts against real SQLite (node:sqlite):
//   npx tsx party/ink.check.mts
// Saves, edits, erasures, imports and wipes give the right answers, before and
// after a room wakes; an unchanged poll reads no strokes; a wake reads one row
// per bucket, not per stroke; and a room still stored one row per stroke moves
// into buckets exactly, keeping the drawing order.
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { ensureInk, importInk, inkSummary, loadInk, readInk, saveInk, strokesOf, wipeInk, type InkCache, type InkSql } from "./ink.ts";

function sqlOf(db: DatabaseSync): InkSql & { rows: number } {
  const o = {
    rows: 0,
    exec(q: string, ...b: unknown[]) {
      const r = db.prepare(q).all(...(b as never[])) as Record<string, unknown>[];
      o.rows += r.length;
      return Object.assign(r[Symbol.iterator](), { toArray: () => r }) as never;
    },
  };
  return o;
}

const A = { uid: "a", name: "Aisha", canWrite: true };
const B = { uid: "b", name: "Bilal", canWrite: true };
const st = (id: string, x = 1) => ({ id, color: "#000", width: 2, points: [{ x, y: 1 }, { x: x + 1, y: 2 }] });
const ids = (list: { id: string }[]) => list.map((s) => s.id);

const db = new DatabaseSync(":memory:");
const sql = sqlOf(db);
ensureInk(sql);
let c: InkCache = loadInk(sql);
const wake = () => { c = loadInk(sql); };                 // a room waking: memory gone, storage kept
const read = async (me: typeof A, mine: string | null, others: string | null) => JSON.parse(await readInk(sql, c, me, mine, others).text());
const save = async (me: typeof A, body: object) => { strokesOf(sql, c); return JSON.parse(await saveInk(sql, c, me, body).text()); };

// A draws; it is the page's first ink.
let r = await save(A, { strokes: [st("1"), st("2")], surface: "editor", base: "0" });
assert.equal(r.ok, true); assert.equal(r.first, true);
let rb = await read(B, null, null);
assert.deepEqual(ids(rb.otherLayers[0].strokes), ["1", "2"]);
assert.equal(rb.otherLayers[0].authorName, "Aisha");
let ra = await read(A, null, null);
assert.deepEqual(ids(ra.myStrokes), ["1", "2"]);

// Nothing new after a wake: heads only, no stroke read.
wake();
let before = sql.rows;
assert.equal((await read(B, rb.mine, rb.others)).unchanged, true);
assert.ok(sql.rows - before <= 2, `an unchanged poll read ${sql.rows - before} rows`);

// Edit 1 (keeps its place), erase 2, add 3; B draws on the canvas.
r = await save(A, { strokes: [st("1", 9), st("3")], deletedIds: ["2"], surface: "editor", base: ra.mine });
assert.equal(r.first, undefined);
await save(B, { strokes: [st("x")], surface: "canvas" });
rb = await read(B, rb.mine, rb.others);
assert.deepEqual(ids(rb.otherLayers[0].strokes), ["1", "3"]);
assert.notDeepEqual(rb.otherLayers[0].strokes[0], ra.myStrokes[0], "the edit to stroke 1 was kept");
assert.deepEqual(ids(rb.myStrokes), ["x"]);

// Same answers after a wake, read from the buckets.
wake();
const rb2 = await read(B, null, null);
assert.deepEqual(rb2.otherLayers, rb.otherLayers);
assert.deepEqual(rb2.myStrokes, rb.myStrokes);

// Many strokes: a wake reads one row per bucket, not one per stroke.
const many = Array.from({ length: 1200 }, (_, i) => st(`m${i}`, i));
for (let i = 0; i < many.length; i += 100) await save(A, { strokes: many.slice(i, i + 100), surface: "canvas" });
wake();
before = sql.rows;
const big = await read(B, null, null);
const woke = sql.rows - before;
assert.equal(big.otherLayers[0].strokes.length, 1202);
assert.deepEqual(ids(big.otherLayers[0].strokes).slice(0, 4), ["1", "3", "m0", "m1"]);
assert.ok(woke <= 12, `a wake read ${woke} rows for 1,203 strokes`);
console.log(`1,203 strokes: a wake reads ${woke} rows`);

// Erasing from an early bucket, after a wake, keeps everything else in order.
await save(A, { strokes: [], deletedIds: ["m5", "3"], surface: "canvas" });
wake();
const after = await read(B, null, null);
assert.equal(after.otherLayers[0].strokes.length, 1200);
assert.deepEqual(ids(after.otherLayers[0].strokes).slice(0, 4), ["1", "m0", "m1", "m2"]);

// Import replaces A's ink wholesale; wipe removes B's.
importInk(sql, c, "a", "Aisha", Date.now() + 1000, [st("i1"), st("i2"), st("i1", 5)]);
wipeInk(sql, c, "b");
ra = await read(A, null, null);
assert.deepEqual(ids(ra.myStrokes), ["i2", "i1"]);
assert.deepEqual(ra.otherLayers, []);
wake();
assert.deepEqual(ids((await read(A, null, null)).myStrokes), ["i2", "i1"]);
assert.deepEqual(inkSummary(sql, c).map((x) => [x.author, x.count, x.ids]), [["a", 2, "i2,i1"]]);

// Wipe all.
wipeInk(sql, c);
const empty = await read(B, null, null);
assert.deepEqual(empty.myStrokes, []); assert.deepEqual(empty.otherLayers, []);
console.log("buckets: ok");

// ── A page far past the old 48 MB ceiling still takes new strokes, and its reply streams whole ──
{
  const big = new DatabaseSync(":memory:");
  const bsql = sqlOf(big);
  ensureInk(bsql);
  c = loadInk(bsql);
  const fat = (i: number) => ({ id: `f${i}`, color: "#000", width: 2, points: Array.from({ length: 9000 }, (_, k) => ({ x: k + i, y: k })) });
  for (let i = 0; i < 360; i += 20) {
    strokesOf(bsql, c);
    await saveInk(bsql, c, A, { strokes: Array.from({ length: 20 }, (_, k) => fat(i + k)), surface: "canvas" }).text();
  }
  const mb = (c.size / 1e6).toFixed(0);
  assert.ok(c.size > 48_000_000, `test page is only ${mb} MB`);
  strokesOf(bsql, c);
  const res = JSON.parse(await saveInk(bsql, c, A, { strokes: [st("after-the-ceiling")], surface: "canvas" }).text());
  assert.equal(res.ok, true, "a new stroke on a page past 48 MB is accepted");
  c = loadInk(bsql);                                   // a wake: only the index comes back into memory
  const reply = await readInk(bsql, c, B, null, null).text();
  const parsed = JSON.parse(reply);
  assert.equal(parsed.otherLayers[0].strokes.length, 361);
  assert.equal(parsed.otherLayers[0].strokes.at(-1).id, "after-the-ceiling");
  assert.deepEqual(ids(parsed.otherLayers[0].strokes).slice(0, 3), ["f0", "f1", "f2"]);
  console.log(`${mb} MB page: new strokes accepted, reply streamed whole (${(reply.length / 1e6).toFixed(0)} MB): ok`);
}

// ── An old room, one row per stroke, moves into buckets on first use ──
const old = new DatabaseSync(":memory:");
const osql = sqlOf(old);
ensureInk(osql);
const ins = old.prepare(`INSERT INTO ink_stroke (author, id, surface, data) VALUES (?, ?, ?, ?)`);
for (let i = 0; i < 600; i++) ins.run(i % 3 ? "a" : "b", `o${i}`, "canvas", JSON.stringify(st(`o${i}`, i)));
old.prepare(`INSERT INTO ink_head (author, updated, name) VALUES ('a', 5, 'Aisha'), ('b', 6, 'Bilal')`).run();
c = loadInk(osql);
const oa = JSON.parse(await readInk(osql, c, A, null, null).text());
assert.deepEqual(ids(oa.myStrokes), Array.from({ length: 600 }, (_, i) => i).filter((i) => i % 3).map((i) => `o${i}`));
assert.deepEqual(ids(oa.otherLayers[0].strokes), Array.from({ length: 600 }, (_, i) => i).filter((i) => !(i % 3)).map((i) => `o${i}`));
assert.equal((old.prepare(`SELECT COUNT(*) AS n FROM ink_stroke`).get() as { n: number }).n, 0);
const buckets = (old.prepare(`SELECT COUNT(*) AS n FROM ink_bucket`).get() as { n: number }).n;
c = loadInk(osql);
const ob = JSON.parse(await readInk(osql, c, B, null, null).text());
assert.deepEqual(ob.otherLayers[0].strokes, oa.myStrokes);
console.log(`old room: 600 strokes moved into ${buckets} buckets, order kept: ok`);
