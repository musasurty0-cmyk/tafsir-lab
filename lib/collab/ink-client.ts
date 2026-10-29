/**
 * Reading and saving a page's handwriting, from the browser.
 *
 * Ink lives in the page's realtime room on Cloudflare (party/ink.ts), not in
 * the database: it was the largest thing a page read and wrote, and it ran the
 * Supabase plan out of egress and disk IO. The browser talks to the room
 * directly, with the same short-lived token the live connection uses.
 *
 * Reads are plain GETs and saves are POSTs with a text/plain body: neither
 * needs a CORS preflight, so a save sent as the tab closes (keepalive) still
 * goes. The replies are the shapes the old /api/pages/[pageId]/drawings route
 * returned, so the code that merges them did not change.
 *
 * `pageId` may also name a private Mushaf board, "<pageId>.u.<userId>"
 * (boardRoom): that board's own room, with its own token.
 */

import { PARTYKIT_HOST } from "./config";
import { getCollabToken, peekCollabToken } from "./collab-token";
import type { InkSeen } from "@/lib/ink";

/** The room of one person's own Mushaf board on a page (Workspace.privateBoards). */
export const boardRoom = (pageId: string, userId: string) => `${pageId}.u.${userId}`;

function roomUrl(pageId: string, q: URLSearchParams): string {
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(PARTYKIT_HOST);
  return `${local ? "http" : "https"}://${PARTYKIT_HOST}/parties/main/${encodeURIComponent(pageId)}/ink?${q}`;
}

/** The page's ink, less whatever `seen` says is already here. */
export async function readInk(pageId: string, seen?: InkSeen | null): Promise<Response> {
  const q = new URLSearchParams({ token: await getCollabToken(pageId) });
  if (seen?.mine) q.set("mine", seen.mine);
  if (seen?.others) q.set("others", seen.others);
  return fetch(roomUrl(pageId, q), { cache: "no-store" });
}

/**
 * Save strokes and erasures (`body` is the JSON the old route took). With
 * `keepalive`, for a tab that is closing, it goes with the token in hand
 * rather than wait to fetch one.
 */
export async function saveInk(pageId: string, body: string, keepalive = false): Promise<Response> {
  const token = (keepalive ? peekCollabToken(pageId) : null) ?? await getCollabToken(pageId);
  const res = await fetch(roomUrl(pageId, new URLSearchParams({ token })), {
    method:  "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body,
    // The browser refuses a keepalive request over 64 KB outright; past that
    // it goes as an ordinary request.
    keepalive: keepalive && body.length < 60_000,
  });
  if (res.ok) {
    /* The page's first ink: mark it in the database, the one thing there
       that needs to know (a sūrah counts as started if it has ink). */
    res.clone().json()
      .then((j: { first?: boolean }) => { if (j.first) fetch(`/api/pages/${pageId.split(".u.")[0]}/ink-mark`, { method: "POST" }).catch(() => {}); })
      .catch(() => {});
  }
  return res;
}
