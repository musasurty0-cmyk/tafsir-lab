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
 *
 * In a workspace with private Mushaf boards (Workspace.privateBoards), the
 * page's own room is the shared board, and members may not put Mushaf ink on
 * it (canvasWrite: false); their handwriting on the text stays allowed.
 * `?board=<userId>` asks instead for that person's own board, the room
 * "<pageId>.u.<userId>": your own to write on, or anyone's to look at if you
 * are an admin.
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

const isAdminRole = (role: string) => role === "owner" || role === "admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> },
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    const { role } = await assertPageAccess(pageId, userId);

    const page = await db.page.findUnique({
      where: { id: pageId }, select: { workspaceSurah: { select: { workspace: { select: { id: true, privateBoards: true } } } } },
    });
    const ws = page?.workspaceSurah.workspace;
    const board = req.nextUrl.searchParams.get("board");
    let room = pageId;
    let tokenRole: string = role;
    let canvasWrite = true;
    if (board) {
      if (!ws?.privateBoards || !/^[0-9a-f-]{36}$/i.test(board)) {
        return NextResponse.json({ error: "This workspace has no private boards." }, { status: 400 });
      }
      if (board !== userId) {
        // Only admins may look at someone else's board, and only someone in this workspace's.
        if (!isAdminRole(role)) return NextResponse.json({ error: "That board is private." }, { status: 403 });
        const theirs = await db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId: ws.id, userId: board } }, select: { userId: true } });
        if (!theirs) return NextResponse.json({ error: "No such board." }, { status: 404 });
        tokenRole = "viewer";                  // looks, never writes
      }
      room = `${pageId}.u.${board}`;
    } else if (ws?.privateBoards && !isAdminRole(role)) {
      canvasWrite = false;                     // the shared board is the admins'
    }

    /* The name labels this person's ink for others on the page, now that
       ink is stored in the page's room rather than beside the user record. */
    const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
    const token = await new SignJWT({ room, uid: userId, role: tokenRole, name: user?.name ?? "", ...(canvasWrite ? {} : { canvasWrite: false }) })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("2m")
      .sign(collabSecret());

    return NextResponse.json({ token });
  } catch (err) {
    return apiError(err);
  }
}
