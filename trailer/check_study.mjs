/* Prove the sūrah-study maths before spending a 3230-frame render on it. */
import {
  STATES as S, LEGS, CLICK_TARGET, MAGNETIC, FALLS, SAYS, IX, T, T_END,
  ED, ED_H, MUS, MUS_H, MARK, DESK, TOOLS, SAME_SURFACE, FATIHA,
  STUDY_FRAMES, FPS,
} from "./src/reel/studySpec.ts";
import { distOf, tierOf, EASES } from "./src/reel/morph.tsx";

const FRAME_W = 1080, FRAME_H = 1920, TOTAL = STUDY_FRAMES;
const CLICKS = LEGS.filter((l) => l.click).map((l) => l.at);

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const lerp = (a, b, t) => a + (b - a) * t;
const interp = (x, xs, ys) => {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 1; i < xs.length; i++)
    if (x <= xs[i]) return ys[i - 1] + (ys[i] - ys[i - 1]) * ((x - xs[i - 1]) / (xs[i] - xs[i - 1]));
  return ys[ys.length - 1];
};
const CX = (s) => s.cx ?? FRAME_W / 2;
const CY = (s) => s.cy ?? FRAME_H / 2;

function morphAt(f) {
  let i = 0;
  for (let k = 0; k < S.length; k++) if (S[k].at <= f) i = k;
  const a = S[i], b = S[i + 1];
  const root = (k) => { let j = k; while (j > 0 && S[j].via === "reflow") j--; return j; };
  const startOf = (k) => { const r = root(k); return S[r].at - S[r].morph * 0.5; };
  if (!(b !== undefined && f > b.at - b.morph))
    return { w: a.w, h: a.h, r: a.r, cx: CX(a), cy: CY(a), blur: 0,
             oldKey: null, nowKey: a.key, nowOp: 1, contentStart: startOf(i) };
  const from = b.at - b.morph;
  const p = clamp01((f - from) / b.morph);
  const e = EASES[b.ease ?? "back"](clamp01((p - 0.15) / 0.4));
  if (b.via === "reflow")
    return { w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e), r: lerp(a.r, b.r, e),
             cx: lerp(CX(a), CX(b), e), cy: lerp(CY(a), CY(b), e),
             blur: 0, oldKey: null, nowKey: b.key, nowOp: 1, contentStart: startOf(i + 1) };
  const fall = b.exit === "fall";
  const gone = fall ? 0.34 : 0.13;
  const k = clamp01(p / gone);
  return {
    w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e), r: lerp(a.r, b.r, e),
    cx: lerp(CX(a), CX(b), e), cy: lerp(CY(a), CY(b), e),
    blur: fall ? interp(p, [0.30, 0.40, 0.50, 0.60], [0, 20, 20, 0])
               : interp(p, [0, 0.17, 0.42, 0.55], [0, 20, 20, 0]),
    oldKey: a.key, oldOp: fall ? 1 - k * k : interp(p, [0, gone], [1, 0]),
    nowKey: b.key, nowOp: interp(p, [fall ? 0.62 : 0.46, fall ? 0.74 : 0.6], [0, 1]),
    contentStart: from + b.morph * (fall ? 0.66 : 0.5),
  };
}

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name}${detail ? "  - " + detail : ""}`); }
};
const H = (s) => console.log("\n" + s);

H("- the container never leaves the stage");
{
  let minX = 1e9, minY = 1e9, wx = 0, wy = 0;
  for (let f = 0; f < TOTAL; f++) {
    const m = morphAt(f);
    const mx = Math.min(m.cx - m.w / 2, FRAME_W - (m.cx + m.w / 2));
    const my = Math.min(m.cy - m.h / 2, FRAME_H - (m.cy + m.h / 2));
    if (mx < minX) { minX = mx; wx = f; }
    if (my < minY) { minY = my; wy = f; }
  }
  ok("horizontal margin >= 60px", minX >= 60, `min ${minX.toFixed(1)}px at f${wx}`);
  ok("vertical margin >= 60px", minY >= 60, `min ${minY.toFixed(1)}px at f${wy}`);
  console.log(`        tightest: ${minX.toFixed(1)}px x (f${wx}), ${minY.toFixed(1)}px y (f${wy})`);
}

H("- the subject is centred, with one motivated exception");
{
  const off = S.filter((x) => (x.cx ?? FRAME_W / 2) !== FRAME_W / 2 ||
                              (x.cy ?? FRAME_H / 2) !== FRAME_H / 2);
  ok("only the dock icon sits away from centre",
     off.length === 1 && off[0].key === "dock", off.map((x) => x.key).join(", "));
  ok("and it sits in the dock, where a dock icon belongs",
     S[IX.dock].cy === DESK.dockCy && S[IX.dock].cx === undefined);
  ok("everything after the launch is centred",
     S.slice(1).every((x) => x.cx === undefined && x.cy === undefined));
}

H("- morph length is a function of distance travelled");
for (let i = 1; i < S.length; i++) {
  const d = distOf(S[i - 1], S[i]);
  const want = tierOf(d) + (S[i].exit === "fall" ? 16 : 0);
  ok(`${S[i - 1].key} -> ${S[i].key}  d=${d}px  ${S[i].morph}f`,
     S[i].morph === want, `expected ${want}f`);
}

H("- the note is ONE document growing, never rebuilt");
{
  for (let i = 1; i < S.length; i++) {
    const a = S[i - 1], b = S[i];
    if (!SAME_SURFACE.includes(a.key) || !SAME_SURFACE.includes(b.key)) continue;
    ok(`${a.key} -> ${b.key} reflows`, b.via === "reflow", `via=${b.via ?? "morph"}`);
  }
  let blurred = 0;
  for (let f = 0; f < TOTAL; f++) {
    const m = morphAt(f);
    if (m.blur > 0.01 && m.oldKey &&
        SAME_SURFACE.includes(m.oldKey) && SAME_SURFACE.includes(m.nowKey)) blurred++;
  }
  ok("the note is never blurred away and rebuilt", blurred === 0, `${blurred} frames`);
}

H("- each editor state is exactly its content, block by block");
{
  ok("the command line adds one line", ED_H.ayahCmd - ED_H.note === ED.lineH);
  ok("the suggestion adds one row plus its gap",
     ED_H.ayahMenu - ED_H.ayahCmd === ED.menuH + ED.menuGap);
  ok("the ayah block replaces the command line with the block",
     ED_H.ayah - ED_H.note === ED.ayahH);
  ok("the tafsir picker is twice the height of the ayah picker",
     ED.menuH2 === ED.menuH * 2);
  ok("the tafsir block replaces its command line with the block",
     ED_H.tafsir - ED_H.ayah === ED.tafH);
  ok("the document only ever grows through the command beats",
     ED_H.note < ED_H.ayah && ED_H.ayah < ED_H.tafsir,
     `${ED_H.note} -> ${ED_H.ayah} -> ${ED_H.tafsir}`);
  console.log(`        heights ${Object.values(ED_H).join(", ")}`);
}

H("- the launch reads as one object leaving the dock");
{
  ok("the dock icon is clicked before the window opens",
     T.dockClick < S[IX.window].at - S[IX.window].morph,
     `click f${T.dockClick}, morph f${S[IX.window].at - S[IX.window].morph}`);
  ok("the pointer reaches the icon before it clicks", T.dockHover < T.dockClick);
  ok("the launch click gets the magnetic snap", MAGNETIC.has(T.dockClick));
  ok("the icon sits inside the dock bar",
     Math.abs(DESK.dockCy - S[IX.dock].cy) < 1 &&
     S[IX.dock].w <= DESK.dockW - 2 * DESK.icon,
     "icon must fit its slot");
}

H("- commands are typed, offered, and chosen in that order");
{
  const seq = [
    ["/ayah typed", T.ayahStart, T_END.ayah],
    ["/tafsir typed", T.tafStart, T_END.taf],
  ];
  ok("the ayah command finishes before its menu opens",
     T_END.ayah < S[IX.ayahMenu].at - S[IX.ayahMenu].morph,
     `ends f${T_END.ayah}, menu f${S[IX.ayahMenu].at - S[IX.ayahMenu].morph}`);
  ok("the ayah is picked while its menu is up",
     T.ayahPick >= S[IX.ayahMenu].at && T.ayahPick < S[IX.ayah].at - S[IX.ayah].morph,
     `pick f${T.ayahPick}`);
  ok("the tafsir command finishes before its picker opens",
     T_END.taf < S[IX.tafMenu].at - S[IX.tafMenu].morph,
     `ends f${T_END.taf}`);
  ok("the source is picked while the picker is up",
     T.tafPick >= S[IX.tafMenu].at && T.tafPick < S[IX.tafsir].at - S[IX.tafsir].morph,
     `pick f${T.tafPick}`);
  ok("both picks get the magnetic snap",
     MAGNETIC.has(T.ayahPick) && MAGNETIC.has(T.tafPick));
  seq.forEach(([n, a, b]) => ok(`${n} inside the piece`, a > 0 && b < TOTAL));
}

H("- the commentary shimmers before it resolves");
{
  ok("the skeleton appears with the block", T.tafSkeleton === S[IX.tafsir].at,
     `${T.tafSkeleton} vs ${S[IX.tafsir].at}`);
  ok("it shimmers for at least a second before the text lands",
     T.tafResolve - T.tafSkeleton >= 60, `${T.tafResolve - T.tafSkeleton} frames`);
  ok("the text has resolved before the block leaves",
     T.tafResolve + 26 < S[IX.mode].at - S[IX.mode].morph);
}

H("- the muṣḥaf is marked up with the app's own tools");
{
  ok("six tools, in the rail's order", TOOLS.length === 6,
     TOOLS.map((x) => x.id).join(", "));
  ok("the sūrah is complete", FATIHA.length === 7, `${FATIHA.length} lines`);
  const order = [
    ["highlight", T.hlTool, T.hlDraw, T.hlFor],
    ["pen",       T.penTool, T.penDraw, T.penFor],
    ["arrow",     T.arrTool, T.arrDraw, T.arrFor],
  ];
  for (const [name, tool, draw, len] of order) {
    ok(`${name}: the tool is chosen before the mark is made`, tool < draw,
       `tool f${tool}, draw f${draw}`);
    ok(`${name}: the mark finishes inside the muṣḥaf hold`,
       draw + len < S[IX.done].at - S[IX.done].morph);
  }
  ok("the text box is typed, not pasted", T.txtCps > 0 && T_END.txt > T.txtDraw);
  ok("every mark lands on the sheet, clear of the tool rail",
     [MARK.hl.x0, MARK.pen.x0, MARK.arr.x0, MARK.txt.x]
       .every((x) => x > MUS.pad + MUS.railW),
     "a mark is under the rail");
  ok("every mark lands inside the card",
     MARK.hl.y + MARK.hl.h < MUS_H && MARK.txt.y + MARK.txt.h < MUS_H &&
     MARK.arr.y < MUS_H,
     `card is ${MUS_H}px tall`);
  const lineOf = (y) => Math.floor((y - MUS.line0) / MUS.lineH);
  ok("the highlight sits on a real āyah line",
     lineOf(MARK.hl.y) >= 0 && lineOf(MARK.hl.y) < MUS.lines,
     `line ${lineOf(MARK.hl.y)}`);
  ok("the underline sits on a real āyah line",
     lineOf(MARK.pen.y) >= 0 && lineOf(MARK.pen.y) < MUS.lines,
     `line ${lineOf(MARK.pen.y)}`);
  console.log(`        marks on lines ${lineOf(MARK.pen.y)} and ${lineOf(MARK.hl.y)} of ${MUS.lines}`);
}

H("- clicks land on a settled, unblurred target");
for (const at of CLICKS) {
  const want = CLICK_TARGET[at];
  if (!want) continue;
  const m = morphAt(at);
  ok(`f${at} -> settled "${want}"`,
     m.nowKey === want && m.blur === 0 && m.oldKey === null,
     `got ${m.nowKey}, blur ${m.blur.toFixed(1)}`);
}

H("- explanation text never overlaps the container");
for (const s of SAYS) {
  let clash = null;
  for (let f = s.from; f <= s.to; f++) {
    const m = morphAt(f);
    if (s.top + 130 > m.cy - m.h / 2 && s.top < m.cy + m.h / 2) { clash = f; break; }
  }
  ok(`"${s.text.slice(0, 26)}..." clears the card`, clash === null,
     clash === null ? "" : `overlaps at f${clash}`);
}

H("- pacing: the frame never goes long without something changing");
{
  const ev = new Set();
  S.forEach((s) => ev.add(s.at));
  SAYS.forEach((s) => {
    ev.add(s.from); ev.add(s.to);
    ev.add(s.from + (s.text.split(" ").length - 1) * 7 + 20);
  });
  CLICKS.forEach((c) => ev.add(c));
  LEGS.forEach((l) => ev.add(l.at));
  [T.ayahStart, T_END.ayah, T.tafStart, T_END.taf,
   T.tafSkeleton, T.tafResolve, T.tafResolve + 26,
   T.hlTool, T.hlDraw, T.hlDraw + T.hlFor,
   T.penTool, T.penDraw, T.penDraw + T.penFor,
   T.arrTool, T.arrDraw, T.arrDraw + T.arrFor,
   T.txtTool, T.txtDraw, T_END.txt,
   T.dockHover, T.dockClick, T.modeClick, T.modeClick + 16].forEach((x) => ev.add(x));
  FALLS.forEach((x) => ev.add(x));
  const list = [...ev].filter((x) => x >= 0 && x <= TOTAL).sort((a, b) => a - b);
  let worst = 0, wa = 0;
  for (let i = 1; i < list.length; i++)
    if (list[i] - list[i - 1] > worst) { worst = list[i] - list[i - 1]; wa = list[i - 1]; }
  const tail = TOTAL - list[list.length - 1];
  ok("longest gap between visible changes <= 2.6s", worst / FPS <= 2.6,
     `${(worst / FPS).toFixed(2)}s after f${wa}`);
  ok("nothing dead at the very end", tail / FPS <= 2.6, `${(tail / FPS).toFixed(2)}s tail`);
  console.log(`        ${list.length} change events, longest gap ${(worst / FPS).toFixed(2)}s after f${wa}`);
}

H("- variation");
{
  const areas = S.map((x) => x.w * x.h);
  console.log(`        area span ${(Math.max(...areas) / Math.min(...areas)).toFixed(1)}x`);
  ok("largest state is >= 10x the smallest",
     Math.max(...areas) / Math.min(...areas) >= 10);
  const fam = (x) => x.r / Math.min(x.w, x.h) < 0.2 ? "rect" : "pill";
  ok("more than one container shape", new Set(S.map(fam)).size >= 2);
  const dirs = new Set(S.slice(1).filter((x) => x.via !== "reflow" && x.exit !== "fall")
                         .map((x) => x.dir ?? "right"));
  ok("transitions travel in at least 2 directions", dirs.size >= 2, [...dirs].join(", "));
  const above = SAYS.filter((x) => x.top < FRAME_H / 2).length;
  ok("text uses both halves of the frame", above > 0 && above < SAYS.length,
     `${above} above, ${SAYS.length - above} below`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
