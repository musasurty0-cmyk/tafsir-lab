/**
 * The markdown Lab AI writes.
 *
 * This is the code that decides whether a reader sees bold text or a pair of
 * asterisks — the exact thing that shipped broken once — and whether a
 * citation survives to be checked against the passages that were retrieved.
 */
import { describe, it, expect } from "vitest";
import { parseInline, parseBlocks } from "@/lib/lab-markdown";

describe("parseInline", () => {
  it("passes plain text through whole", () => {
    expect(parseInline("just words")).toEqual([{ t: "text", v: "just words" }]);
  });

  it("reads bold", () => {
    expect(parseInline("a **b** c")).toEqual([
      { t: "text", v: "a " }, { t: "strong", v: "b" }, { t: "text", v: " c" },
    ]);
  });

  it("does not read bold as two empty italics", () => {
    // The ordering bug this guards: `**x**` matched as *(nothing)* twice.
    expect(parseInline("**x**")).toEqual([{ t: "strong", v: "x" }]);
  });

  it("reads italic and inline code", () => {
    expect(parseInline("*a* `b`")).toEqual([
      { t: "em", v: "a" }, { t: "text", v: " " }, { t: "code", v: "b" },
    ]);
  });

  it("pulls citations out as numbers", () => {
    expect(parseInline("patience [3] and reward [12]")).toEqual([
      { t: "text", v: "patience " }, { t: "cite", n: 3 },
      { t: "text", v: " and reward " }, { t: "cite", n: 12 },
    ]);
  });

  it("keeps adjacent citations separate", () => {
    expect(parseInline("both [1][2]")).toEqual([
      { t: "text", v: "both " }, { t: "cite", n: 1 }, { t: "cite", n: 2 },
    ]);
  });

  it("leaves bracketed text that is not a citation alone", () => {
    expect(parseInline("see [below]")).toEqual([{ t: "text", v: "see [below]" }]);
  });

  it("is reusable — the regex is stateful and must be reset", () => {
    // A module-level /g regex keeps lastIndex between calls. Without a reset,
    // the second call starts mid-string and silently loses the first match.
    const once = parseInline("**a** **b**");
    const twice = parseInline("**a** **b**");
    expect(twice).toEqual(once);
    expect(twice.filter((n) => n.t === "strong")).toHaveLength(2);
  });

  it("returns nothing for an empty string", () => {
    expect(parseInline("")).toEqual([]);
  });
});

describe("parseBlocks", () => {
  it("joins wrapped lines into one paragraph", () => {
    expect(parseBlocks("one\ntwo")).toEqual([
      { t: "p", kids: [{ t: "text", v: "one two" }] },
    ]);
  });

  it("splits paragraphs on a blank line", () => {
    expect(parseBlocks("one\n\ntwo")).toHaveLength(2);
  });

  it("clamps headings to h3–h5", () => {
    const levels = parseBlocks("# a\n\n## b\n\n### c\n\n#### d\n\n##### e")
      .filter((b): b is Extract<typeof b, { t: "h" }> => b.t === "h")
      .map((b) => b.level);
    expect(levels).toEqual([3, 4, 5, 5, 5]);
  });

  it("reads both list markers as one bullet list", () => {
    const [block] = parseBlocks("* a\n- b");
    expect(block).toEqual({
      t: "ul", items: [[{ t: "text", v: "a" }], [{ t: "text", v: "b" }]],
    });
  });

  it("reads a numbered list", () => {
    const [block] = parseBlocks("1. a\n2) b");
    expect(block.t).toBe("ol");
  });

  it("starts a new list when the kind changes", () => {
    expect(parseBlocks("* a\n1. b").map((b) => b.t)).toEqual(["ul", "ol"]);
  });

  it("does not mistake an italic opening a line for a bullet", () => {
    // No space after the asterisk, so it is emphasis, not a list marker.
    const [block] = parseBlocks("*emphasis* opens this line");
    expect(block.t).toBe("p");
  });

  it("does not mistake bold opening a line for a bullet", () => {
    const [block] = parseBlocks("**Stated:** al-Qurtubi says so");
    expect(block.t).toBe("p");
    expect((block as Extract<typeof block, { t: "p" }>).kids[0])
      .toEqual({ t: "strong", v: "Stated:" });
  });

  it("keeps citations inside list items", () => {
    const [block] = parseBlocks("* patience [2]");
    expect(block).toEqual({
      t: "ul",
      items: [[{ t: "text", v: "patience " }, { t: "cite", n: 2 }]],
    });
  });

  it("handles a full answer with headings, bold, bullets and citations", () => {
    const kinds = parseBlocks([
      "### Stated Outright",
      "",
      "Ibn Kathir uses the word **patience** [1].",
      "",
      "* he did not weaken [2]",
      "* he did not give up [3]",
    ].join("\n")).map((b) => b.t);
    expect(kinds).toEqual(["h", "p", "ul"]);
  });

  it("returns nothing for empty or whitespace input", () => {
    expect(parseBlocks("")).toEqual([]);
    expect(parseBlocks("\n\n   \n")).toEqual([]);
  });
});
