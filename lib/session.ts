/**
 * Session layer — JWT stored in an httpOnly cookie.
 *
 * Flow:
 *   1. User signs in with Google via Firebase (client-side).
 *   2. Client POSTs the Firebase ID token to /api/auth/session.
 *   3. Server verifies with Firebase Admin, finds/creates the User row,
 *      then mints our own 30-day JWT and sets it as a cookie.
 *   4. Every subsequent server request reads this cookie to get userId.
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "tl-session";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET env var is not set");
  return new TextEncoder().encode(s);
}

export interface Session {
  userId: string;
}

// ── Read ──────────────────────────────────────────────────────────────────

export async function getSession(): Promise<Session> {
  const jar   = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) throw new Error("Not authenticated");

  try {
    const { payload } = await jwtVerify(token, secret());
    const userId = payload.uid as string | undefined;
    if (!userId) throw new Error("Malformed session token");
    return { userId };
  } catch {
    throw new Error("Invalid or expired session");
  }
}

export async function getSessionOrNull(): Promise<Session | null> {
  try { return await getSession(); } catch { return null; }
}

// ── Write ─────────────────────────────────────────────────────────────────

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   30 * 24 * 60 * 60,
    path:     "/",
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
