import { describe, expect, it } from "vitest";
import { pollVersion, unchangedBody, withVersion } from "./poll-version";

describe("poll versions", () => {
  it("changes when a row changes, and when one is deleted", () => {
    const a = pollVersion(new Date(1000), 3);
    expect(pollVersion(new Date(1001), 3)).not.toBe(a);   // edited
    expect(pollVersion(new Date(1000), 2)).not.toBe(a);   // one deleted, newest untouched
    expect(pollVersion(null, 0)).toBe("0.0");             // nothing there yet
  });

  it("answers unchanged only for the exact version", () => {
    expect(unchangedBody("5.2", "5.2")).toEqual({ unchanged: true, version: "5.2" });
    expect(unchangedBody("5.1", "5.2")).toBeNull();
    expect(unchangedBody(null, "5.2")).toBeNull();          // first poll gets the data
  });

  it("adds the version to a URL with or without a query", () => {
    expect(withVersion("/api/pages/x/notes", null)).toBe("/api/pages/x/notes");
    expect(withVersion("/api/pages/x/notes", "5.2")).toBe("/api/pages/x/notes?v=5.2");
    expect(withVersion("/api/pages/x/progress?scope=group", "5.2")).toBe("/api/pages/x/progress?scope=group&v=5.2");
  });
});
