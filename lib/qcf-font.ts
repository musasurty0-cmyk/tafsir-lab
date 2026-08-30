"use client";

/**
 * The mushaf faces, and the one rule that governs them.
 *
 * QCF is not a font. It is 604 fonts — one per page of the Madīnah muṣḥaf —
 * and the text they render is not Arabic Unicode but private-use glyph codes
 * (`code_v2`), positioned so that a page reproduces the printed page line for
 * line. That is what makes the muṣḥaf view page-accurate, and it is also why
 * the family cannot simply be pointed at ordinary Arabic text: the codepoints
 * would not match and the result is broken glyphs or a silent fallback.
 *
 * So the pairing is absolute:
 *
 *   code_v2 renders ONLY in p{v2_page}-v2, and only once that file has loaded.
 *
 * A verse can straddle a page boundary, so a single āyah may need two of them,
 * word by word. Extracted from QCFMushafPage so the āyah blocks in the editor
 * use the same loader as the muṣḥaf rather than a second copy of this rule
 * that could drift away from it.
 */

const FONT_CDN = "https://verses.quran.foundation/fonts/quran/hafs/v2/woff2";

/** Pages already registered with the document, so a reopen costs nothing. */
const loaded = new Set<number>();

/** The family name a page's glyph codes must be rendered in. */
export function qcfFamily(pageNum: number): string {
  return `p${pageNum}-v2`;
}

/**
 * Load and register one page font. Rejects if the network or decode fails —
 * callers must handle that rather than rendering the codes anyway.
 */
export async function loadQCFFont(pageNum: number): Promise<void> {
  if (loaded.has(pageNum)) return;
  const family = qcfFamily(pageNum);

  /* Registered earlier in this session, possibly by the muṣḥaf view. */
  for (const ff of document.fonts.values()) {
    if (ff.family.replace(/^"|"$/g, "") === family && ff.status === "loaded") {
      loaded.add(pageNum);
      return;
    }
  }

  const ff = new FontFace(family, `url(${FONT_CDN}/p${pageNum}.woff2)`);
  /* "block": the text stays invisible until the face arrives, rather than
     flashing the fallback's interpretation of private-use codepoints, which
     is a screen of tofu. */
  ff.display = "block";
  document.fonts.add(await ff.load());
  loaded.add(pageNum);
}

/** Load every page a verse's words touch. Resolves only if all of them do. */
export async function loadQCFFontsFor(pages: Iterable<number>): Promise<void> {
  await Promise.all([...new Set(pages)].map(loadQCFFont));
}
