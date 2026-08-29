import { ayahCount } from "./quran-meta";
/**
 * Shared Qurʾān target search.
 *
 * One search core behind /ayah, /link, Segment range editing and Connection
 * creation, so those never drift into four near-identical implementations
 * with four different ideas of what "2:255" means.
 *
 * Two tiers, chosen because they have very different costs:
 *
 *   Local, instant — references ("2:255", "٢:٢٥٥") and Surah names in Arabic,
 *   English or transliteration. There are only 114 chapters, so this is a
 *   trivial in-memory scan with no network and no debounce. It covers the
 *   most common lookups, which is why the field feels immediate.
 *
 *   Remote, debounced — verse TEXT search. There is no local corpus (verses
 *   come from api.quran.com), and shipping all 6,236 to the client to make
 *   every keystroke local would cost far more than it saves.
 */

import type { Chapter } from "./types";

// ── Arabic normalisation ────────────────────────────────────────────────────

/* Combining marks: fatha…sukun, superscript alef, and the Qurʾānic annotation
   range. Stripped so a query typed without tashkīl still matches fully
   vocalised Mushaf text — which is how people actually type. */
const DIACRITICS = /[ً-ٰٟۖ-ۭـ]/g;

/* Orthographic variants that readers treat as the same letter but that encode
   differently: the alef family, ya/alef-maqsura, ta-marbuta/ha, and the hamza
   carriers. Without folding these, searching "الرحمن" misses "ٱلرَّحۡمَٰن". */
const FOLD: Record<string, string> = {
  "آ": "ا", "أ": "ا", "إ": "ا", "ٱ": "ا", // آ أ إ ٱ → ا
  "ى": "ي",                                                             // ى → ي
  "ة": "ه",                                                             // ة → ه
  "ؤ": "و", "ئ": "ي",                                         // ؤ ئ
};

/** Arabic-Indic and extended digits → ASCII, so ٢:٢٥٥ parses like 2:255. */
const DIGITS: Record<string, string> = {
  "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
};

export function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => DIGITS[d] ?? d);
}

/** Fold Arabic to a comparable form: no diacritics, unified letter shapes. */
export function normalizeArabic(s: string): string {
  return s
    .replace(DIACRITICS, "")
    .replace(/[آأإٱىةؤئ]/g, (c) => FOLD[c] ?? c)
    .replace(/\s+/g, " ")
    .trim();
}

/** Latin folding: lowercase, strip accents and non-letters ("Al-Fātiĥah" → "alfatihah"). */
export function normalizeLatin(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** True when the string contains Arabic letters. */
export const isArabic = (s: string) => /[ء-يٱ]/.test(s);

// ── Reference parsing ───────────────────────────────────────────────────────

export interface ParsedRef { surah: number; ayah?: number }

/**
 * Parse a verse reference. Accepts "2:255", "2 255", "2.255", "٢:٢٥٥" and a
 * bare surah number. Returns null when the numbers are out of range rather
 * than a reference that cannot exist.
 */
export function parseReference(raw: string): ParsedRef | null {
  const q = normalizeDigits(raw).trim();
  const m = q.match(/^(\d{1,3})\s*[:.\-\s]\s*(\d{1,3})$/);
  if (m) {
    const surah = Number(m[1]), ayah = Number(m[2]);
    if (surah < 1 || surah > 114 || ayah < 1) return null;
    return { surah, ayah };
  }
  const only = q.match(/^(\d{1,3})$/);
  if (only) {
    const surah = Number(only[1]);
    if (surah < 1 || surah > 114) return null;
    return { surah };
  }
  return null;
}

// ── Chapter matching ────────────────────────────────────────────────────────

export interface ChapterHit { chapter: Chapter; score: number }

/**
 * Match a query against Surah names — Arabic, simple, complex and translated.
 * Score orders prefix matches above interior ones so typing "fat" puts
 * Al-Fatihah above the Surahs that merely contain those letters.
 */
export function searchChapters(query: string, chapters: Chapter[]): ChapterHit[] {
  const q = query.trim();
  if (!q) return [];
  const hits: ChapterHit[] = [];

  const qLatin  = normalizeLatin(q);
  const qArabic = normalizeArabic(q);
  const qNum    = Number(normalizeDigits(q));

  for (const c of chapters) {
    let score = 0;

    if (Number.isFinite(qNum) && qNum === c.id) score = Math.max(score, 100);

    if (qLatin) {
      for (const field of [c.name_simple, c.name_complex, c.translated_name?.name]) {
        if (!field) continue;
        const f = normalizeLatin(field);
        if (f === qLatin)            score = Math.max(score, 95);
        else if (f.startsWith(qLatin)) score = Math.max(score, 80);
        else if (f.includes(qLatin))   score = Math.max(score, 55);
      }
    }

    if (qArabic && isArabic(q)) {
      const a = normalizeArabic(c.name_arabic);
      // Surah names are commonly written with and without the article.
      const bare = a.replace(/^ال/, "");
      const qBare = qArabic.replace(/^ال/, "");
      if (a === qArabic || bare === qBare)          score = Math.max(score, 95);
      else if (a.startsWith(qArabic) || bare.startsWith(qBare)) score = Math.max(score, 80);
      else if (a.includes(qArabic))                 score = Math.max(score, 55);
    }

    if (score > 0) hits.push({ chapter: c, score });
  }

  return hits.sort((a, b) => b.score - a.score || a.chapter.id - b.chapter.id);
}

// ── Result shape shared by every consumer ───────────────────────────────────

export type TargetKind = "ayah" | "surah" | "selection";

export interface SearchTarget {
  kind:      TargetKind;
  /** Stable identity — "2:255" for an ayah, "2" for a surah, uuid for a selection. */
  id:        string;
  surah?:    number;
  ayah?:     number;
  /** Primary line: "Al-Baqarah 2:255" or a segment title. */
  label:     string;
  /** Arabic text where there is one. */
  arabic?:   string;
  /** Short translation or description preview. */
  preview?:  string;
}

export const verseKey = (surah: number, ayah: number) => `${surah}:${ayah}`;

// ── Recents ─────────────────────────────────────────────────────────────────

const RECENTS_KEY = "tl-quran-recents";
const RECENTS_MAX = 8;

export function readRecents(): SearchTarget[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as SearchTarget[]).slice(0, RECENTS_MAX) : [];
  } catch { return []; }
}

export function pushRecent(t: SearchTarget) {
  if (typeof window === "undefined") return;
  try {
    const prev = readRecents().filter((r) => !(r.kind === t.kind && r.id === t.id));
    localStorage.setItem(RECENTS_KEY, JSON.stringify([t, ...prev].slice(0, RECENTS_MAX)));
  } catch { /* storage unavailable — recents are a convenience, not state */ }
}

// ── Match highlighting ──────────────────────────────────────────────────────

/**
 * Locate the query inside a result so it can be marked. Comparison runs on the
 * NORMALISED forms while the offsets returned index the ORIGINAL string, so a
 * match found without tashkīl still highlights the fully vocalised text the
 * user sees. Returns null when the normalisation collapses the text (which
 * would make offsets meaningless) rather than highlighting the wrong span.
 */
export function findMatchRange(
  text: string, query: string,
): { start: number; end: number } | null {
  if (!text || !query) return null;
  const arabic = isArabic(query);

  // Map each ORIGINAL index to its position in the normalised string.
  const map: number[] = [];
  let norm = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const n = arabic
      ? ch.replace(DIACRITICS, "").replace(/[آأإٱىةؤئ]/g, (c) => FOLD[c] ?? c)
      : normalizeLatin(ch);
    if (n) { map.push(i); norm += n; }
  }
  const q = arabic ? normalizeArabic(query) : normalizeLatin(query);
  if (!q) return null;

  const at = norm.indexOf(q);
  if (at < 0 || at >= map.length) return null;
  const start = map[at];
  const endIdx = Math.min(at + q.length - 1, map.length - 1);
  return { start, end: map[endIdx] + 1 };
}

/**
 * Find a verse reference ANYWHERE in a sentence.
 *
 * `parseReference` deliberately requires the whole string to be a reference —
 * right for a search box where "18" means sūrah 18. But a question is a
 * sentence: "what does it say about 18:65?" contains a reference and is not
 * one, so that parser returns null and the reference is lost. Asking about a
 * specific verse is the commonest thing anyone does, and it was silently
 * finding nothing.
 *
 * Only surah:ayah is matched, never a bare number — "the 7 heavens" must not
 * become sūrah 7.
 */
export function findReference(text: string): ParsedRef | null {
  const q = normalizeDigits(text);
  // A clock time is the one common false positive: "12:30pm" and "meet at
  // 9:15" are not verses. Excluded by an am/pm suffix, and by a preceding
  // time word — 12:30 IS a valid verse reference, so it cannot be rejected on
  // its numbers alone.
  if (/\d{1,2}\s*:\s*\d{2}\s*(?:am|pm)/i.test(q)) return null;
  if (/(?:at|by|until|till|around|before|after)\s+\d{1,2}\s*:\s*\d{2}/i.test(q)) return null;

  const m = q.match(/(?:^|[^\d])(\d{1,3})\s*:\s*(\d{1,3})(?![\d:])/);
  if (!m) return null;

  const surah = Number(m[1]), ayah = Number(m[2]);
  if (surah < 1 || surah > 114) return null;
  if (ayah < 1 || ayah > ayahCount(surah)) return null;   // 2:900 is not a verse
  return { surah, ayah };
}
