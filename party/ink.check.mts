// A quick check of party/ink.ts against real SQLite (node:sqlite), run with
// `npx tsx party/ink.check.mts`. Exercises the in-memory copy and the
// read-from-storage path for pages too large to keep, which must agree.
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { ensureInk, importInk, loadInk, readInk, saveInk, wipeInk, type InkCache, type InkSql } from "./ink.ts";

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

async function run(label: string, big: boolean) {
  const db = new DatabaseSync(":memory:");
  const sql = sqlOf(db);
  ensureInk(sql);
  let c: InkCache = loadInk(sql);
  const fresh = () => { c = loadInk(sql); if (big) c.strokes = null; };
  if (big) c.strokes = null;
  const read = async (me: typeof A, mine: string | null, others: string | null) => JSON.parse(await readInk(sql, c, me, mine, others).text());
  const save = async (me: typeof A, body: object) => JSON.parse(await saveInk(sql, c, me, body).text());

  // A draws two strokes; it is the page's first ink.
  let r = await save(A, { strokes: [st("1"), st("2")], surface: "editor", base: "0" });
  assert.equal(r.ok, true); assert.equal(r.first, true);
  // B sees A's layer; A sees its own strokes.
  let rb = await read(B, null, null);
  assert.equal(rb.otherLayers.length, 1); assert.deepEqual(rb.otherLayers[0].strokes.map((s: { id: string }) => s.id), ["1", "2"]);
  assert.equal(rb.otherLayers[0].authorName, "Aisha");
  let ra = await read(A, null, null);
  assert.deepEqual(ra.myStrokes.map((s: { id: string }) => s.id), ["1", "2"]);
  // Nothing new: unchanged, and (with the copy in memory) no rows read.
  const before = sql.rows;
  const u = await read(B, rb.mine, rb.others);
  assert.equal(u.unchanged, true);
  if (!big) assert.equal(sql.rows, before, "an unchanged read must cost no rows");
  // A edits stroke 1 (keeps its place), erases 2, adds 3; B draws too.
  r = await save(A, { strokes: [st("1", 9), st("3")], deletedIds: ["2"], surface: "editor", base: ra.mine });
  assert.equal(r.first, undefined);
  await save(B, { strokes: [st("x")], surface: "canvas" });
  rb = await read(B, rb.mine, rb.others);
  assert.deepEqual(rb.otherLayers[0].strokes.map((s: { id: string }) => s.id), ["1", "3"]);
  assert.equal(rb.otherLayers[0].strokes[0].points !== undefined || rb.otherLayers[0].strokes[0].p !== undefined, true);
  assert.deepEqual(rb.myStrokes.map((s: { id: string }) => s.id), ["x"]);
  // After a reload from storage (a room waking) the answers are the same.
  fresh();
  const rb2 = await read(B, null, null);
  assert.deepEqual(rb2.otherLayers, rb.otherLayers);
  assert.deepEqual(rb2.myStrokes, rb.myStrokes);
  // Import replaces A's ink wholesale; wipe removes B's.
  importInk(sql, c, "a", "Aisha", Date.now() + 1000, [st("i1"), st("i2")]);
  wipeInk(sql, c, "b");
  ra = await read(A, null, null);
  assert.deepEqual(ra.myStrokes.map((s: { id: string }) => s.id), ["i1", "i2"]);
  assert.deepEqual(ra.otherLayers, []);
  fresh();
  assert.deepEqual((await read(A, null, null)).myStrokes.map((s: { id: string }) => s.id), ["i1", "i2"]);
  // Wipe all.
  wipeInk(sql, c);
  const empty = await read(B, null, null);
  assert.deepEqual(empty.myStrokes, []); assert.deepEqual(empty.otherLayers, []);
  console.log(`${label}: ok`);
}

await run("in memory", false);
await run("too large to keep", true);
