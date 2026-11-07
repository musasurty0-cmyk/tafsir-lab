/**
 * POST /api/auth/session
 *
 * Exchanges a Firebase ID token for our own session cookie.
 * Called immediately after the client-side Google sign-in succeeds.
 *
 * Body: { idToken: string }
 *
 * On success:
 *   - Verifies the token with Firebase Admin
 *   - Finds or creates the User row in Postgres (keyed on firebaseUid)
 *   - Mints a 30-day signed JWT and sets it as an httpOnly cookie
 *   - Returns { ok: true, userId }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken }       from "@/lib/firebase/admin";
import { createSession }             from "@/lib/session";
import { db }                        from "@/lib/db";
import { verifyBetaCookie, BETA_COOKIE } from "@/lib/beta/gate";

export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json() as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: "idToken is required" }, { status: 400 });
    }

    // 1. Verify the Firebase token
    const decoded = await verifyFirebaseToken(idToken);
    const { uid, email, name, picture } = decoded;

    if (!email) {
      return NextResponse.json({ error: "Account has no email" }, { status: 400 });
    }

    // 2. Find or create the User row
    let user = await db.user.findFirst({
      where: {
        OR: [
          { firebaseUid: uid },
          { email },           // link existing account on first Google sign-in
        ],
      },
    });

    if (user) {
      // Patch firebaseUid + avatar if missing
      if (!user.firebaseUid || user.avatarUrl !== (picture ?? null)) {
        user = await db.user.update({
          where: { id: user.id },
          data:  {
            firebaseUid: user.firebaseUid ?? uid,
            avatarUrl:   picture ?? user.avatarUrl,
          },
        });
      }
    } else {
      // Brand new user — the private-beta access code is required to create an
      // account. Existing users (matched above) are never asked again; this
      // only stops a fresh Google account signing up without the code, the
      // same gate /login enforces for the page. The cookie is set by
      // /api/beta/unlock when the landing-page code is accepted.
      if (!verifyBetaCookie(req.cookies.get(BETA_COOKIE)?.value)) {
        return NextResponse.json(
          { error: "An access code is required to join the private beta." },
          { status: 403 },
        );
      }

      // Create with a default private workspace
      user = await db.user.create({
        data: {
          email,
          firebaseUid: uid,
          name:        name ?? email.split("@")[0],
          avatarUrl:   picture ?? null,
        },
      });

      const workspace = await db.workspace.create({
        data: {
          name:       "My workspace",
          type:       "private",
          ownerId:    user.id,
          inviteCode: `${uid.slice(0, 8)}-${Date.now()}`,
        },
      });

      await db.workspaceMember.create({
        data: { workspaceId: workspace.id, userId: user.id, role: "owner" },
      });
    }

    // 3. Set session cookie
    await createSession(user.id);

    return NextResponse.json({ ok: true, userId: user.id });
  } catch (err) {
    console.error("[auth/session]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Authentication failed" },
      { status: 401 }
    );
  }
}
