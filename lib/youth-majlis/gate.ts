/**
 * Youth Majlis — the two password gates.
 *
 * The portal is private to the cohort, and its ʿIlmī section to four of them,
 * so each area has a password. They are checked on the SERVER: the password
 * never reaches the browser, and the page itself is not sent until the gate
 * is passed. Passing it sets an httpOnly cookie holding an HMAC of the area
 * and the password, signed with SESSION_SECRET — so it cannot be forged, and
 * changing a password in the environment signs everyone out of that area.
 *
 * Passwords come from YOUTH_MAJLIS_PASSWORD / YOUTH_MAJLIS_ILMI_PASSWORD, with
 * the agreed passwords as the fallback. Compared case-insensitively: a phone
 * capitalises the first letter of whatever is typed into a field.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type GateArea = "majlis" | "ilmi";

const COOKIE: Record<GateArea, string> = { majlis: "ym-majlis", ilmi: "ym-ilmi" };
const MAX_AGE = 60 * 60 * 24 * 120; // a term and a half

function password(area: GateArea): string {
  const v = area === "majlis"
    ? process.env.YOUTH_MAJLIS_PASSWORD ?? "youthmajlis"
    : process.env.YOUTH_MAJLIS_ILMI_PASSWORD ?? "Usool";
  return v.trim().toLowerCase();
}

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return s;
}

function token(area: GateArea): string {
  return createHmac("sha256", secret()).update(`youth-majlis:${area}:${password(area)}`).digest("base64url");
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
  if (!same(typed.trim().toLowerCase(), password(area))) return false;
  const jar = await cookies();
  jar.set(COOKIE[area], token(area), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   MAX_AGE,
  });
  return true;
}

/** Leave: forget both areas on this device. */
export async function lock(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE.majlis);
  jar.delete(COOKIE.ilmi);
}
