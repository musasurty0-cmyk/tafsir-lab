/**
 * assembleMushafPage — a page of the muṣḥaf from the words that are on it.
 *
 * Upstream page responses straddle two v2 pages, which is how Al-Māʾidah
 * 88–90 came out with two pages' glyphs on one line in one page's font. These
 * pin the rules: only the page's own words, a verse split by the page break
 * keeps just its half, nothing doubled when responses overlap, reading order,
 * and the line corrections applied. The whole muṣḥaf is checked against live
 * data by scripts/audit-mushaf.mts.
 */
import { describe, it, expect } from "vitest";
import { assembleMushafPage } from "@/lib/mushaf-page";
import type { QCFVerse, QCFWord } from "@/lib/types";

const w = (id: number, position: number, v2_page: number, line_number: number): QCFWord => ({
  id, position, v2_page, line_number, page_number: v2_page,
  code_v2: `g${id}`, text_qpc_hafs: "", char_type_name: "word",
});
const v = (verse_key: string, words: QCFWord[]): QCFVerse => ({
  id: 0, verse_number: Number(verse_key.split(":")[1]), verse_key, page_number: 0, words,
});

describe("assembleMushafPage", () => {
  // Response "122" holds 5:88 (all on v2 page 122) and 5:83 (whose words are on 121).
  // Response "123" holds 5:90, which starts on 122 and ends on 123.
  const r122 = { verses: [v("5:83", [w(1, 1, 121, 13), w(2, 2, 121, 13)]), v("5:88", [w(10, 1, 122, 13), w(11, 2, 122, 14)])] };
  const r123 = { verses: [v("5:90", [w(20, 1, 122, 15), w(21, 2, 123, 1)])] };

  it("keeps only the words on the page", () => {
    const page = assembleMushafPage(122, [r122, r123]);
    expect(page.map((x) => x.verse_key)).toEqual(["5:88", "5:90"]);
    expect(page.flatMap((x) => x.words.map((y) => y.v2_page))).toEqual([122, 122, 122]);
  });

  it("gives a verse split by the page break only its half", () => {
    const p122 = assembleMushafPage(122, [r122, r123]);
    const p123 = assembleMushafPage(123, [r122, r123]);
    expect(p122.find((x) => x.verse_key === "5:90")!.words.map((y) => y.id)).toEqual([20]);
    expect(p123.find((x) => x.verse_key === "5:90")!.words.map((y) => y.id)).toEqual([21]);
  });

  it("never doubles a word that two responses both carry", () => {
    const page = assembleMushafPage(122, [r122, r122, r123]);
    expect(page.flatMap((x) => x.words.map((y) => y.id))).toEqual([10, 11, 20]);
  });

  it("returns verses in muṣḥaf order whatever order the responses came in", () => {
    const page = assembleMushafPage(122, [r123, r122]);
    expect(page.map((x) => x.verse_key)).toEqual(["5:88", "5:90"]);
  });

  it("puts a word the upstream data misplaces back on its line", () => {
    // 84:21's end marker (word 23997) is labelled line 13 upstream, mid-verse.
    const r = { verses: [v("84:21", [w(23996, 6, 589, 14), { ...w(23997, 7, 589, 13), char_type_name: "end" }])] };
    const page = assembleMushafPage(589, [r]);
    expect(page[0].words.map((y) => y.line_number)).toEqual([14, 14]);
  });
});
