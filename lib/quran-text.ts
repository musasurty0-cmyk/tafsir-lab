/**
 * The Qur'anic text the app shows, in the encoding its face expects.
 *
 * Arabic is set in the King Fahd Complex's Uthmanic Hafs face, and that face
 * is built for Quran.com's `text_qpc_hafs`: its sukūn is U+06E1, it drops the
 * Uthmani text's tatweels and alef-maqṣūra spellings, and each āyah ends with
 * a no-break space and the āyah number in Arabic-Indic digits, which the face
 * draws as the end-of-āyah ornament. The plain `text_uthmani` set in the same
 * face shows round zeros for sukūn and breaks the joins, so it is kept for
 * searching and never shown.
 *
 * The two are not convertible letter for letter, so text saved in the old
 * encoding is replaced by looking the āyah up again (see AyahBlockView).
 */

/** The no-break space and number a qpc āyah ends with. */
const AYAH_NUMBER = / [٠-٩]+\s*$/;

/** Display text for a verse: qpc when the record has it. */
export function verseArabic(v: { text_qpc_hafs?: string | null; text_uthmani?: string | null }): string {
  return (v.text_qpc_hafs || v.text_uthmani || "").trim();
}

/** The āyah without its closing number, for a place that marks it itself. */
export function withoutAyahNumber(text: string): string {
  return text.replace(AYAH_NUMBER, "").trim();
}

/** True when the text is in the qpc encoding (it carries the number). A saved
 *  passage of several āyāt carries several, so "contains" rather than "ends". */
export function isQpcText(text: string | null | undefined): boolean {
  return !!text && / [٠-٩]+/.test(text);
}

/** A translation's HTML as plain text. Footnote markers go first, whole: they
 *  are <sup> numbers, and stripping only the tags left "Allāh,1" in the
 *  sentence. */
export function plainTranslation(html: string | null | undefined): string {
  return (html ?? "").replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
