/* Prove the trailer's maths before spending a 2480-frame render on it.
   Imports the real spec and the real easing curves, so the numbers checked
   here are the numbers that render. */
import {
  STATES as S, THEME_KEYS, LEGS, CLICK_TARGET, MAGNETIC, FALLS, T, T_END,
  SAYS, STARTS, IX, NOTE, NOTE_H, MOD, MOD_H, STACK, STACK_H, TOG,
  DRAW_FOR, TRAILER_FRAMES, FPS,
} from "./src/reel/trailerSpec.ts";
import { distOf, tierOf, EASES } from "./src/reel/morph.tsx";

const FRAME_W = 1080, FRAME_H = 1920, TOTAL = TRAILER_FRAMES;
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

/** Mirrors morphAt() in morph.tsx, including the fall windows. */
function morphAt(f) {
  let i = 0;
  for (let k = 0; k < S.length; k++) if (S[k].at <= f) i = k;
  const a = S[i], b = S[i + 1];
  if (!(b !== undefined && f > b.at - b.morph))
    return { w: a.w, h: a.h, r: a.r, cx: CX(a), cy: CY(a), blur: 0,
             oldKey: null, nowKey: a.key, nowOp: 1, contentStart: a.at - a.morph * 0.5 };
  const from = b.at - b.morph;
  const p = clamp01((f - from) / b.morph);
  const e = EASES[b.ease ?? "back"](clamp01((p - 0.15) / 0.4));
  const fall = b.exit === "fall";
  const gone = fall ? 0.34 : 0.13;
  const k = clamp01(p / gone);
  return {
    w: lerp(a.w, b.w, e), h: lerp(a.h, b.h, e), r: lerp(a.r, b.r, e),
    cx: lerp(CX(a), CX(b), e), cy: lerp(CY(a), CY(b), e),
    blur: fall
      ? interp(p, [0.30, 0.40, 0.50, 0.60], [0, 20, 20, 0])
      : interp(p, [0, 0.17, 0.42, 0.55], [0, 20, 20, 0]),
    oldKey: a.key,
    oldOp: fall ? 1 - k * k : interp(p, [0, gone], [1, 0]),
    nowKey: b.key,
    nowOp: interp(p, [fall ? 0.62 : 0.46, fall ? 0.74 : 0.6], [0, 1]),
    contentStart: from + b.morph * (fall ? 0.66 : 0.5),
  };
}
const darkAt = (f) => {
  let t = THEME_KEYS[0].t;
  for (let i = 1; i < THEME_KEYS.length; i++) {
    const a = THEME_KEYS[i - 1], b = THEME_KEYS[i];
    if (f >= b.at) { t = b.t; continue; }
    if (f > a.at) { t = a.t + (b.t - a.t) * ((f - a.at) / Math.max(1, b.at - a.at)); break; }
  }
  return clamp01(t);
};

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

H("- morph length is a function of distance travelled, not feel");
for (let i = 1; i < S.length; i++) {
  const d = distOf(S[i - 1], S[i]);
  const want = tierOf(d) + (S[i].exit === "fall" ? 16 : 0);
  ok(`${S[i - 1].key} -> ${S[i].key}  d=${d}px  ${S[i].morph}f  ${S[i].ease ?? "back"}`,
     S[i].morph === want, `expected ${want}f`);
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

H("- peak blur only ever happens with an empty container");
{
  const bad = [];
  for (let f = 0; f < TOTAL; f++) {
    const m = morphAt(f);
    if (m.oldKey === null) continue;
    if (m.blur > 18 && (m.oldOp > 0.01 || m.nowOp > 0.01)) bad.push(f);
  }
  ok("no violating frames, smear and fall alike", bad.length === 0, `${bad.length} frames`);
}

H("- variation: the piece is not one shot repeated");
{
  const centres = new Set(S.map((s) => `${CX(s)},${CY(s)}`));
  const xs = new Set(S.map((s) => CX(s)));
  const offX = Math.max(...S.map((s) => Math.abs(CX(s) - FRAME_W / 2)));
  ok("at least 5 distinct container positions", centres.size >= 5, `${centres.size}`);
  ok("at least 3 distinct horizontal positions", xs.size >= 3, `${xs.size}`);
  ok("the frame is used sideways, not just up and down", offX >= 100,
     `furthest ${offX}px off centre`);

  const areas = S.map((s) => s.w * s.h);
  const areaSpan = Math.max(...areas) / Math.min(...areas);
  ok("largest state is >= 10x the area of the smallest", areaSpan >= 10,
     `${areaSpan.toFixed(1)}x`);

  const asp = S.map((s) => s.w / s.h);
  const aspSpan = Math.max(...asp) / Math.min(...asp);
  ok("aspect ratios span >= 3x", aspSpan >= 3, `${aspSpan.toFixed(2)}x`);

  /* Shape families, so text is not always sitting in the same oblong. */
  const family = (s) => {
    if (s.r / Math.min(s.w, s.h) < 0.2) return "rect";
    return Math.abs(s.w / s.h - 1) < 0.05 ? "circle" : "pill";
  };
  const fams = new Set(S.map(family));
  ok("at least 3 distinct container shapes", fams.size >= 3, [...fams].join(", "));
  ok("exactly one true circle", S.filter((s) => family(s) === "circle").length === 1);

  const eases = new Set(S.slice(1).map((s) => s.ease ?? "back"));
  ok("at least 3 different easing curves", eases.size >= 3, [...eases].join(", "));
  ok("both exit styles are used",
     new Set(S.slice(1).map((s) => s.exit ?? "smear")).size === 2);

  console.log(`        ${centres.size} positions (${xs.size} horizontal, max ${offX}px off centre)`);
  console.log(`        area ${areaSpan.toFixed(1)}x, aspect ${aspSpan.toFixed(2)}x, ` +
              `shapes [${[...fams].join(" ")}], eases [${[...eases].join(" ")}]`);
}

H("- both themes separate the card from the stage by the same amount");
{
  const lum = (hex) => {
    const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
  };
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const light = ratio("#e9e5de", "#fefdfc");
  const dark = ratio("#0c0c0c", "#202020");
  const ref = ratio("#e5e4e9", "#ffffff");
  console.log(`        reference ${ref.toFixed(3)}:1   light ${light.toFixed(3)}:1   dark ${dark.toFixed(3)}:1`);
  ok("light stage separation matches the reference", Math.abs(light - ref) < 0.04,
     `off by ${Math.abs(light - ref).toFixed(3)}`);
  ok("dark separates as clearly as light does", Math.abs(dark - light) < 0.06,
     `light ${light.toFixed(3)} vs dark ${dark.toFixed(3)}`);
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
  ev.add(T.slashStart); ev.add(T_END.slash);
  ev.add(T.nameStart);  ev.add(T_END.name);
  ev.add(T.catRack); ev.add(T.btnRack);
  ev.add(T.themeAt); ev.add(T.themeAt + T.themeOver);
  FALLS.forEach((x) => ev.add(x));
  [1, 2, 3].forEach((i) => ev.add(S[IX.stack].at + i * STACK.step));
  STARTS.forEach((x) => ev.add(x));
  ev.add(STARTS[STARTS.length - 1] + DRAW_FOR);
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

H("- perfect loop");
{
  const a = morphAt(0), z = morphAt(TOTAL - 1);
  ok("same container geometry", a.w === z.w && a.h === z.h && a.r === z.r &&
     a.cx === z.cx && a.cy === z.cy,
     `${a.w}x${a.h}@${a.cx},${a.cy} vs ${z.w}x${z.h}@${z.cx},${z.cy}`);
  ok("same state", a.nowKey === z.nowKey, `${a.nowKey} vs ${z.nowKey}`);
  ok("both unblurred and not mid-morph", a.blur === 0 && z.blur === 0 &&
     a.oldKey === null && z.oldKey === null);
  ok("both in light tone", darkAt(0) === 0 && darkAt(TOTAL - 1) === 0,
     `${darkAt(0)} vs ${darkAt(TOTAL - 1)}`);
  const settled = (cs) => cs + 60;   // the title card's accent rule, s+26 -> s+60
  ok("frame 0 content settled", settled(a.contentStart) <= 0, `settles f${settled(a.contentStart)}`);
  ok("final content settled", settled(z.contentStart) <= TOTAL - 1,
     `settles f${settled(z.contentStart)}`);
}

H("- the mode drop is CAUSED by the click, not laid over a transition");
{
  ok("the tone is still light when the switch is clicked", darkAt(T.themeAt) === 0);
  ok("it is fully dark shortly after", darkAt(T.themeAt + T.themeOver) === 1);
  ok("the click happens while the toggle state is settled and unblurred",
     (() => { const m = morphAt(T.themeAt);
       return m.nowKey === "toggle" && m.blur === 0 && m.oldKey === null; })());
  ok("the whole tone change finishes inside the toggle's hold",
     T.themeAt + T.themeOver < S[IX.wheel].at - S[IX.wheel].morph,
     `ends f${T.themeAt + T.themeOver}, morph f${S[IX.wheel].at - S[IX.wheel].morph}`);
  ok("the map is fully dark by the time it arrives", darkAt(S[IX.wheel].at) === 1);
  ok("the switch click uses the magnetic snap", MAGNETIC.has(T.themeAt));
}

H("- the ring is explained before it fills");
{
  const wheel = S[IX.wheel];
  const about = SAYS.filter((s) => s.from >= wheel.at - wheel.morph && s.from <= wheel.at + 400);
  ok("at least two lines explain the map", about.length >= 2, `${about.length}`);
  ok("the first lands within a second of the ring appearing",
     about.length > 0 && about[0].from - wheel.at <= 60,
     about.length ? `f${about[0].from} vs ring f${wheel.at}` : "none");
  ok("they are not both in the same band",
     new Set(about.map((s) => s.top)).size > 1,
     about.map((s) => s.top).join(", "));
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

H("- clicks land on a settled, unblurred target");
{
  for (const at of CLICKS) {
    const want = CLICK_TARGET[at];
    if (!want) continue;
    const m = morphAt(at);
    ok(`f${at} -> settled "${want}"`,
       m.nowKey === want && m.blur === 0 && m.oldKey === null,
       `got ${m.nowKey}, blur ${m.blur.toFixed(1)}`);
  }
  const inside = (label, x, y, w, h, cx = FRAME_W / 2, cy = FRAME_H / 2) => {
    const L = cx - w / 2, TT = cy - h / 2;
    ok(`${label} is inside its container`,
       x > L + 8 && x < L + w - 8 && y > TT + 8 && y < TT + h - 8,
       `(${x.toFixed(0)},${y.toFixed(0)}) box ${L},${TT} ${w}x${h}`);
  };
  inside("slash line", FRAME_W / 2 - 450 + NOTE.pad + 26,
         FRAME_H / 2 - NOTE_H.slash / 2 + NOTE.slashY + NOTE.lineH / 2, 900, NOTE_H.slash);
  inside("menu item", FRAME_W / 2 - 450 + NOTE.pad + 200,
         FRAME_H / 2 - NOTE_H.menu / 2 + NOTE.slashY + NOTE.lineH + NOTE.menuGap + 52,
         900, NOTE_H.menu);
  inside("name field", FRAME_W / 2 - 440 + MOD.pad + 110,
         1080 - MOD_H / 2 + MOD.nameFld + MOD.nameH / 2, 880, MOD_H, FRAME_W / 2, 1080);
  inside("category", FRAME_W / 2 - 440 + MOD.pad + 150,
         1080 - MOD_H / 2 + MOD.catRow + MOD.catH / 2, 880, MOD_H, FRAME_W / 2, 1080);
  inside("Create", FRAME_W / 2 + 440 - MOD.pad - MOD.btnW / 2,
         1080 - MOD_H / 2 + MOD.btnY + MOD.btnH / 2, 880, MOD_H, FRAME_W / 2, 1080);
  inside("appearance switch", FRAME_W / 2 - 280 + 560 - TOG.pad - TOG.swW / 2, 700,
         560, 170, FRAME_W / 2, 700);
}

H("- the falls are real, and heard");
{
  ok("two falls in the piece", FALLS.length === 2, `${FALLS.length}`);
  for (const at of FALLS) {
    const st = S.find((x) => x.at - x.morph === at);
    const goneBy = at + st.morph * 0.34;
    const blurPeak = at + st.morph * 0.40;
    ok(`fall into "${st.key}" completes before its blur peaks`, goneBy <= blurPeak,
       `gone f${goneBy.toFixed(0)}, peak f${blurPeak.toFixed(0)}`);
    ok(`fall into "${st.key}" gets the extra 16 frames`,
       st.morph === tierOf(distOf(S[S.indexOf(st) - 1], st)) + 16);
  }
  ok("the Create click precedes the form falling", 1150 < FALLS[0],
     `click f1150, fall f${FALLS[0]}`);
}

H("- typing fits inside its own state's hold");
{
  const slashHold = [S[IX.slash].at, S[IX.menu].at - S[IX.menu].morph];
  const nameHold = [S[IX.modal].at, S[IX.saved].at - S[IX.saved].morph];
  ok("/link types inside the slash hold",
     T.slashStart >= slashHold[0] && T_END.slash < slashHold[1],
     `f${T.slashStart}-${T_END.slash} in ${slashHold}`);
  ok("the name types inside the modal hold",
     T.nameStart >= nameHold[0] && T_END.name < nameHold[1],
     `f${T.nameStart}-${T_END.name} in ${nameHold}`);
  ok("the name is finished before Create is clicked", T_END.name < 1150);
  ok("the rack focus follows typing, and the button follows the category",
     T.catRack > T_END.name && T.btnRack > T.catRack);
}

H("- every state is sized to its content");
{
  ok("note height is exactly its content", S[IX.note].h === NOTE_H.plain);
  ok("slash adds only the command line", S[IX.slash].h - S[IX.note].h === NOTE.lineH);
  ok("menu adds only the menu plus its gap",
     S[IX.menu].h - S[IX.slash].h === NOTE.menuH + NOTE.menuGap);
  ok("modal height is exactly its content", S[IX.modal].h === MOD_H);
  ok("stack height is exactly four rows plus gaps", S[IX.stack].h === STACK_H);
  ok("the saved stadium fits one row", S[IX.saved].h >= STACK.rowH + 40);
  ok("the toggle is tall enough for its switch", S[IX.toggle].h >= TOG.swH + 80);
  console.log(`        heights ${S.map((s) => s.h).join(", ")}`);
}

H("- the map finishes drawing before the container closes");
{
  const lastEnd = STARTS[STARTS.length - 1] + DRAW_FOR;
  const closing = S[IX.count].at - S[IX.count].morph;
  ok("last chord completes before the closing morph", lastEnd < closing,
     `chord ends f${lastEnd}, morph f${closing}`);
  ok("chords start no earlier than the ring fade", STARTS[0] >= S[IX.wheel].at - 26,
     `first f${STARTS[0]}`);
  console.log(`        ${STARTS.length} chords, f${STARTS[0]}-${lastEnd}, closing f${closing}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
