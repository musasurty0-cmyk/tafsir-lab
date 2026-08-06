/**
 * How a thrown error becomes an HTTP response.
 *
 * Mostly a regression suite. On 6 Aug 2026 this helper matched error MESSAGES
 * against /not authenticated|expired session|invalid/i. Prisma's failures read
 * "Invalid `prisma.user.count()` invocation", so that bare `invalid` turned
 * every database outage into 401 "Not authenticated" — on the one branch that
 * does not log. A broken database was indistinguishable from a signed-out
 * user and left no trace at all. The tests below exist so that cannot come
 * back.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiError } from "./api-errors";
import { SessionError } from "./session";

/** apiError logs unexpected errors; keep the test output readable. */
let errSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { errSpy = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { errSpy.mockRestore(); });

const status = async (err: unknown) => apiError(err).status;
const body   = async (err: unknown) => await apiError(err).json() as { error: string };

class Coded extends Error {
  constructor(message: string, readonly code: string) { super(message); }
}

describe("coded service errors map to real statuses", () => {
  it.each([
    ["NOT_FOUND",    404],
    ["FORBIDDEN",    403],
    ["CONFLICT",     409],
    ["DUPLICATE",    409],
    ["BAD_REQUEST",  400],
    ["INVALID",      400],
    ["BAD_RANGE",    400],
    ["UNAUTHORIZED", 401],
  ])("%s → %i", async (code, expected) => {
    expect(await status(new Coded("nope", code))).toBe(expected);
  });

  /* Every code the services actually throw must be mapped. INVALID,
     BAD_RANGE and DUPLICATE were missing once, which meant a bad ayah range
     came back as a 500 the client could do nothing with. */
  it("surfaces the author-written message for a mapped code", async () => {
    expect((await body(new Coded("Ayah range is back to front", "BAD_RANGE"))).error)
      .toBe("Ayah range is back to front");
  });
});

describe("session failures", () => {
  it.each([
    "Not authenticated",
    "Invalid or expired session",
    "Malformed session token",
  ])("%s → 401", async (message) => {
    expect(await status(new SessionError(message))).toBe(401);
  });

  it("carries the UNAUTHORIZED code rather than relying on its wording", () => {
    expect(new SessionError("anything at all").code).toBe("UNAUTHORIZED");
  });
});

describe("the regression that started this", () => {
  it("does NOT turn a Prisma error into 401 just because it says 'Invalid'", async () => {
    const prismaish = new Error(
      "Invalid `prisma.user.count()` invocation\n\nCan't reach database server",
    );
    expect(await status(prismaish)).toBe(500);
  });

  it("logs the unexpected error instead of swallowing it", async () => {
    await apiError(new Error("Can't reach database server"));
    expect(errSpy).toHaveBeenCalled();
  });

  it("never echoes an unexpected error's text to the client", async () => {
    const secret = "Can't reach db.abcdef123.supabase.co:5432 as user postgres";
    expect((await body(new Error(secret))).error).not.toContain("supabase");
    expect((await body(new Error(secret))).error).toBe("Something went wrong");
  });
});

describe("things that are not errors at all", () => {
  it.each([[null], [undefined], ["a bare string"], [42], [{}]])(
    "%s → 500 without throwing", async (value) => {
      expect(await status(value)).toBe(500);
    });

  it("ignores a code that is not one it knows", async () => {
    expect(await status(new Coded("hm", "WAT"))).toBe(500);
  });
});
