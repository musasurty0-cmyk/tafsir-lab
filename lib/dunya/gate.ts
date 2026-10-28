/**
 * Dunya — the password in front of the private A-level page.
 *
 * Nothing about the password is in this repository (it is public): the plan's
 * row in DunyaPlan holds an scrypt hash of it, salted, and the check
 * happens here on the server. Passing it sets an httpOnly cookie holding an
 * HMAC of the plan and its hash, signed with SESSION_SECRET, so it cannot be
 * forged and changing the password signs every device out. Compared
 * case-insensitively, as the Youth Majlis gate is: a phone capitalises the
 * first letter of whatever is typed into a field.
 */

import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const PLAN_ID = "main";
const COOKIE = "tl-dunya";
const MAX_AGE = 60 * 60 * 24 * 60;

/** "scrypt$N$r$p$salt$hash", both base64. */
function verify(typed: string, stored: string): boolean {
  const [kind, N, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = scryptSync(typed.trim().toLowerCase(), Buffer.from(salt, "base64"), want.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return got.length === want.length && timingSafeEqual(got, want);
}

function token(passwordHash: string): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return createHmac("sha256", s).update(`dunya:${PLAN_ID}:${passwordHash}`).digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function passwordHash(): Promise<string | null> {
  const row = await db.dunyaPlan.findUnique({ where: { id: PLAN_ID }, select: { passwordHash: true } });
  return row?.passwordHash ?? null;
}

/** Is this visitor through the gate? */
export async function hasAccess(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const h = await passwordHash();
  return !!h && same(v, token(h));
}

/** Check a typed password; on success, remember this device. */
export async function unlock(typed: string): Promise<boolean> {
  const h = await passwordHash();
  if (!h || !verify(typed, h)) return false;
  (await cookies()).set(COOKIE, token(h), {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   MAX_AGE,
  });
  return true;
}

export async function lock(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
