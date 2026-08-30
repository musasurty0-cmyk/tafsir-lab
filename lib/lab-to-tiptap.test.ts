/**
 * Answer → note.
 *
 * The failure mode this guards against is not a wrong-looking note, it is an
 * insert that throws: ProseMirror rejects an empty text node and a listItem
 * whose child is not a block, and both are easy to produce from a model's
 * markdown. A note that silently loses its citations is the other one — a
 * sourced claim quietly becoming an unsourced claim is worse than an ugly one.
 */
import { describe, it, expect } from "vitest";
import { labMarkdownToTiptap } from "@/lib/lab-to-tiptap";

describe("labMarkdownToTiptap", () => {
  it("turns a paragraph into a paragraph", () => {
    expect(labMarkdownToTiptap("Just a line.")).toEqual([
      { type: "paragraph", content: [{ type: "text", text: "Just a line." }] },
    ]);
  });

  it("carries bold and italic across as marks", () => {
    const [p] = labMarkdownToTiptap("a **b** and *c*");
    expect(p.content).toEqual([
      { type: "text", text: "a " },
      { type: "text", text: "b", marks: [{ type: "bold" }] },
      { type: "text", text: " and " },
      { type: "text", text: "c", marks: [{ type: "italic" }] },
    ]);
  });

  it("wraps list item text in a paragraph, as the schema requires", () => {
    const [list] = labMarkdownToTiptap("- one\n- two");
    expect(list.type).toBe("bulletList");
    expect(list.content).toHaveLength(2);
    for (const item of list.content!) {
      expect(item.type).toBe("listItem");
      expect(item.content![0].type).toBe("paragraph");
    }
  });

  it("keeps ordered lists ordered", () => {
    const [list] = labMarkdownToTiptap("1. first\n2. second");
    expect(list.type).toBe("orderedList");
  });

  it("resolves a citation to the source it pointed at", () => {
    const [p] = labMarkdownToTiptap(
      "He says this [1].",
      (n) => (n === 1 ? "Ibn Kathīr 61:4" : null),
    );
    const text = p.content!.map((c) => c.text).join("");
    expect(text).toContain("[Ibn Kathīr 61:4]");
    expect(text).not.toContain("[1]");
  });

  it("keeps the number when a citation cannot be resolved", () => {
    // Losing it entirely would turn a sourced claim into an unsourced one.
    const [p] = labMarkdownToTiptap("Claim [7].", () => null);
    expect(p.content!.map((c) => c.text).join("")).toContain("[7]");
  });

  it("never emits an empty text node", () => {
    const nodes = labMarkdownToTiptap("**bold**\n\n\n\n*em*\n\n- \n- real");
    const walk = (n: { text?: string; content?: unknown[] }): void => {
      if (n.text !== undefined) expect(n.text.length).toBeGreaterThan(0);
      for (const c of (n.content ?? []) as { text?: string; content?: unknown[] }[]) walk(c);
    };
    nodes.forEach(walk);
  });

  it("drops blank paragraphs rather than padding the note", () => {
    const nodes = labMarkdownToTiptap("one\n\n\n\ntwo");
    expect(nodes).toHaveLength(2);
    expect(nodes.every((n) => n.type === "paragraph")).toBe(true);
  });

  it("returns nothing for nothing", () => {
    expect(labMarkdownToTiptap("")).toEqual([]);
    expect(labMarkdownToTiptap("   \n\n  ")).toEqual([]);
  });

  it("produces a document ProseMirror would accept", () => {
    /* Every node has a type; every leaf has text; no node has both. */
    const nodes = labMarkdownToTiptap(
      "## Heading\n\nSome **text** [1].\n\n- a\n- b\n\n1. x",
      () => "al-Ṭabarī 2:3",
    );
    const check = (n: { type?: string; text?: string; content?: unknown[] }): void => {
      expect(typeof n.type).toBe("string");
      if (n.text !== undefined) expect(n.content).toBeUndefined();
      for (const c of (n.content ?? []) as { type?: string }[]) check(c);
    };
    expect(nodes.length).toBeGreaterThan(3);
    nodes.forEach(check);
  });
});
