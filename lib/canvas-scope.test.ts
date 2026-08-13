import { describe, it, expect } from "vitest";
import { textBoxOnPage } from "./canvas-scope";

/**
 * The reported bug, stated as a test: write a note on one Mushaf page, turn the
 * page either way, and the note was still there. Every case below is about a box
 * appearing on exactly one page.
 */

const box = (mushafPage: number | null) => ({ anchorType: "page", mushafPage });

describe("textBoxOnPage — a box belongs to the page it was written on", () => {
  it("shows on its own page", () => {
    expect(textBoxOnPage(box(4), 4, 2)).toBe(true);
  });

  it("DOES NOT FOLLOW THE READER FORWARD — the reported bug", () => {
    expect(textBoxOnPage(box(4), 5, 2)).toBe(false);
  });

  it("does not follow the reader backward either", () => {
    expect(textBoxOnPage(box(4), 3, 2)).toBe(false);
  });

  it("two boxes on different pages never appear together", () => {
    const onNow = [box(2), box(3)].filter((b) => textBoxOnPage(b, 3, 2));
    expect(onNow).toEqual([box(3)]);
  });
});

describe("boxes written before the column existed", () => {
  it("land on the first page of the surah", () => {
    expect(textBoxOnPage(box(null), 2, 2)).toBe(true);
  });

  it("and nowhere else — they stop duplicating too", () => {
    expect(textBoxOnPage(box(null), 3, 2)).toBe(false);
  });

  it("survive a surah whose first page is not yet known", () => {
    expect(textBoxOnPage(box(null), 3, undefined)).toBe(false);
  });
});

describe("other anchor types are not this function's business", () => {
  it("ignores ayah / word / segment boxes, which their own anchor scopes", () => {
    for (const anchorType of ["ayah", "word", "segment", "editor"]) {
      expect(textBoxOnPage({ anchorType, mushafPage: 3 }, 3, 2)).toBe(false);
    }
  });
});
