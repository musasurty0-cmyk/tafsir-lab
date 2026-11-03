import { describe, expect, it } from "vitest";
import { isQpcText, plainTranslation, withoutAyahNumber } from "./quran-text";

describe("plainTranslation", () => {
  it("drops footnote markers whole, not just their tags", () => {
    expect(plainTranslation('In the name of Allāh,<sup foot_note="1">1</sup> the Entirely Merciful')).toBe("In the name of Allāh, the Entirely Merciful");
  });
  it("strips other markup and folds whitespace", () => {
    expect(plainTranslation("<em>Guide</em>   us\n to the path")).toBe("Guide us to the path");
  });
  it("is empty for nothing", () => {
    expect(plainTranslation(undefined)).toBe("");
  });
});

describe("qpc text", () => {
  const qpc = "ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ\u00a0٣";
  it("is recognised by its closing number", () => {
    expect(isQpcText(qpc)).toBe(true);
    expect(isQpcText("ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")).toBe(false);
  });
  it("loses the number when asked", () => {
    expect(withoutAyahNumber(qpc)).toBe("ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ");
  });
});
