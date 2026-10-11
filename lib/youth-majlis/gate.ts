/**
 * Youth Majlis — the two password gates.
 *
 * The portal is private to the cohort, and its ʿIlmī section to four of them,
 * so each has a password, the ʿIlmī one asked for only once you are inside
 * the portal. They are checked on the SERVER: the password never reaches the
 * browser, and what is behind a gate is not sent until it is passed. Passing
 * one sets an httpOnly cookie holding an HMAC of the area and the password,
 * signed with SESSION_SECRET — so it cannot be forged, and changing a password
 * in the environment signs everyone out of that area.
 *
 * Passwords come from YOUTH_MAJLIS_PASSWORD / YOUTH_MAJLIS_ILMI_PASSWORD. The
 * fallback, for when those are unset, is the agreed passwords stored only as
 * SHA-256 digests: this repository is public, so a password written here in
 * plain text would be readable by anyone. Compared case-insensitively: a phone
 * capitalises the first letter of whatever is typed into a field.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type GateArea = "majlis" | "ilmi";

const COOKIE: Record<GateArea, string> = { majlis: "ym-majlis", ilmi: "ym-ilmi" };
const MAX_AGE = 60 * 60 * 24 * 120; // a term and a half

/** Digests of the agreed passwords, lower-cased, as digest() makes them. */
const AGREED: Record<GateArea, string> = {
  majlis: "f9025ffc53fe61a48723287263656f240cdad3e1c22b5f22cc33e74c40da3f18",
  ilmi:   "773defc89087b3d4377e8c0ef57e60f6496bea88bde5463b6f67a617762a00bc",
};

function digest(pw: string): string {
  return createHash("sha256").update("youth-majlis:" + pw.trim().toLowerCase()).digest("hex");
}

/** The digest a typed password must match. */
function expected(area: GateArea): string {
  const env = area === "majlis" ? process.env.YOUTH_MAJLIS_PASSWORD : process.env.YOUTH_MAJLIS_ILMI_PASSWORD;
  return env ? digest(env) : AGREED[area];
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return s;
}

function token(area: GateArea): string {
  return createHmac("sha256", secret()).update(`youth-majlis:${area}:${expected(area)}`).digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Is this visitor through the gate for `area`? */
export async function hasAccess(area: GateArea): Promise<boolean> {
  const jar = await cookies();
  const v = jar.get(COOKIE[area])?.value;
  return !!v && same(v, token(area));
}

/** Check a typed password; on success, remember the visitor. */
export async function unlock(area: GateArea, typed: string): Promise<boolean> {
  if (!same(digest(typed), expected(area))) return false;
  const jar = await cookies();
  jar.set(COOKIE[area], token(area), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    // The portal is remembered for a term; ʿIlmī only until the browser closes.
    ...(area === "majlis" ? { maxAge: MAX_AGE } : {}),
  });
  return true;
}

/** Leave: forget both areas on this device. */
export async function lock(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE.majlis);
  jar.delete(COOKIE.ilmi);
}
