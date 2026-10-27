import { describe, it, expect } from "vitest";
import { makeOptions, bareWord, type DrillCard } from "./drill";

const c = (id: string, english: string, arabic: string, lessonId = "L1", isSentence = false): DrillCard =>
  ({ id, lessonId, english, arabic, isSentence });

const pool = [
  c("ear", "ear (f)", "أُذُنٌ"), c("nose", "nose (m)", "أَنْفٌ"), c("eye", "eye (f)", "عَيْنٌ"),
  c("hand", "hand (f)", "يَدٌ"), c("ear2", "ear", "أُذُن"), c("s1", "The pen is here.", "هُنَا الْقَلَمُ.", "L1", true),
  c("one", "one", "وَاحِدٌ", "L2"),
];

describe("makeOptions", () => {
  it("gives four options with exactly one right answer", () => {
    const o = makeOptions(pool[0], pool, "meaning");
    expect(o).toHaveLength(4);
    expect(o.filter((x) => x.correct)).toHaveLength(1);
    expect(o.find((x) => x.correct)?.text).toBe("ear (f)");
  });
  it("never offers the same meaning twice, nor a sentence for a word", () => {
    const o = makeOptions(pool[0], pool, "meaning");
    const texts = o.map((x) => x.text.replace(/ \((m|f)\)$/, ""));
    expect(new Set(texts).size).toBe(texts.length);
    expect(o.some((x) => x.id === "s1" || x.id === "ear2")).toBe(false);
  });
  it("prefers the same lesson, and asks for Arabic in recall", () => {
    const o = makeOptions(pool[0], pool, "recall");
    expect(o.find((x) => x.correct)?.text).toBe("أُذُنٌ");
    expect(o.some((x) => x.id === "one")).toBe(false);
  });
  it("drops the demonstrative from cloze choices", () => {
    const o = makeOptions(pool[0], pool, "cloze");
    expect(o.find((x) => x.correct)?.text).toBe("أُذُنٌ");
    expect(bareWord("هَذَا أَنْفٌ")).toBe("أَنْفٌ");
  });
});
