/**
 * The shared collab token.
 *
 * Three behaviours matter and none is visible by reading the call sites: that
 * simultaneous callers share one request, that a token is reused only while it
 * is still comfortably valid, and that a FAILED fetch is never cached as
 * though it were a token — which would lock a page out of realtime for two
 * minutes after one blip.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCollabToken, forgetCollabToken } from "@/lib/collab/collab-token";

const g = globalThis as unknown as { fetch: typeof fetch };
const realFetch = g.fetch;

function mockFetch(impl: (url: string) => { ok: boolean; token?: string }) {
  const spy = vi.fn(async (url: string) => {
    const r = impl(url);
    return {
      ok: r.ok,
      json: async () => ({ token: r.token }),
    } as unknown as Response;
  });
  g.fetch = spy as unknown as typeof fetch;
  return spy;
}

beforeEach(() => { forgetCollabToken(); vi.useRealTimers(); });
afterEach(() => { g.fetch = realFetch; vi.useRealTimers(); });

describe("getCollabToken", () => {
  it("fetches a token and returns it", async () => {
    mockFetch(() => ({ ok: true, token: "t1" }));
    expect(await getCollabToken("page-1")).toBe("t1");
  });

  it("serves a second caller from cache rather than fetching twice", async () => {
    const spy = mockFetch(() => ({ ok: true, token: "t1" }));
    await getCollabToken("page-1");
    await getCollabToken("page-1");
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight request between simultaneous callers", async () => {
    // This is the case that actually happened: the room socket and the editor
    // both ask on the same tick, before either has an answer to cache.
    const spy = mockFetch(() => ({ ok: true, token: "t1" }));
    const [a, b, c] = await Promise.all([
      getCollabToken("page-1"), getCollabToken("page-1"), getCollabToken("page-1"),
    ]);
    expect([a, b, c]).toEqual(["t1", "t1", "t1"]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("keeps pages separate", async () => {
    const spy = mockFetch((url) => ({ ok: true, token: url.includes("page-1") ? "t1" : "t2" }));
    expect(await getCollabToken("page-1")).toBe("t1");
    expect(await getCollabToken("page-2")).toBe("t2");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failed fetch as a token", async () => {
    // Caching "" for two minutes would keep a page out of realtime long after
    // the blip that caused it had passed.
    const spy = mockFetch(() => ({ ok: false }));
    expect(await getCollabToken("page-1")).toBe("");
    expect(await getCollabToken("page-1")).toBe("");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("recovers on the next call after a failure", async () => {
    let first = true;
    mockFetch(() => (first ? ((first = false), { ok: false }) : { ok: true, token: "good" }));
    expect(await getCollabToken("page-1")).toBe("");
    expect(await getCollabToken("page-1")).toBe("good");
  });

  it("returns empty rather than throwing when fetch rejects", async () => {
    g.fetch = (async () => { throw new Error("offline"); }) as unknown as typeof fetch;
    await expect(getCollabToken("page-1")).resolves.toBe("");
  });

  it("re-fetches once the token has aged past its safety margin", async () => {
    const spy = mockFetch(() => ({ ok: true, token: "t1" }));
    await getCollabToken("page-1");

    // Tokens live 2 minutes and are only reused with 30s to spare, so at
    // 1m40s the cached one must no longer be handed out. Spied rather than
    // reassigned: swapping Date.now around an await is a genuine race, and
    // eslint is right to say so.
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 100_000);
    try {
      await getCollabToken("page-1");
    } finally {
      clock.mockRestore();
    }
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("forgetCollabToken drops a single page", async () => {
    const spy = mockFetch(() => ({ ok: true, token: "t1" }));
    await getCollabToken("page-1");
    forgetCollabToken("page-1");
    await getCollabToken("page-1");
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
