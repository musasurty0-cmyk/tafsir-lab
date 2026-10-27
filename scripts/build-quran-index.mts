/**
 * Build public/data/quran-word-index.json: every word of the Qurʾān, keyed
 * vowels and all and grouped by meaning (see lib/arabic/quran-match), with
 * how often it occurs and up to four places per meaning, shortest āyāt first — the In Context and Āyah Cloze drills show
 * one of those āyāt.
 *
 *   npx tsx scripts/build-quran-index.mts
 *
 * Source: api.quran.com v4, the imlāʾī (plain) spelling of each word, which
 * is what a modern course card is spelt in.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { wordKey, meaningWords } from "../lib/arabic/quran-match";

const BASE = "https://api.quran.com/api/v4";
const PLACES = 4;

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

/* key → meaning → occurrences. A word is grouped by what it means in each
   place (quran.com's word-by-word English, reduced to its content words), so
   a lookup can keep only the places that mean what the card means. */
type Group = { count: number; places: { at: string; len: number }[] };
const hits = new Map<string, Map<string, Group>>();
let words = 0;

for (let n = 1; n <= 114; n++) {
  const verses = await chapter(n);
  for (const v of verses) {
    const ws = v.words.filter((w) => w.char_type_name === "word");
    for (const w of ws) {
      words++;
      const key = wordKey(w.text_imlaei ?? "");
      if (!key) continue;
      const meaning = [...new Set(meaningWords(w.translation?.text ?? ""))].sort().join(" ") || "-";
      const byMeaning = hits.get(key) ?? new Map<string, Group>();
      const g = byMeaning.get(meaning) ?? { count: 0, places: [] };
      g.count++;
      g.places.push({ at: `${v.verse_key}:${w.position}`, len: ws.length });
      // Keep only the shortest few, so the file stays small.
      if (g.places.length > PLACES * 3) {
        g.places.sort((a, b) => a.len - b.len);
        g.places.length = PLACES;
      }
      byMeaning.set(meaning, g);
      hits.set(key, byMeaning);
    }
  }
  process.stdout.write(`\r${n}/114`);
}

const idx: Record<string, (number | (string | number)[])[]> = {};
for (const [k, byMeaning] of [...hits.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  let total = 0;
  const groups: (string | number)[][] = [];
  for (const [meaning, g] of [...byMeaning.entries()].sort((a, b) => b[1].count - a[1].count)) {
    total += g.count;
    g.places.sort((a, b) => a.len - b.len);
    groups.push([meaning, g.count, ...g.places.slice(0, PLACES).map((p) => p.at)]);
  }
  idx[k] = [total, ...groups];
}

mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/quran-word-index.json", JSON.stringify({ v: 2, words, idx }));
console.log(`\n${words} words, ${Object.keys(idx).length} keys`);
