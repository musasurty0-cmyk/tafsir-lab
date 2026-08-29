/**
 * GET    /api/friends            — this user's connections (accepted + pending)
 * GET    /api/friends?q=<term>   — people to add
 * POST   /api/friends            — { targetId }        send/auto-accept
 * PATCH  /api/friends            — { otherId, accept } respond to a request
 * DELETE /api/friends?id=<uuid>  — remove a friendship
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as Social from "@/lib/services/social.service";
import { apiError } from "@/lib/api-errors";

function socialStatus(err: unknown): number | null {
  if (!(err instanceof Social.SocialError)) return null;
  return err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
}

export async function GET(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const q = req.nextUrl.searchParams.get("q");
    if (q != null) return NextResponse.json({ results: await Social.search(userId, q) });
    return NextResponse.json({ friends: await Social.friendsOf(userId) });
  } catch (err) { return apiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const body = await req.json().catch(() => ({})) as { targetId?: unknown };
    if (typeof body.targetId !== "string")
      return NextResponse.json({ error: "targetId is required" }, { status: 400 });

    return NextResponse.json(await Social.request(userId, body.targetId), { status: 201 });
  } catch (err) {
    const s = socialStatus(err);
    if (s) return NextResponse.json({ error: (err as Error).message }, { status: s });
    return apiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const body = await req.json().catch(() => ({})) as { otherId?: unknown; accept?: unknown };
    if (typeof body.otherId !== "string")
      return NextResponse.json({ error: "otherId is required" }, { status: 400 });

    return NextResponse.json(await Social.respond(userId, body.otherId, body.accept !== false));
  } catch (err) {
    const s = socialStatus(err);
    if (s) return NextResponse.json({ error: (err as Error).message }, { status: s });
    return apiError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await Social.remove(userId, id);
    return NextResponse.json({ ok: true });
  } catch (err) { return apiError(err); }
}
