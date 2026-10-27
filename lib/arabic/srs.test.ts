import { describe, it, expect } from "vitest";
import { statusOf, nextBox, dueAfter, unlockBox, WAIT, TOP } from "./srs";
import { wordKey, cardHeadword, meaningWords, lookup, type QuranIndex } from "./quran-match";

describe("srs", () => {
  it("has three colours and no in-between", () => {
    expect(statusOf(null)).toBe("unknown");
    expect(statusOf(0)).toBe("unknown");
    expect(statusOf(1)).toBe("learning");
    expect(statusOf(4)).toBe("learning");
    expect(statusOf(5)).toBe("learnt");
  });
  it("climbs on a right answer, drops to the first box on a miss", () => {
    expect(nextBox(0, "good")).toBe(2);
    expect(nextBox(2, "good")).toBe(3);
    expect(nextBox(2, "easy")).toBe(4);
    expect(dueAfter(nextBox(4, "again"), 0).getTime()).toBe(10 * 60_000);
    expect(nextBox(5, "again")).toBe(1);
    expect(nextBox(TOP, "good")).toBe(TOP);
  });
  it("learnt takes more than one session's worth of right answers", () => {
    let box = unlockBox(true);
    box = nextBox(box, "good");
    expect(statusOf(box)).toBe("learning");
    box = nextBox(box, "good");
    expect(statusOf(box)).toBe("learnt");
  });
  it("waits longer in each box", () => {
    const now = 0;
    expect(dueAfter(1, now).getTime()).toBe(WAIT[1]);
    expect(dueAfter(99, now).getTime()).toBe(WAIT[TOP]);
    for (let i = 1; i < WAIT.length; i++) expect(WAIT[i]).toBeGreaterThan(WAIT[i - 1]);
  });
});

describe("quran-match", () => {
  it("reduces a Qurʾānic word and a course word to the same key", () => {
    expect(wordKey("وَالْأَرْضِ")).toBe(wordKey("أَرْضٌ"));
    expect(wordKey("بِالْقَلَمِ")).toBe(wordKey("قَلَمٌ"));
    expect(wordKey("الْكِتَابُ")).toBe(wordKey("كِتَابًا"));
    expect(wordKey("لِلنَّاسِ")).toBe(wordKey("نَاسٌ"));
    expect(wordKey("الشَّمْسُ")).toBe(wordKey("شَمْسٌ"));
  });
  it("keeps words apart that differ only in their vowels", () => {
    expect(wordKey("أُذُنٌ")).not.toBe(wordKey("أَذِنَ"));
    expect(wordKey("عِلْمٌ")).not.toBe(wordKey("عَلِمَ"));
  });
  it("refuses an unvowelled word rather than guess", () => {
    expect(wordKey("اذن")).toBeNull();
  });
  it("finds the headword of a card, and only for a single word", () => {
    expect(cardHeadword("هَذِهِ أُذُنٌ", false)).toBe(wordKey("أُذُنٌ"));
    expect(cardHeadword("الْكَلِمَاتُ", false)).toBe(wordKey("كَلِمَاتٌ"));
    expect(cardHeadword("مَكْتُوبٌ، مَكْتَبٌ", false)).toBeNull();
    expect(cardHeadword("كَتَبَ الْمُدَرِّسُ", true)).toBeNull();
  });
  it("reduces meanings to their content words", () => {
    expect(meaningWords("(the) eyes")).toEqual(["eye"]);
    expect(meaningWords("A spring")).toEqual(["spring"]);
    expect(meaningWords("to write – past", true)).toEqual(["write"]);
  });
  it("offers only the places where the word means what the card means", () => {
    const k = wordKey("عَيْنٌ")!;
    const index: QuranIndex = { idx: { [k]: [11, ["spring", 6, "عين", "عَيْن", "76:18:1"], ["eye", 5, "عين", "عَيْن", "5:45:9"]] } };
    expect(lookup(index, k, "eye (f)")).toEqual({ count: 5, places: [{ verseKey: "5:45", word: 9 }], root: "عين", lemma: "عَيْن" });
    expect(lookup(index, k, "spring")?.places[0].verseKey).toBe("76:18");
    expect(lookup(index, k, "computer")).toBeNull();
  });
});
