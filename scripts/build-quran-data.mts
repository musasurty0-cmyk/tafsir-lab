/**
 * Build the Qurʾān word data the Arabic tools read, into public/data:
 *
 *   quran-word-index.json   every word keyed vowels and all and grouped by
 *                           meaning (lib/arabic/quran-match), with its root,
 *                           dictionary form, count and up to four places
 *   quran-roots.json        each root's words: dictionary form, count, part
 *                           of speech, verb form, meaning, and the forms it
 *                           takes in the Qurʾān with how often
 *   morph/<sūrah>.json      each word's root, dictionary form, grammar tags
 *                           and word-by-word meaning, by āyah
 *
 *   npx tsx scripts/build-quran-data.mts
 *
 * Sources:
 *   - api.quran.com v4: each word's imlāʾī spelling (what a modern course
 *     card is spelt in) and its word-by-word English.
 *   - Quranic Arabic Corpus v0.4 morphology (corpus.quran.com, GNU GPL), via
 *     github.com/mustafa0x/quran-morphology: root, dictionary form and tags
 *     for every segment. Used unaltered and credited where it is shown.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { wordKey, meaningWords } from "../lib/arabic/quran-match";

const BASE = "https://api.quran.com/api/v4";
const CORPUS = "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt";
const PLACES = 4;
const FORMS = 4;
const LEMMAS = 40;

interface Word { position: number; char_type_name: string; text_imlaei?: string; translation?: { text?: string } }
interface Verse { verse_key: string; words: Word[] }

async function chapter(n: number): Promise<Verse[]> {
  const out: Verse[] = [];
  for (let page = 1; ; page++) {
    const url = `${BASE}/verses/by_chapter/${n}?language=en&words=true&word_fields=text_imlaei&per_page=50&page=${page}`;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json() as { verses: Verse[]; pagination: { next_page: number | null } };
        out.push(...data.verses);
        if (!data.pagination.next_page) return out;
        break;
      }
      if (attempt >= 4) throw new Error(`chapter ${n} page ${page}: ${res.status}`);
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

// ── The corpus: one entry per word, built from its segments ───────────────

/** `form` is the word as written without its prefixes: stem and suffixes,
    so قَالُوا keeps its ending and وَقَالَ is counted as قَالَ. */
interface Morph { root: string; lemma: string; pos: string; tags: string; form: string; prefixed: boolean; suffixed: boolean }

const corpusText = await (await fetch(CORPUS)).text();
const morph = new Map<string, Morph>();          // "s:a:w" → the word's stem
const prefixTags = new Map<string, string[]>();  // "s:a:w" → DET etc. from prefixes
for (const line of corpusText.split("\n")) {
  const [loc, form, pos, feats] = line.split("\t");
  if (!loc || !feats) continue;
  const [s, a, w] = loc.split(":");
  const key = `${s}:${a}:${w}`;
  const f = feats.split("|");
  if (f.includes("PREF")) {
    prefixTags.set(key, [...(prefixTags.get(key) ?? []), ...(f.includes("DET") ? ["DET"] : []), "PREFIXED"]);
    continue;
  }
  const have = morph.get(key);
  if (f.includes("SUFF")) {
    if (have) { have.form += form; if (f.includes("PRON")) have.suffixed = true; }
    continue;
  }
  const root = f.find((x) => x.startsWith("ROOT:"))?.slice(5) ?? "";
  const lemma = f.find((x) => x.startsWith("LEM:"))?.slice(4) ?? "";
  const tags = f.filter((x) => !x.startsWith("ROOT:") && !x.startsWith("LEM:")).join("|");
  if (!have) morph.set(key, { root, lemma, pos, tags, form, prefixed: false, suffixed: false });
  else have.form += form; // a second stem segment, rare
}
for (const [k, extra] of prefixTags) {
  const m = morph.get(k);
  if (!m) continue;
  m.prefixed = extra.includes("PREFIXED");
  m.tags = [m.tags, ...extra.filter((x) => x !== "PREFIXED")].filter(Boolean).join("|");
}
console.log(`corpus: ${morph.size} words`);

// ── Walk the Qurʾān ───────────────────────────────────────────────────────

type Group = { count: number; places: { at: string; len: number }[]; lemmas: Map<string, number> };
const index = new Map<string, Map<string, Group>>();
const bySurah = new Map<number, Record<string, (string)[][]>>();

interface LemmaStats {
  root: string; pos: string; vf: string; count: number;
  /** Meanings of the bare word only, so "mercy" rather than "and mercy". */
  glosses: Map<string, number>; anyGloss: Map<string, number>;
  forms: Map<string, { n: number; at: string; gloss: Map<string, number> }>;
}
const lemmas = new Map<string, LemmaStats>();
const rootCount = new Map<string, number>();
let words = 0;

const bump = <K,>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);
const gloss = (t: string) => t.replace(/\(\d+\)/g, "").trim();

for (let n = 1; n <= 114; n++) {
  const verses = await chapter(n);
  const surah: Record<string, string[][]> = {};
  for (const v of verses) {
    const ayah = v.verse_key.split(":")[1];
    const ws = v.words.filter((w) => w.char_type_name === "word");
    surah[ayah] = [];
    for (const w of ws) {
      words++;
      const at = `${v.verse_key}:${w.position}`;
      const m = morph.get(at);
      const meaning = gloss(w.translation?.text ?? "");
      surah[ayah].push(m ? [m.root, m.lemma, m.pos, m.tags, meaning] : ["", "", "", "", meaning]);

      if (m?.lemma) {
        const L = lemmas.get(m.lemma) ?? {
          root: m.root, pos: m.pos, vf: m.tags.match(/VF:(\d+)/)?.[1] ?? "",
          count: 0, glosses: new Map(), anyGloss: new Map(), forms: new Map(),
        };
        L.count++;
        if (meaning) {
          bump(L.anyGloss, meaning.toLowerCase());
          if (!m.prefixed && !m.suffixed) bump(L.glosses, meaning.toLowerCase());
        }
        const f = L.forms.get(m.form) ?? { n: 0, at, gloss: new Map<string, number>() };
        f.n++;
        if (meaning && !m.prefixed) bump(f.gloss, meaning);
        else if (meaning && f.gloss.size === 0) bump(f.gloss, meaning);
        L.forms.set(m.form, f);
        lemmas.set(m.lemma, L);
        if (m.root) bump(rootCount, m.root);
      }

      const key = wordKey(w.text_imlaei ?? "");
      if (!key) continue;
      const mean = [...new Set(meaningWords(meaning))].sort().join(" ") || "-";
      const byMeaning = index.get(key) ?? new Map<string, Group>();
      const g = byMeaning.get(mean) ?? { count: 0, places: [], lemmas: new Map() };
      g.count++;
      g.places.push({ at, len: ws.length });
      if (m?.lemma) bump(g.lemmas, `${m.root}|${m.lemma}`);
      if (g.places.length > PLACES * 3) {
        g.places.sort((a, b) => a.len - b.len);
        g.places.length = PLACES;
      }
      byMeaning.set(mean, g);
      index.set(key, byMeaning);
    }
  }
  bySurah.set(n, surah);
  process.stdout.write(`\r${n}/114`);
}

const top = <K,>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

// ── Write ─────────────────────────────────────────────────────────────────

mkdirSync("public/data/morph", { recursive: true });

const idx: Record<string, (number | (string | number)[])[]> = {};
for (const [k, byMeaning] of [...index.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  let total = 0;
  const groups: (string | number)[][] = [];
  for (const [mean, g] of [...byMeaning.entries()].sort((a, b) => b[1].count - a[1].count)) {
    total += g.count;
    g.places.sort((a, b) => a.len - b.len);
    const [root = "", lemma = ""] = (top(g.lemmas) ?? "|").split("|");
    groups.push([mean, g.count, root, lemma, ...g.places.slice(0, PLACES).map((p) => p.at)]);
  }
  idx[k] = [total, ...groups];
}
writeFileSync("public/data/quran-word-index.json", JSON.stringify({ v: 3, words, idx }));

const roots: Record<string, (number | (string | number | (string | number)[])[])[]> = {};
const byRoot = new Map<string, [string, LemmaStats][]>();
for (const [lemma, L] of lemmas) if (L.root) byRoot.set(L.root, [...(byRoot.get(L.root) ?? []), [lemma, L]]);
for (const [root, ls] of [...byRoot.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  roots[root] = [
    rootCount.get(root) ?? 0,
    ...ls.sort((a, b) => b[1].count - a[1].count).slice(0, LEMMAS).map(([lemma, L]) => [
      lemma, L.count, L.pos, L.vf, top(L.glosses) ?? top(L.anyGloss) ?? "",
      ...[...L.forms.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, FORMS)
        .map(([stem, f]) => [stem, f.n, top(f.gloss) ?? "", f.at]),
    ]),
  ];
}
writeFileSync("public/data/quran-roots.json", JSON.stringify({ v: 1, roots }));

for (const [n, surah] of bySurah) writeFileSync(`public/data/morph/${n}.json`, JSON.stringify({ v: 1, a: surah }));

console.log(`\n${words} words · ${Object.keys(idx).length} keys · ${Object.keys(roots).length} roots · ${lemmas.size} lemmas`);
