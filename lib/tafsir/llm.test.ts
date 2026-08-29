/**
 * Citation checking.
 *
 * This is what survives the move from quoting to generating. Extractive
 * selection could prove every sentence was in the corpus; a model writing prose
 * cannot be held to that. What it CAN be held to is that every claim points at
 * a passage that was actually retrieved — so a [7] in an answer built from six
 * passages has to be caught here, because a reader cannot catch it themselves.
 */
import { describe, it, expect } from "vitest";
import { checkCitations, type Passage } from "@/lib/tafsir/llm";

const P: Passage[] = [1, 2, 3].map((n) => ({
  n, sourceName: `Source ${n}`, verseKey: `2:${n}`, language: "en",
  content: `Passage number ${n}.`,
}));

describe("checkCitations", () => {
  it("accepts citations that resolve", () => {
    const r = checkCitations("Patience is commanded [1] and rewarded [3].", P);
    expect(r.cited).toEqual([1, 3]);
    expect(r.invalid).toEqual([]);
    expect(r.uncited).toBe(false);
  });

  it("catches a citation with no matching passage", () => {
    // The failure the reader cannot see: a confident claim pointing at a
    // passage that was never retrieved.
    const r = checkCitations("Al-Qurtubi holds the opposite view [7].", P);
    expect(r.invalid).toEqual([7]);
  });

  it("reports several invalid citations", () => {
    expect(checkCitations("a [4] b [9] c [1]", P).invalid).toEqual([4, 9]);
  });

  it("deduplicates repeated citations", () => {
    expect(checkCitations("x [2] y [2] z [2]", P).cited).toEqual([2]);
  });

  it("handles adjacent citations", () => {
    expect(checkCitations("Both agree [1][2].", P).cited).toEqual([1, 2]);
  });

  it("does not flag a short refusal for having no citations", () => {
    // "The passages do not cover that" is a good answer and cites nothing.
    const r = checkCitations("These passages don't address that.", P);
    expect(r.uncited).toBe(false);
    expect(r.invalid).toEqual([]);
  });

  it("flags a long answer that cites nothing", () => {
    // Length without citation is the shape of an answer written from the
    // model's own knowledge rather than from the passages.
    const r = checkCitations("x".repeat(400), P);
    expect(r.uncited).toBe(true);
  });

  it("ignores bracketed text that is not a citation", () => {
    const r = checkCitations("He said [see below] that patience is best [1].", P);
    expect(r.cited).toEqual([1]);
    expect(r.invalid).toEqual([]);
  });

  it("is empty for an empty answer", () => {
    const r = checkCitations("", P);
    expect(r.cited).toEqual([]);
    expect(r.invalid).toEqual([]);
    expect(r.uncited).toBe(false);
  });
});
