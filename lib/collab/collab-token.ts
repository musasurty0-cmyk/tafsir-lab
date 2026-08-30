"use client";

/**
 * One collab token per page, shared by everything that needs it.
 *
 * Opening a page fetched `/api/pages/<id>/collab-token` three times inside
 * half a second: the room socket asks for one, the editor's Yjs provider asks
 * for its own, and the socket's `query` runs again as it settles. Each is a
 * serverless invocation and a membership check against the database, for a
 * token that is identical every time.
 *
 * Two things happen here. Concurrent callers share one in-flight request
 * rather than racing, and a token already in hand is reused while it is still
 * comfortably valid.
 *
 * The margin matters more than the cache. Tokens last two minutes and the
 * party rejects an expired one, so a token is only reused with THIRTY SECONDS
 * of life left — enough that a slow socket handshake cannot start with a valid
 * token and finish with a dead one. Reconnects still get a fresh token,
 * because by then the cached one has aged out.
 */

interface Entry {
  token:   string;
  expires: number;                 // ms epoch
  inflight?: Promise<string>;
}

const cache = new Map<string, Entry>();

/** Tokens live 2 minutes server-side; never hand out one with less than this. */
const SAFETY_MS = 30_000;
const ASSUMED_TTL_MS = 120_000;

export async function getCollabToken(pageId: string): Promise<string> {
  const now = Date.now();
  const hit = cache.get(pageId);

  if (hit) {
    // Someone else is already asking — wait for theirs instead of adding one.
    if (hit.inflight) return hit.inflight;
    if (hit.token && hit.expires - now > SAFETY_MS) return hit.token;
  }

  const inflight = (async () => {
    try {
      const r = await fetch(`/api/pages/${pageId}/collab-token`, { credentials: "include" });
      if (!r.ok) return "";
      const { token } = await r.json() as { token?: string };
      return token ?? "";
    } catch {
      /* Offline, or the page was closed mid-flight. An empty token makes the
         party refuse the socket, which is the correct outcome — the caller
         retries rather than connecting unauthenticated. */
      return "";
    }
  })();

  cache.set(pageId, { token: hit?.token ?? "", expires: hit?.expires ?? 0, inflight });

  const token = await inflight;
  cache.set(pageId, {
    token,
    // A failed fetch must not be cached as a valid token for two minutes.
    expires: token ? Date.now() + ASSUMED_TTL_MS : 0,
  });
  return token;
}

/** Drop a page's token — for a sign-out, or a membership change. */
export function forgetCollabToken(pageId?: string) {
  if (pageId) cache.delete(pageId);
  else cache.clear();
}
