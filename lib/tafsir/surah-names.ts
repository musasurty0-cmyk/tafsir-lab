/**
 * Finding the sūrah someone named, when they did not give you numbers.
 *
 * Retrieval already understood "61:4". It did not understand "Surah saf main
 * maqsad", which is how a reader actually asks — and because nothing resolved
 * the name, the search was never scoped. A transliterated Urdu question then
 * went out across all 90,092 passages and came back with al-Baqarah on poetry
 * and an-Naḥl on mules, and the assistant correctly reported that none of it
 * answered the question. The retrieval failed; the honesty worked.
 *
 * Scoping to the sūrah someone named turns that into commentary on the sūrah
 * they meant.
 *
 * Server-side only: the names live in `data/surah-info-en.json`, which is
 * 0.9 MB of commentary HTML and has no business in a browser bundle. Read
 * once, cached for the life of the process.
 *
 * The matching is deliberately cautious. Three of the names normalise to three
 * letters — Nās, Fīl, ʿAṣr, Qāf — and a rule loose enough to catch those in
 * running prose would scope half the questions in the app to the wrong sūrah.
 * So a short name only counts when the word "surah" introduces it, and a bare
 * name is only accepted when it is long enough to be unmistakable.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

/** Below this, a name is only trusted when "surah" precedes it. */
const UNAMBIGUOUS_LEN = 5;

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")   // drop diacritics
    .replace(/[^a-z0-9]/g, "");                          // and everything else
}

/**
 * Arabic assimilates the definite article to the following sun letter, so the
 * same sūrah is written Al-, As-, Ash-, An-, Ar-, At-, Az-, Ad-. Readers drop
 * it entirely as often as not: "surah saf" for As-Saff.
 */
function withoutArticle(normalized: string): string | null {
  const m = normalized.match(/^(?:ash|ath|adh|al|as|an|ar|at|az|ad)(.+)$/);
  return m && m[1].length >= 2 ? m[1] : null;
}

interface Row { surah_number: number; surah_name: string }

let cache: Promise<Map<string, number>> | null = null;

function load(): Promise<Map<string, number>> {
  cache ??= (async () => {
    const raw = await readFile(
      path.join(process.cwd(), "data", "surah-info-en.json"), "utf8",
    );
    const parsed = JSON.parse(raw) as Row[] | Record<string, Row>;
    const rows = Array.isArray(parsed) ? parsed : Object.values(parsed);

    /* Keys that two different sūrahs would claim are dropped rather than
       resolved arbitrarily — guessing between them is worse than not
       scoping at all, because a wrong scope returns confident nonsense. */
    const seen = new Map<string, number | null>();
    const claim = (key: string, n: number) => {
      if (!key) return;
      const prior = seen.get(key);
      if (prior === undefined) seen.set(key, n);
      else if (prior !== n) seen.set(key, null);
    };

    for (const r of rows) {
      if (!r?.surah_name || !r.surah_number) continue;
      const full = normalize(r.surah_name);
      claim(full, r.surah_number);
      const bare = withoutArticle(full);
      if (bare) claim(bare, r.surah_number);
    }

    const out = new Map<string, number>();
    for (const [k, v] of seen) if (v !== null) out.set(k, v);
    return out;
  })();
  return cache;
}

/**
 * The sūrah a question names, or null.
 *
 * Tries, in order: an explicit "surah <n>", a name introduced by the word
 * surah, then any sufficiently distinctive name appearing on its own.
 */
export async function findSurahInText(text: string): Promise<number | null> {
  if (!text) return null;
  const names = await load();

  /* "surah 61", "chapter 2". The number is trusted outright — nobody writes
     it by accident next to that word. */
  const numbered = text.match(/\b(?:s(?:u|ū)rahs?|s(?:u|ū)rat|sura|chapter)\s*[.:#]?\s*(\d{1,3})\b/i);
  if (numbered) {
    const n = Number(numbered[1]);
    if (n >= 1 && n <= 114) return n;
  }

  /* "surah saf", "sūrat al-baqarah". Introduced by the word, so even a short
     name is safe here. Hyphenated names arrive as one token. */
  const named = text.match(/\b(?:s(?:u|ū)rahs?|s(?:u|ū)rat|sura|chapter)\s+([\p{L}][\p{L}'’ʿʾ-]{1,24})/iu);
  if (named) {
    const key = normalize(named[1]);
    const hit = names.get(key) ?? (withoutArticle(key) ? names.get(withoutArticle(key)!) : undefined);
    if (hit) return hit;
  }

  /* No introducing word: "what is al-baqarah about". Only names long enough
     to mean nothing else, so "the people" never resolves to an-Nās. */
  for (const token of text.match(/[\p{L}][\p{L}'’ʿʾ-]{3,24}/gu) ?? []) {
    const key = normalize(token);
    if (key.length < UNAMBIGUOUS_LEN) continue;
    const hit = names.get(key);
    if (hit) return hit;
    const bare = withoutArticle(key);
    if (bare && bare.length >= UNAMBIGUOUS_LEN) {
      const b = names.get(bare);
      if (b) return b;
    }
  }

  return null;
}
