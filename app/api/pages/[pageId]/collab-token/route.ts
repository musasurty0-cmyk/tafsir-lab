/**
 * GET /api/pages/[pageId]/collab-token
 *
 * Mints a short-lived, page-scoped token that authorises a PartyKit realtime
 * connection to this page's room. The realtime server (party/server.ts) has no
 * other way to know who is connecting — cookies are not sent cross-origin to
 * the party host — so without this, anyone who knew a pageId could open a Yjs
 * socket and read or write the live document.
 *
 * The gate is the same one every other page route uses: assertPageAccess runs
 * the caller through workspace membership. The token it returns is deliberately
 * brief (2 minutes) and bound to this one page; the client re-mints on every
 * (re)connect, so losing workspace access takes effect within a couple of
 * minutes rather than lasting a whole session.
 */

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { getSession } from "@/lib/session";
import { assertPageAccess } from "@/lib/services/pages.service";
import { apiError } from "@/lib/api-errors";
import { db } from "@/lib/db";

function collabSecret(): Uint8Array {
  const s = process.env.COLLAB_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error("COLLAB_SECRET / SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    const { role } = await assertPageAccess(pageId, userId);

    /* The name labels this person's ink for others on the page, now that
       ink is stored in the page's room rather than beside the user record. */
    const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
    const token = await new SignJWT({ room: pageId, uid: userId, role, name: user?.name ?? "" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(collabSecret());

    return NextResponse.json({ token });
  } catch (err) {
    return apiError(err);
  }
}
