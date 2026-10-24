/**
 * Audit the muṣḥaf, page by page, as the app draws it.
 *
 *   npx tsx scripts/audit-mushaf.mts [cacheDir]
 *
 * Fetches every page the way /api/quran/page does and every surah the way
 * lib/quran-api does (cached in cacheDir, default .cache/mushaf-audit), builds
 * each surah's view of each of its pages with the SAME assembleMushafPage the
 * route uses, and checks it against the ground truth: every word's own
 * v2_page and line_number. For every page view:
 *
 *   - every line holds glyphs of that page only, so each is drawn in its own font;
 *   - every word has glyph codes;
 *   - reading order runs unbroken across the page (surah, āyah, word);
 *   - no word of that surah on that page is missing.
 *
 * And over the whole muṣḥaf: all 6,236 āyāt present, every word shown on
 * exactly one page, no page in a surah's list that comes up empty.
 * Exits 1 if anything fails. Written after Al-Māʾidah 88–90 rendered jumbled.
 *
 * It also writes cacheDir/assembled.json (every page as the route serves it)
 * for scripts/audit-mushaf-widths.py, which measures each line in its own font.
 */

import fs from "node:fs";
import path from "node:path";
import { assembleMushafPage } from "../lib/mushaf-page";
import { ayahCount } from "../lib/quran-meta";
import type { QCFVerse } from "../lib/types";

const dir = process.argv[2] ?? path.join(".cache", "mushaf-audit");
const Q = "https://api.quran.com/api/v4";
fs.mkdirSync(path.join(dir, "pages"), { recursive: true });
fs.mkdirSync(path.join(dir, "chap"), { recursive: true });

async function cached(url: string, file: string) {
  if (!fs.existsSync(file)) {
    for (let i = 0; ; i++) {
      const r = await fetch(url).catch(() => null);
      if (r?.ok) { fs.writeFileSync(file, await r.text()); break; }
      if (i === 4) throw new Error(`failed: ${url}`);
      await new Promise((res) => setTimeout(res, 800 * (i + 1)));
    }
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// Same parameters as app/api/quran/page and lib/quran-api (plus the v2 word
// fields on chapters, so the ground truth covers every word twice over).
const pageUrl = (p: number) => `${Q}/verses/by_page/${p}?` + new URLSearchParams({
  language: "en", words: "true", translations: "20",
  word_fields: "code_v2,text_qpc_hafs,v2_page,line_number", per_page: "50", page: "1" });
const chapUrl = (c: number) => `${Q}/verses/by_chapter/${c}?` + new URLSearchParams({
  language: "en", words: "true", fields: "text_uthmani,page_number",
  word_fields: "code_v2,v2_page,line_number", per_page: "286", page: "1" });

type Word = QCFVerse["words"][number] & { line_number: number };
type Resp = { verses: (QCFVerse & { words: Word[] })[] };

const pages: Resp[] = [], chaps: Resp[] = [];
const jobs: (() => Promise<void>)[] = [];
for (let p = 1; p <= 604; p++) jobs.push(async () => { pages[p] = await cached(pageUrl(p), path.join(dir, "pages", `${p}.json`)); });
for (let c = 1; c <= 114; c++) jobs.push(async () => { chaps[c] = await cached(chapUrl(c), path.join(dir, "chap", `${c}.json`)); });
let next = 0;
await Promise.all(Array.from({ length: 10 }, async () => { while (next < jobs.length) await jobs[next++](); }));

// ── Ground truth ──
const truth = new Map<number, Word & { vk: string }>();
for (const r of [...pages.slice(1), ...chaps.slice(1)]) for (const v of r.verses) for (const w of v.words) truth.set(w.id, { ...w, vk: v.verse_key });

const issues: string[] = [];
const vks = new Set([...truth.values()].map((w) => w.vk));
for (let c = 1; c <= 114; c++) {
  if (chaps[c].verses.length !== ayahCount(c)) issues.push(`surah ${c}: ${chaps[c].verses.length}/${ayahCount(c)} āyāt from the chapter endpoint`);
  for (let a = 1; a <= ayahCount(c); a++) if (!vks.has(`${c}:${a}`)) issues.push(`${c}:${a} missing entirely`);
}

// ── Every page as the route serves it, for the width audit ──
const assembled: Record<number, { line: number; vk: string; pos: number; code: string }[]> = {};
for (let p = 1; p <= 604; p++) {
  const around = [p - 1, p, p + 1].filter((q) => q >= 1 && q <= 604).map((q) => pages[q]);
  assembled[p] = assembleMushafPage(p, around).flatMap((v) =>
    (v.words as Word[]).map((w) => ({ line: w.line_number, vk: v.verse_key, pos: w.position, code: w.code_v2 })));
}
fs.writeFileSync(path.join(dir, "assembled.json"), JSON.stringify(assembled));

// ── Every surah's view of every page in its list ──
const order = (vk: string, pos: number) => { const [s, a] = vk.split(":").map(Number); return s * 1e7 + a * 1e3 + pos; };
const shown = new Map<number, number>();
let views = 0;
for (let c = 1; c <= 114; c++) {
  const list = [...new Set(chaps[c].verses.map((v) => v.page_number))].sort((a, b) => a - b);
  for (const p of list) {
    views++;
    const around = [p - 1, p, p + 1].filter((q) => q >= 1 && q <= 604).map((q) => pages[q]);
    const vs = assembleMushafPage(p, around).filter((v) => v.verse_key.startsWith(`${c}:`));
    const at = `${c} p${p}`;
    if (!vs.length) { issues.push(`${at}: in the page list but empty`); continue; }
    const lines = new Map<number, { k: number; w: Word }[]>();
    for (const v of vs) for (const w of v.words as Word[]) {
      shown.set(w.id, (shown.get(w.id) ?? 0) + 1);
      if (!lines.has(w.line_number)) lines.set(w.line_number, []);
      lines.get(w.line_number)!.push({ k: order(v.verse_key, w.position), w });
    }
    let last = -1;
    for (const [ln, ws] of [...lines].sort(([a], [b]) => a - b)) {
      if (ln < 1 || ln > 15) issues.push(`${at}: line ${ln} outside 1–15`);
      if (ws.some((x) => x.w.v2_page !== p)) issues.push(`${at} line ${ln}: glyphs from another page`);
      if (ws.some((x) => !x.w.code_v2)) issues.push(`${at} line ${ln}: a word without glyphs`);
      for (const x of ws) { if (x.k <= last) { issues.push(`${at} line ${ln}: out of reading order`); break; } last = x.k; }
    }
    const got = new Set(vs.flatMap((v) => v.words.map((w) => w.id)));
    const miss = [...truth.values()].filter((w) => w.v2_page === p && w.vk.startsWith(`${c}:`) && !got.has(w.id));
    if (miss.length) issues.push(`${at}: ${miss.length} words missing (${[...new Set(miss.map((w) => w.vk))].join(", ")})`);
  }
}
const never = [...truth.values()].filter((w) => !shown.has(w.id));
const twice = [...shown.values()].filter((n) => n > 1).length;
if (never.length) issues.push(`${never.length} words never shown (${[...new Set(never.map((w) => w.vk))].slice(0, 10).join(", ")}…)`);
if (twice) issues.push(`${twice} words shown on more than one page`);

console.log(`${views} page views · ${truth.size} words (${[...truth.values()].filter((w) => w.char_type_name === "end").length} āyah markers) · ${shown.size} shown`);
if (issues.length) { console.log(`${issues.length} problems:\n  ` + issues.slice(0, 60).join("\n  ")); process.exit(1); }
console.log("All pages correct: every line one page's glyphs, in order, nothing missing or repeated.");
