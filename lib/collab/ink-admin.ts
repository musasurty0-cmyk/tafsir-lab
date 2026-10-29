/**
 * The app's own operations on ink, which lives in each page's realtime room on
 * Cloudflare (party/ink.ts) rather than in the database. Server-only: signed
 * with the secret the room tokens use, plus an `admin: "ink"` claim that no
 * page token carries.
 *
 * The database used to delete ink by cascade when a page, workspace or demo
 * account went. Nothing ties the rooms to those rows, so whatever deletes
 * them must wipe the ink as well (wipeInk), or it would stay stored, unseen.
 */

import { SignJWT } from "jose";
import { PARTYKIT_HOST } from "./config";

function origin(): string {
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(PARTYKIT_HOST);
  return `${local ? "http" : "https"}://${PARTYKIT_HOST}`;
}

async function call<T>(body: object): Promise<T> {
  const s = process.env.COLLAB_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error("COLLAB_SECRET / SESSION_SECRET is not set");
  const token = await new SignJWT({ admin: "ink" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2m")
    .sign(new TextEncoder().encode(s));
  const res = await fetch(`${origin()}/ink-admin`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`ink-admin ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json() as Promise<T>;
}

/**
 * Remove the ink on these pages: everyone's, or one author's. In batches, so
 * a large workspace is not one enormous request. Never throws: a deletion
 * must not fail because the realtime server is briefly unreachable.
 */
export async function wipeInk(pages: string[], author?: string): Promise<void> {
  for (let i = 0; i < pages.length; i += 50) {
    await call({ op: "wipe", pages: pages.slice(i, i + 50), author })
      .catch((e) => console.error("[ink] wipe failed", e));
  }
}

/**
 * The rooms of people's own Mushaf boards on these pages, in a workspace
 * with private boards ("<pageId>.u.<userId>", lib/collab/ink-client
 * boardRoom). Each is a room of its own, so a deletion wipes them by name.
 */
export const boardRooms = (pages: string[], users: string[]): string[] =>
  pages.flatMap((p) => users.map((u) => `${p}.u.${u}`));

/** Replace one author's ink on a page with a copy (the move off the database). */
export function importInk(page: string, author: string, name: string, updated: number, strokes: object[]) {
  return call<{ ok: boolean; strokes: number }>({ op: "import", page, author, name, updated, strokes });
}

/** What the rooms hold, per author: count, version and stroke ids in order. */
export function inkSummary(pages: string[]) {
  return call<Record<string, { author: string; count: number; updated: number; ids: string }[]>>({ op: "summary", pages });
}
