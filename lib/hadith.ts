/**
 * al-Arbaʿūn an-Nawawiyya — the collection, as data.
 *
 * The Qurʾān side of this app fetches from api.quran.com; there is no
 * equivalent service for Nawawi's forty that is worth depending on at request
 * time, and this text never changes, so it is vendored into the repository
 * instead (`data/nawawi-40.json`) and read once at module load.
 *
 * THE TEXT IS VENDORED VERBATIM, NOT GENERATED. That is the whole reason this
 * file exists rather than a prompt: a model asked to produce hadith from
 * memory will produce something that reads correctly and is wrong in the
 * wording, and wrong wording in a prophetic narration is not a cosmetic bug.
 * The Arabic and the English both come from a published edition, recorded in
 * `source` inside the data file. The short English titles are ours — they are
 * navigation labels, not translation.
 *
 * Forty-two, not forty: the collection is called "the Forty" and an-Nawawi
 * included forty-two. Everything here counts the real number, so nothing has
 * to special-case the last two.
 */

import raw from "@/data/nawawi-40.json";

export interface Hadith {
  /** 1–42, and the key everything else uses. */
  number: number;
  /** A short English label for grids and breadcrumbs. Ours, not the source's. */
  title: string;
  /** The narration in Arabic, verbatim. */
  arabic: string;
  /** The published English translation, verbatim. */
  english: string;
  /** Where the narration is collected, e.g. "Bukhari & Muslim". */
  reference: string | null;
  grades: string[];
}

interface HadithDoc {
  collection: string;
  collectionEnglish: string;
  count: number;
  note: string;
  source: { name: string; editions: string[]; url: string; retrieved: string };
  hadiths: Hadith[];
}

const doc = raw as unknown as HadithDoc;

/* Defensive, and not theoretical: the source edition carries `reference` as
   an OBJECT ({book, hadith} — the position inside this collection, which is
   not a takhrīj and not worth showing). Rendering it landed an object in JSX
   and took the whole page down with React error #31. Anything that is not a
   usable string is normalised away here, at the boundary, so no component can
   be handed a shape it will try to render. */
for (const h of doc.hadiths) {
  if (typeof h.reference !== "string" || !h.reference.trim()) h.reference = null;
}

/** Arabic name of the collection, for headings. */
export const COLLECTION_ARABIC = doc.collection;
/** English name, for everywhere a Latin script reads better. */
export const COLLECTION_ENGLISH = doc.collectionEnglish;
/** 42. Use this rather than writing 40 anywhere. */
export const HADITH_COUNT = doc.hadiths.length;

/** Every hadith, in order. */
export const HADITHS: Hadith[] = doc.hadiths;

/** One hadith by its number, or null when the number is out of range. */
export function getHadith(n: number): Hadith | null {
  if (!Number.isInteger(n) || n < 1 || n > HADITH_COUNT) return null;
  return HADITHS[n - 1] ?? null;
}

/** Is this a number the collection actually has? */
export function isHadithNumber(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= HADITH_COUNT;
}

/**
 * The opening words, for a card that has one line to say what this is.
 *
 * Cut on a word boundary and only from the English: the Arabic is right to
 * left and a truncated narration reads as a misquotation, which is exactly
 * the impression this app should never give.
 */
export function preview(h: Hadith, max = 120): string {
  const text = h.english.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}
