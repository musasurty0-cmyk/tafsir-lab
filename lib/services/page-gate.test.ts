import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not-found page"); } }));
vi.mock("./workspaces.service", () => {
  class WorkspaceError extends Error {
    constructor(message: string, public readonly code: string) { super(message); }
  }
  return { WorkspaceError };
});

import { gatePage, WORKSPACE_ID } from "./page-gate";
import { WorkspaceError } from "./workspaces.service";

describe("gatePage", () => {
  it("passes a found workspace through", async () => {
    await expect(gatePage(Promise.resolve({ id: "w" }))).resolves.toEqual({ id: "w" });
  });
  it("turns a missing or closed workspace into the not-found page", async () => {
    for (const code of ["NOT_FOUND", "FORBIDDEN"] as const) {
      await expect(gatePage(Promise.reject(new WorkspaceError("x", code)))).rejects.toThrow("not-found page");
    }
  });
  it("leaves every other failure to the error page", async () => {
    await expect(gatePage(Promise.reject(new WorkspaceError("x", "CONFLICT" as never)))).rejects.toThrow("x");
    await expect(gatePage(Promise.reject(new Error("db down")))).rejects.toThrow("db down");
  });
});

describe("WORKSPACE_ID", () => {
  it("accepts a UUID and refuses a mistyped link", () => {
    expect(WORKSPACE_ID.test("e5da57c4-95ee-47c8-a000-4c65601e09d6")).toBe(true);
    for (const bad of ["not-a-uuid", "e5da57c4-95ee-47c8-a000-4c65601e09d", "e5da57c4-95ee-47c8-a000-4c65601e09d6x", ""]) {
      expect(WORKSPACE_ID.test(bad)).toBe(false);
    }
  });
});
