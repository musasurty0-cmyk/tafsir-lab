/* Prove the tools reel before rendering it. */
import {
  STATES as S, IX, TILE, T, COMMANDS, CMD_ROW_H, BOOKS, WB_MARKS,
  TILE_STATES, OPENS, MINIMISES, NOTE_TEXT, TOOLS_FRAMES, FPS,
} from "./src/reel/toolsSpec.ts";
import { distOf, tierOf, EASES } from "./src/reel/morph.tsx";

const FRAME_W = 1080, FRAME_H = 1920, TOTAL = TOOLS_FRAMES;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const interp = (x, xs, ys) => {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i++)
    if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * ((x - xs[i - 1]) / (xs[i] - xs[i - 1]));
  return ys[ys.length - 1];
};

function morphAt(f) {
  let i = 0;
  for (let k = 0; k < S.length; k++) if (S[k].at <= f) i = k;
  const a = S[i], b = S[i + 1];
  if (!(b !== undefined && f > b.at - b.morph))
    return { w: a.w, h: a.h, blur: 0, oldKey: null, nowKey: a.key, nowOp: 1,
             contentStart: a.at - a.morph * 0.5 };
  const from = b.at - b.morph;
  const p = clamp01((f - from) / b.morph);
  const e = EASES[b.ease ?? "back"](clamp01((p - 0.15) / 0.4));
  return {
    w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e),
    blur: interp(p, [0, 0.17, 0.42, 0.55], [0, 20, 20, 0]),
    oldKey: a.key, oldOp: interp(p, [0, 0.13], [1, 0]),
    nowKey: b.key, nowOp: interp(p, [0.46, 0.6], [0, 1]),
    contentStart: from + b.morph * 0.5,
  };
}

let pass = 0, fail = 0;
const ok = (n, c, d = "") => {
  if (c) { pass++; console.log(`  PASS  ${n}`); }
  else { fail++; console.log(`  FAIL  ${n}${d ? "  - " + d : ""}`); }
};
const H = (s) => console.log("\n" + s);

H("- the object never leaves the stage");
{
  let minX = 1e9, minY = 1e9, wx = 0, wy = 0;
  for (let f = 0; f < TOTAL; f++) {
    const m = morphAt(f);
    const mx = (FRAME_W - m.w) / 2, my = (FRAME_H - m.h) / 2;
    if (mx < minX) { minX = mx; wx = f; }
    if (my < minY) { minY = my; wy = f; }
  }
  ok("horizontal margin >= 60px", minX >= 60, `min ${minX.toFixed(1)}px at f${wx}`);
  ok("vertical margin >= 60px", minY >= 60, `min ${minY.toFixed(1)}px at f${wy}`);
  console.log(`        tightest: ${minX.toFixed(1)}px x, ${minY.toFixed(1)}px y`);
}

H("- everything stays centred; the movement is in the transitions");
{
  ok("no state parks off centre",
     S.every((x) => x.cx === undefined && x.cy === undefined));
  const dirs = new Set(S.slice(1).map((x) => x.dir ?? "right"));
  ok("transitions travel in at least 3 directions", dirs.size >= 3, [...dirs].join(", "));
  console.log(`        directions [${[...dirs].join(" ")}]`);
}

H("- every icon is the same tile, so a swap changes only the drawing");
for (const key of TILE_STATES) {
  const st = S.find((x) => x.key === key);
  ok(`${key} is the standard tile`,
     st && st.w === TILE.w && st.h === TILE.h && st.r === TILE.r,
     st ? `${st.w}x${st.h} r${st.r}` : "missing");
}
{
  /* Icon to icon must therefore be a zero-distance move: the fastest tier,
     with nothing resizing to distract from the change of drawing. */
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i];
    if (!TILE_STATES.includes(a.key) || !TILE_STATES.includes(b.key)) continue;
    ok(`${a.key} -> ${b.key} is a pure content swap`,
       distOf(a, b) === 0 && b.morph === 24, `d=${distOf(a, b)} ${b.morph}f`);
  }
}

H("- windows rise when they open and drop when they are put away");
{
  for (const key of OPENS) {
    const st = S.find((x) => x.key === key);
    ok(`${key} opens upward`, st.dir === "up", st.dir);
    ok(`${key} is bigger than the icon it came from`, st.w > TILE.w && st.h > TILE.h);
  }
  for (const key of MINIMISES) {
    const st = S.find((x) => x.key === key);
    ok(`${key} drops`, st.dir === "down", st.dir);
  }
  ok("a minimise always follows an open",
     MINIMISES.every((k) => {
       const i = S.findIndex((x) => x.key === k);
       return i > 0 && OPENS.includes(S[i - 1].key);
     }));
}

H("- morph length is a function of distance travelled");
for (let i = 1; i < S.length; i++) {
  const d = distOf(S[i - 1], S[i]);
  ok(`${S[i - 1].key} -> ${S[i].key}  d=${d}px  ${S[i].morph}f`,
     S[i].morph === tierOf(d), `expected ${tierOf(d)}f`);
}

H("- no frame shows two states at once");
{
  let worst = 0, at = -1;
  for (let f = 0; f < TOTAL; f++) {
    const m = morphAt(f);
    if (m.oldKey === null) continue;
    const both = Math.min(m.oldOp, m.nowOp);
    if (both > worst) { worst = both; at = f; }
  }
  ok("max overlap <= 1%", worst <= 0.01, `${(worst * 100).toFixed(2)}% at f${at}`);
}

H("- each glimpse finishes inside its own window's hold");
{
  const holdOf = (key) => {
    const i = S.findIndex((x) => x.key === key);
    return [S[i].at, S[i + 1].at - S[i + 1].morph];
  };
  const pad = holdOf("padOpen");
  const typeEnd = T.padType + Math.ceil(NOTE_TEXT.length / T.padCps);
  ok("the note finishes typing before it is put away", typeEnd < pad[1],
     `ends f${typeEnd}, hold ends f${pad[1]}`);

  const wb = holdOf("wbOpen");
  const wbEnd = T.wbFrom + (WB_MARKS.length - 1) * T.wbStep + T.wbFor;
  ok("every whiteboard mark is drawn in time", wbEnd < wb[1],
     `ends f${wbEnd}, hold ends f${wb[1]}`);
  ok("the marks start after the board has arrived", T.wbFrom >= wb[0]);

  const lib = holdOf("libOpen");
  const libEnd = T.libFrom + (BOOKS.length - 1) * T.libStep + 26;
  ok("every book has landed in time", libEnd < lib[1],
     `ends f${libEnd}, hold ends f${lib[1]}`);

  const sl = holdOf("slashOpen");
  ok("the command list finishes scrolling in time",
     T.slashFrom + T.slashFor < sl[1],
     `ends f${T.slashFrom + T.slashFor}, hold ends f${sl[1]}`);
}

H("- the slash beat really does run the whole registry past");
{
  ok("every command in the registry is listed", COMMANDS.length === 29,
     `${COMMANDS.length}`);
  const view = 940 - 92 - 24;
  const total = COMMANDS.length * CMD_ROW_H;
  ok("the list is taller than the window, so there is something to scroll",
     total > view, `${total}px of rows in ${view}px`);
  const travel = total - view;
  ok("the scroll covers the whole list", travel > 0);
  const rowsPerSec = (travel / CMD_ROW_H) / (T.slashFor / FPS);
  ok("it moves fast enough to feel like a run-through", rowsPerSec >= 3,
     `${rowsPerSec.toFixed(1)} rows/s`);
  ok("but not so fast it is a blur", rowsPerSec <= 9, `${rowsPerSec.toFixed(1)} rows/s`);
  console.log(`        ${COMMANDS.length} commands, ${travel}px of travel, ${rowsPerSec.toFixed(1)} rows/s`);
}

H("- pacing: nothing sits still for long");
{
  const ev = new Set();
  /* A span of continuous change — typing, or a list scrolling — is not two
     events at its ends. Sample it, so the pacing measure reflects what the
     frame is actually doing. */
  const span = (from, to, every = 15) => {
    for (let x = from; x <= to; x += every) ev.add(Math.round(x));
    ev.add(to);
  };
  S.forEach((s) => ev.add(s.at));
  span(T.padType, T.padType + Math.ceil(NOTE_TEXT.length / T.padCps));
  WB_MARKS.forEach((_, i) => ev.add(T.wbFrom + i * T.wbStep));
  BOOKS.forEach((_, i) => ev.add(T.libFrom + i * T.libStep));
  {
    const view = 940 - 92 - 24;
    const travel = COMMANDS.length * CMD_ROW_H - view;
    span(T.slashFrom, T.slashFrom + T.slashFor,
         CMD_ROW_H / (travel / T.slashFor));   // one event per row passing
  }
  S.slice(1).forEach((s) => ev.add(s.at - s.morph));
  const list = [...ev].filter((x) => x >= 0 && x <= TOTAL).sort((a, b) => a - b);
  let worst = 0, wa = 0;
  for (let i = 1; i < list.length; i++)
    if (list[i] - list[i - 1] > worst) { worst = list[i] - list[i - 1]; wa = list[i - 1]; }
  ok("longest gap between visible changes <= 2.2s", worst / FPS <= 2.2,
     `${(worst / FPS).toFixed(2)}s after f${wa}`);
  const tail = TOTAL - list[list.length - 1];
  ok("nothing dead at the end", tail / FPS <= 2.2, `${(tail / FPS).toFixed(2)}s tail`);
  console.log(`        ${list.length} change events, longest gap ${(worst / FPS).toFixed(2)}s`);
}

H("- the shape of the piece");
{
  const beats = S.length;
  ok("at least 12 beats", beats >= 12, `${beats}`);
  const secs = TOTAL / FPS;
  const perBeat = secs / beats;
  ok("averages under 3s a beat", perBeat < 3, `${perBeat.toFixed(2)}s`);
  ok("opens with the mark and closes on the wordmark",
     S[0].key === "mark" && S[S.length - 1].key === "wordmark");
  console.log(`        ${beats} beats over ${secs.toFixed(1)}s — ${perBeat.toFixed(2)}s each`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
