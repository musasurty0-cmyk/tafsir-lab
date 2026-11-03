import { beforeEach, describe, expect, it, vi } from "vitest";

/* The portal's one door: a demo guest is turned away whatever cookie the
   browser already holds, and everyone else behaves as before. */

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => { jar.set(k, v); },
    delete: (k: string) => { jar.delete(k); },
  }),
}));

let session: { userId: string } | null = null;
vi.mock("@/lib/session", () => ({ getSessionOrNull: async () => session }));

let email = "someone@example.com";
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: async () => ({ email }) } } }));

const PASSWORD = "test-only-password";

describe("the Youth Majlis gate", () => {
  beforeEach(() => {
    jar.clear();
    session = { userId: "u1" };
    email = "someone@example.com";
    process.env.SESSION_SECRET = "test-only-secret";
    process.env.YOUTH_MAJLIS_PASSWORD = PASSWORD;
  });

  it("lets a member through with the password", async () => {
    const { hasAccess, unlock } = await import("./gate");
    expect(await hasAccess("majlis")).toBe(false);
    expect(await unlock("majlis", PASSWORD)).toBe(true);
    expect(await hasAccess("majlis")).toBe(true);
  });

  it("lets a signed-out visitor through with the password", async () => {
    session = null;
    const { hasAccess, unlock } = await import("./gate");
    await unlock("majlis", PASSWORD);
    expect(await hasAccess("majlis")).toBe(true);
  });

  it("turns a demo guest away even with a valid gate cookie", async () => {
    const { hasAccess, isDemoVisitor, unlock } = await import("./gate");
    await unlock("majlis", PASSWORD);
    email = "demo-abc@demo.tafsirlab.local";
    expect(await isDemoVisitor()).toBe(true);
    expect(await hasAccess("majlis")).toBe(false);
    expect(await hasAccess("ilmi")).toBe(false);
  });
});
