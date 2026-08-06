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

/**
 * A real "you are not signed in", carrying a code rather than a message.
 *
 * apiError used to recognise these by matching the message against
 * /not authenticated|expired session|invalid/i. That bare `invalid` also
 * matched Prisma, whose errors read "Invalid `prisma.user.create()`
 * invocation" — so ANY database failure came back as 401 "Not authenticated",
 * on the one branch of apiError that does not log. A broken database looked
 * exactly like a signed-out user, and left no trace to say otherwise.
 * "Malformed session token" meanwhile matched nothing and 500'd.
 */
export class SessionError extends Error {
  readonly code = "UNAUTHORIZED";
  constructor(message: string) {
    super(message);
    this.name = "SessionError";
  }
}

// ── Read ──────────────────────────────────────────────────────────────────

export async function getSession(): Promise<Session> {
  const jar   = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) throw new SessionError("Not authenticated");

  /* Resolved BEFORE the try. Inside it, an unset SESSION_SECRET was caught by
     the catch below and rethrown as "Invalid or expired session" — so a
     missing env var in a fresh deploy presented as every user being signed
     out, with the actual cause nowhere on screen or in the log. */
  const key = secret();

  try {
    const { payload } = await jwtVerify(token, key);
    const userId = payload.uid as string | undefined;
    if (!userId) throw new SessionError("Malformed session token");
    return { userId };
  } catch (err) {
    if (err instanceof SessionError) throw err;
    throw new SessionError("Invalid or expired session");
  }
}

export async function getSessionOrNull(): Promise<Session | null> {
  try { return await getSession(); } catch { return null; }
}

// ── Write ─────────────────────────────────────────────────────────────────

export async function createSession(
  userId: string,
  opts: { ephemeral?: boolean } = {},
): Promise<void> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(opts.ephemeral ? "12h" : "30d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Ephemeral (demo) sessions get a BROWSER-SESSION cookie — no maxAge —
    // so closing the browser ends the demo.
    ...(opts.ephemeral ? {} : { maxAge: 30 * 24 * 60 * 60 }),
    path:     "/",
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
