/**
 * Private-beta access code — the gate in front of sign-in.
 *
 * The landing page's "Open Tafsir Lab" / "Sign in" asks for an access code.
 * This used to be checked in public/landing.js (the code sat in that public
 * file and /login was reachable directly, so it stopped nobody). Now the code
 * is checked on the server and passing it sets an httpOnly cookie holding an
 * HMAC of the code signed with SESSION_SECRET — unforgeable, and rotating the
 * code signs every device out. /login (via proxy.ts) and new-account creation
 * (app/api/auth/session) both require it.
 *
 * The code comes from BETA_CODE. It falls back to the value that shipped in
 * the public bundle so a deploy without the env var set does not lock sign-in;
 * set BETA_CODE in the environment to rotate to a secret one. Compared
 * case-insensitively — a phone capitalises the first letter of a field.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const BETA_COOKIE = "tl-beta";
export const BETA_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/** The access code: BETA_CODE, else the value that was already public. */
function code(): string {
  return (process.env.BETA_CODE?.trim() || "READY2027").toLowerCase();
}

/** The cookie value that proves the code was entered. */
export function betaToken(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return createHmac("sha256", s).update(`beta:${code()}`).digest("base64url");
}

function sameString(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Did the visitor type the right code? Case- and whitespace-insensitive. */
export function codeMatches(typed: string): boolean {
  return sameString((typed ?? "").trim().toLowerCase(), code());
}

/** Verify a raw cookie value. Pure — safe to call from the proxy (no next/headers). */
export function verifyBetaCookie(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    return sameString(value, betaToken());
  } catch {
    return false;
  }
}
