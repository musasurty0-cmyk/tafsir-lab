import { describe, expect, it } from "vitest";
import { directionOf } from "./text-direction";

describe("directionOf", () => {
  it("reads Arabic right to left and English left to right", () => {
    expect(directionOf("بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ")).toBe("rtl");
    expect(directionOf("In the name of Allah")).toBe("ltr");
  });
  it("goes by the whole line, not its first character", () => {
    expect(directionOf("الرحمن is one of the names of Allah used throughout this sūrah")).toBe("ltr");
    expect(directionOf("1. وعِبَادُ الرَّحْمَٰنِ الَّذِينَ يَمْشُونَ عَلَى الْأَرْضِ (25:63)")).toBe("rtl");
  });
  it("leaves a genuinely mixed or letterless line to the browser", () => {
    expect(directionOf("Allah الله")).toBeNull();
    expect(directionOf("25:63–77")).toBeNull();
    expect(directionOf("")).toBeNull();
  });
});
