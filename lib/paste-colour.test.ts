import { describe, expect, it } from "vitest";
import { pastedColour } from "./paste-colour";

describe("pastedColour", () => {
  it("drops the source app's own text colours, so the page's ink shows", () => {
    for (const c of ["black", "windowtext", "#000", "#000000", "rgb(0, 0, 0)", "#595959", "rgb(64,64,64)", "white", "#ffffff", "gray"]) {
      expect(pastedColour(c)).toBeNull();
    }
  });

  it("drops a fully transparent colour", () => {
    expect(pastedColour("rgba(30, 60, 200, 0)")).toBeNull();
  });

  it("keeps a colour that already reads on both themes", () => {
    expect(pastedColour("rgb(46, 117, 181)")).toBe("rgb(46, 117, 181)");
  });

  it("lifts a heading blue that is too dark for the dark theme", () => {
    const out = pastedColour("#1F3763")!;
    const [r, g, b] = out.match(/\d+/g)!.map(Number);
    expect(b).toBeGreaterThan(r);          // still blue
    expect((Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255).toBeGreaterThanOrEqual(0.41);
  });

  it("tones down a colour too pale for the paper", () => {
    const out = pastedColour("#b4d2ff")!;
    const [r, g, b] = out.match(/\d+/g)!.map(Number);
    expect((Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255).toBeLessThanOrEqual(0.67);
  });

  it("keeps a named colour it cannot measure", () => {
    expect(pastedColour("teal")).toBe("teal");
  });
});
