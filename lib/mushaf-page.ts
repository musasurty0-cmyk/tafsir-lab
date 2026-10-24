/**
 * One page of the muṣḥaf, exactly as the page font draws it.
 *
 * THE BUG THIS EXISTS FOR. `verses/by_page/{p}` does not return page p of the
 * v2 muṣḥaf. Its page boundaries are not the v2 font's, so each response
 * straddles two v2 pages: "page 122" came back as 5:83–89, whose words sit on
 * v2 pages 121 AND 122. The words still carry their own `v2_page` and
 * `line_number`, so grouping a response by line_number put line 13 of page 121
 * and line 13 of page 122 on one line — drawn in ONE page's font, where the
 * other page's glyph codes mean different glyphs or nothing at all. That is
 * how Al-Māʾidah 88–90 came out jumbled and cut off, and 24 other page views
 * besides (found by auditing all 604 pages against every word's own page).
 *
 * So a page is assembled from the words themselves: every word whose v2_page
 * is p, gathered from the responses for p-1, p and p+1 (the audit checks that
 * this window always holds every word of the page), in reading order. Each
 * line then holds one page's glyphs only, and every glyph is drawn in its own
 * font.
 */

import type { QCFVerse, QCFWord } from "./types";

/**
 * Words the upstream v2 data puts on the wrong line, by word id → true line.
 *
 * Found by measuring every line of all 604 pages in its own font
 * (scripts/audit-mushaf-widths.py): a Muṣḥaf line fills the measure, and 98%
 * of the 8,807 lines sit within ±1.5% of it. These five pages each had one
 * line about 10% over and its neighbour about 10% short; moving the one word
 * named here brings both back to within 1%. Absolute line numbers, so the fix
 * is harmless if upstream corrects its data.
 */
const LINE_FIXES = new Map<number, number>([
  [83893, 15], // 2:181 فَإِنَّمَآ — page 27, opens line 15
  [6124,  12], // 8:6 وَهُمۡ — page 177, opens line 12
  [35694,  6], // 29:33 وَقَالُواْ — page 400, opens line 6
  [50061, 13], // 36:52 ٱلرَّحۡمَٰنُ — page 443, opens line 13
  [23997, 14], // 84:21 end marker ٢١ — page 589: was left on line 13, mid-verse
]);

const ch = (k: string) => Number(k.split(":")[0]);
const vn = (k: string) => Number(k.split(":")[1]);

/** Verses in muṣḥaf order: by surah, then by āyah. */
function verseOrder(a: QCFVerse, b: QCFVerse) {
  return ch(a.verse_key) - ch(b.verse_key) || vn(a.verse_key) - vn(b.verse_key);
}

/**
 * Page `page` of the v2 muṣḥaf from the by_page responses around it.
 * A verse that crosses the page break keeps only its words on this page.
 */
export function assembleMushafPage(page: number, responses: { verses?: QCFVerse[] }[]): QCFVerse[] {
  const byKey = new Map<string, { verse: QCFVerse; words: Map<number, QCFWord> }>();
  for (const res of responses) {
    for (const v of res.verses ?? []) {
      let entry = byKey.get(v.verse_key);
      if (!entry) { entry = { verse: v, words: new Map() }; byKey.set(v.verse_key, entry); }
      for (const w of v.words ?? []) {
        if (w.v2_page !== page) continue;
        const line = LINE_FIXES.get(w.id);
        entry.words.set(w.id, line != null ? { ...w, line_number: line } : w);
      }
    }
  }
  const out: QCFVerse[] = [];
  for (const { verse, words } of byKey.values()) {
    if (!words.size) continue;
    out.push({ ...verse, words: [...words.values()].sort((a, b) => a.position - b.position) });
  }
  return out.sort(verseOrder);
}
