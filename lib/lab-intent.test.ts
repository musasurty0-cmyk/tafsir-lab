/**
 * When the notes offer appears.
 *
 * Both directions cost something, so both are pinned. A missed request means
 * the reader asked for a thing and it did not appear; a false positive puts a
 * card offering to write into their document under an answer they only wanted
 * to read. The second is recoverable with one click, which is why the
 * patterns lean slightly generous — but not so generous that ordinary
 * questions trip them.
 */
import { describe, it, expect } from "vitest";
import { asksForNotes } from "@/lib/lab-intent";

describe("asksForNotes", () => {
  it("catches the phrasing from the screenshot", () => {
    expect(asksForNotes("add a mindmap on surah fatiha to my notes")).toBe(true);
  });

  it("catches the ordinary ways of saying it", () => {
    for (const q of [
      "put this in my editor",
      "save that to my page",
      "add a summary of this to the document",
      "write that up",
      "note this down",
      "jot that down for me",
      "make me notes on the names of al-Fatihah",
      "write me some notes about patience",
      "can you add these points to my notes please",
      "append this to my notes",
    ]) {
      expect(asksForNotes(q), q).toBe(true);
    }
  });

  it("leaves ordinary questions alone", () => {
    for (const q of [
      "what does ibn kathir say about the basmalah",
      "what is the theme of surah as-saff",
      "explain tawheed to me like I am a beginner",
      "summarise this passage",              // asks for an answer, not a file
      "what did you just write",
      "hello",
      "thanks, that was helpful",
      "which surah mentions the people of the cave",
      "why does the surah open this way",
    ]) {
      expect(asksForNotes(q), q).toBe(false);
    }
  });

  it("ignores a long paste, which is material and not an instruction", () => {
    const essay = "add to my notes ".padEnd(500, "x");
    expect(asksForNotes(essay)).toBe(false);
  });

  it("returns false for nothing", () => {
    expect(asksForNotes("")).toBe(false);
    expect(asksForNotes("   ")).toBe(false);
  });
});
