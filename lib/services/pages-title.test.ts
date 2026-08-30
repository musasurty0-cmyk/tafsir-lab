/**
 * Page titles reaching the database.
 *
 * The create form carries maxLength={80}, which constrains a keyboard and
 * nothing else — the API accepts whatever is POSTed to it. These are the
 * bounds that actually hold.
 */
import { describe, it, expect } from "vitest";
import { boundedTitle } from "@/lib/services/pages.service";

describe("boundedTitle", () => {
  it("keeps an ordinary title unchanged", () => {
    expect(boundedTitle("Notes on al-Baqarah", "Untitled")).toBe("Notes on al-Baqarah");
  });

  it("falls back when the title is empty or only whitespace", () => {
    expect(boundedTitle("", "Untitled")).toBe("Untitled");
    expect(boundedTitle("   \n\t ", "Untitled board")).toBe("Untitled board");
  });

  it("trims surrounding whitespace", () => {
    expect(boundedTitle("  spaced  ", "Untitled")).toBe("spaced");
  });

  it("flattens newlines, which would otherwise break the sidebar row", () => {
    expect(boundedTitle("line one\nline two", "Untitled")).toBe("line one line two");
  });

  it("collapses runs of whitespace", () => {
    expect(boundedTitle("a     b", "Untitled")).toBe("a b");
  });

  it("caps a long title rather than storing it whole", () => {
    const out = boundedTitle("x".repeat(5000), "Untitled");
    expect(out).toHaveLength(120);
  });

  it("caps a title that is long only because of whitespace, after collapsing", () => {
    // Collapse happens first, so this is well under the cap and survives whole.
    expect(boundedTitle("a" + " ".repeat(400) + "b", "Untitled")).toBe("a b");
  });
});
