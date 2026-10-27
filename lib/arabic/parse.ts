/**
 * Arabic study decks: turning a course's flashcard files into lessons.
 *
 * Pure, so the browser (preview before import) and the server (the import
 * itself) run the same rules and are tested without either.
 *
 * The shape this reads, one file per lesson:
 *
 *   English/Level 1/Lesson 12 - Verbs in the Classroom.txt
 *
 *   "ear (f)","هَذِهِ أُذُنٌ (hādhihi udhun)"
 *   "to write – past","كَتَبَ (kataba)"
 *                                            ← a blank line starts a new group
 *   "The teacher wrote…","كَتَبَ الْمُدَرِّسُ… (kataba al-mudarrisu…)"
 *
 * Course content is never part of this repository — it is public. Decks
 * arrive through the importer and live in the reader's own workspace.
 */

export interface ParsedCard {
  english:    string;
  arabic:     string;
  translit:   string | null;
  /** From a trailing "(m)" or "(f)" on the English side. */
  gender:     "m" | "f" | null;
  /** Blank lines in the file split a lesson into groups. */
  group:      number;
  isSentence: boolean;
}

export type LessonKind = "lesson" | "revision" | "prep";

export interface ParsedLesson {
  level:  number;
  /** The number in the file name. Not the course's lesson number. */
  fileNo: number;
  title:  string;
  kind:   LessonKind;
  cards:  ParsedCard[];
}

export interface NumberedLesson extends ParsedLesson {
  /** The course's own lesson number. Null for revision and preparation. */
  number: number | null;
}

// ── Limits — the importer is fed whatever a person drops on it ────────────

export const MAX_LESSONS  = 400;
export const MAX_CARDS    = 20_000;
export const MAX_FIELD    = 600;
export const MAX_TITLE    = 160;

// ── File paths ────────────────────────────────────────────────────────────

/**
 * Level and lesson from a path such as "English/Level 2/Lesson 3 - Title.txt".
 * The level comes from the nearest "Level N" folder; a lone file with no
 * folder falls back to `fallbackLevel`. Null when the name is not a lesson.
 */
export function parseLessonPath(
  path: string,
  fallbackLevel: number | null = null,
): { level: number; fileNo: number; title: string } | null {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  const file = parts[parts.length - 1] ?? "";
  if (!/\.txt$/i.test(file)) return null;

  const m = /^lesson\s*(\d{1,3})\s*[-–—:.]?\s*(.*?)\s*\.txt$/i.exec(file);
  if (!m) return null;

  let level: number | null = null;
  for (let i = parts.length - 2; i >= 0; i--) {
    const lm = /^level\s*(\d{1,2})$/i.exec(parts[i].trim());
    if (lm) { level = Number(lm[1]); break; }
  }
  level ??= fallbackLevel;
  if (level == null || level < 1 || level > 99) return null;

  return { level, fileNo: Number(m[1]), title: cleanTitle(m[2]) };
}

/**
 * Tidy a lesson title taken from a file name. The fixes are the ones the
 * course's own files need, kept narrow: German left in one title, a misspelt
 * "story", a run-together "each other", and "(English)" on titles in a
 * folder that is already called English.
 */
export function cleanTitle(raw: string): string {
  // File names cannot hold ʿ or ʾ, so the course wrote _ in their place.
  let t = raw.replace(/_/g, "’").replace(/\s+/g, " ").trim();
  t = t.replace(/\s*\(english\)\s*$/i, "");
  t = t.replace(/\bund\b/g, "and");
  t = t.replace(/\bStorey\b/g, "Story").replace(/\bstorey\b/g, "story");
  t = t.replace(/\beachother\b/gi, (w) => (w[0] === "E" ? "Each other" : "each other"));
  return t.slice(0, MAX_TITLE) || "Untitled lesson";
}

/** A file that revises or prepares rather than teaching something new. */
export function lessonKind(fileNo: number, title: string): LessonKind {
  if (/^revis/i.test(title)) return "revision";
  if (fileNo === 0 || /\bpreparation\b/i.test(title)) return "prep";
  return "lesson";
}

// ── Cards ─────────────────────────────────────────────────────────────────

/** One CSV row of two quoted fields. Doubled quotes inside a field are a quote. */
export function parseCsvPair(line: string): [string, string] | null {
  const fields: string[] = [];
  let i = 0;
  const s = line.trim();
  while (i < s.length) {
    if (s[i] === ",") { i++; continue; }
    if (s[i] !== '"') {
      // Unquoted field: up to the next comma.
      const end = s.indexOf(",", i);
      fields.push(s.slice(i, end < 0 ? s.length : end).trim());
      i = end < 0 ? s.length : end + 1;
      continue;
    }
    let v = "";
    i++;
    while (i < s.length) {
      if (s[i] === '"') {
        if (s[i + 1] === '"') { v += '"'; i += 2; continue; }
        i++;
        break;
      }
      v += s[i++];
    }
    fields.push(v);
  }
  return fields.length === 2 && fields[0] && fields[1] ? [fields[0], fields[1]] : null;
}

/** "هَذَا أَنْفٌ (hādhā anf)" → the Arabic and the transliteration in brackets. */
export function splitArabic(field: string): { arabic: string; translit: string | null } {
  /* The numbers lesson puts the numeral after the brackets — "صِفْرٌ (ṣifr) ٠" —
     so a trailing run of digits stays with the Arabic. */
  const m = /^(.*\S)\s*\(([^()]*[A-Za-zāīūḥṣḍṭẓʿʾ][^()]*)\)\s*([٠-٩0-9]*)\s*$/.exec(field.trim());
  if (m && /[؀-ۿ]/.test(m[1])) {
    return { arabic: `${m[1].trim()} ${m[3]}`.trim(), translit: m[2].trim() };
  }
  return { arabic: field.trim(), translit: null };
}

/** An Arabic letter or an Arabic-Indic digit — the numbers lesson's cards are just "١". */
export const HAS_ARABIC = /[ء-ي٠-٩]/;

function splitGender(english: string): { english: string; gender: "m" | "f" | null } {
  const m = /^(.*?)\s*\((m|f)\)\s*$/i.exec(english);
  return m ? { english: m[1].trim(), gender: m[2].toLowerCase() as "m" | "f" } : { english: english.trim(), gender: null };
}

/** More than a few words, or punctuated like one: a sentence to read, not a word to learn. */
function looksLikeSentence(arabic: string, english: string): boolean {
  const words = arabic.split(/\s+/).filter(Boolean).length;
  return words > 3 || /[.?!؟]$/.test(english.trim()) || /[.؟!]\s*$/.test(arabic);
}

export function parseDeck(text: string): ParsedCard[] {
  const cards: ParsedCard[] = [];
  let group = 0;
  let sawCardInGroup = false;
  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    if (!raw.trim()) {
      if (sawCardInGroup) { group++; sawCardInGroup = false; }
      continue;
    }
    const pair = parseCsvPair(raw);
    if (!pair) continue;
    const { english, gender } = splitGender(pair[0]);
    const { arabic, translit } = splitArabic(pair[1]);
    // A "Front","Back" header row, or anything without Arabic on the Arabic side.
    if (!english || !HAS_ARABIC.test(arabic)) continue;
    cards.push({
      english:    english.slice(0, MAX_FIELD),
      arabic:     arabic.slice(0, MAX_FIELD),
      translit:   translit ? translit.slice(0, MAX_FIELD) : null,
      gender,
      group,
      isSentence: looksLikeSentence(arabic, english),
    });
    sawCardInGroup = true;
  }
  return cards;
}

// ── Numbering ─────────────────────────────────────────────────────────────

/**
 * The course's lesson numbers. Revision and preparation files sit in the
 * sequence where they fall but do not take a number, so a level whose files
 * run 0–28 and include three such files numbers its teaching lessons 1–26.
 */
export function numberLessons<T extends ParsedLesson>(lessons: T[]): (T & { number: number | null })[] {
  const sorted = [...lessons].sort((a, b) => a.level - b.level || a.fileNo - b.fileNo);
  const next = new Map<number, number>();
  return sorted.map((l) => {
    if (l.kind !== "lesson") return { ...l, number: null };
    const n = (next.get(l.level) ?? 0) + 1;
    next.set(l.level, n);
    return { ...l, number: n };
  });
}

// ── Search ────────────────────────────────────────────────────────────────

/**
 * Arabic folded for matching: no ḥarakāt, no tatweel, one alif, ى as ي and
 * ة as ه. So ركبة finds رُكْبَةٌ, and أذن finds أُذُنٌ.
 */
export function foldArabic(s: string): string {
  return s
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

/** The course's five stages, by level. Levels past the last stage still show. */
export const STAGES: { title: string; from: number; to: number }[] = [
  { title: "Foundational reading",                       from: 1,  to: 2  },
  { title: "Introducing grammar",                        from: 3,  to: 4  },
  { title: "Grammar and beyond",                         from: 5,  to: 8  },
  { title: "Classical grammar",                          from: 9,  to: 11 },
  { title: "Conversation, revision and application",     from: 12, to: 15 },
];
