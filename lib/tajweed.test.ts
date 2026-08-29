/**
 * The tajweed parser, which exists to make upstream markup SAFE as well as
 * legible. The property that matters is that nothing coming back can ever
 * reach the DOM as HTML — so every case below checks that the output is plain
 * text segments, including when the input is malformed or hostile.
 */
import { describe, it, expect } from "vitest";
import { parseTajweed } from "@/app/api/quran/script/route";

const text = (src: string) => parseTajweed(src).map((s) => s.text).join("");

describe("parseTajweed", () => {
  it("passes plain text through untouched", () => {
    expect(parseTajweed("بِسْمِ")).toEqual([{ text: "بِسْمِ" }]);
  });

  it("tags a known rule and keeps the surrounding text", () => {
    expect(parseTajweed("a<tajweed class=ikhafa>b</tajweed>c")).toEqual([
      { text: "a" },
      { text: "b", rule: "ikhafa" },
      { text: "c" },
    ]);
  });

  it("keeps the text of an unknown rule but does not tag it", () => {
    expect(parseTajweed("<tajweed class=not_a_rule>x</tajweed>"))
      .toEqual([{ text: "x", rule: undefined }]);
  });

  it("handles several rules in one verse", () => {
    const out = parseTajweed(
      "بِسْمِ <tajweed class=ham_wasl>ٱ</tajweed>للَّهِ <tajweed class=ghunnah>مّ</tajweed>",
    );
    expect(out.filter((s) => s.rule).map((s) => s.rule)).toEqual(["ham_wasl", "ghunnah"]);
    expect(text("بِسْمِ <tajweed class=ham_wasl>ٱ</tajweed>للَّهِ")).toBe("بِسْمِ ٱللَّهِ");
  });

  it("never emits markup, even from an unclosed tag", () => {
    const out = parseTajweed("before<tajweed class=ikhafa>after");
    expect(out.every((s) => !/[<>]/.test(s.text))).toBe(true);
    expect(text("before<tajweed class=ikhafa>after")).toBe("beforeafter");
  });

  it("strips an injected script tag to text", () => {
    const out = parseTajweed('a<script>alert(1)</script>b');
    expect(out.every((s) => !/[<>]/.test(s.text))).toBe(true);
    expect(text('a<script>alert(1)</script>b')).toBe("aalert(1)b");
  });

  it("strips markup smuggled inside a rule body", () => {
    const out = parseTajweed('<tajweed class=ikhafa><img src=x onerror=y></tajweed>');
    expect(out.every((s) => !/[<>]/.test(s.text))).toBe(true);
  });

  it("drops segments that end up empty", () => {
    expect(parseTajweed("<tajweed class=ikhafa></tajweed>")).toEqual([]);
  });

  it("returns nothing for an empty string", () => {
    expect(parseTajweed("")).toEqual([]);
  });
});
