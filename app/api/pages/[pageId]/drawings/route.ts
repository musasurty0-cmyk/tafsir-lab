/**
 * GET /api/pages/[pageId]/drawings[?mine=…&others=…]
 * PUT /api/pages/[pageId]/drawings   { strokes, surface?, deletedIds?, base? }
 *
 * Kept only for tabs opened before ink moved: they still call this. Ink now
 * lives in the page's realtime room on Cloudflare (party/ink.ts), and the
 * browser reads and saves it there directly (lib/collab/ink-client). This
 * checks membership as before, then forwards to the room with a token it
 * signs itself, unchanged in either direction: same replies, same merge.
 */

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { assertPageAccess } from "@/lib/services/pages.service";
import { apiError } from "@/lib/api-errors";
import { PARTYKIT_HOST } from "@/lib/collab/config";

async function roomUrl(pageId: string, userId: string, role: string, q: URLSearchParams): Promise<string> {
  const s = process.env.COLLAB_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error("COLLAB_SECRET / SESSION_SECRET is not set");
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  const token = await new SignJWT({ room: pageId, uid: userId, role, name: user?.name ?? "" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2m")
    .sign(new TextEncoder().encode(s));
  q.set("token", token);
  const local = /^(localhost|127\.0\.0\.1)(:|$)/.test(PARTYKIT_HOST);
  return `${local ? "http" : "https"}://${PARTYKIT_HOST}/parties/main/${encodeURIComponent(pageId)}/ink?${q}`;
}

const relay = async (res: Response) =>
  new NextResponse(await res.text(), {
    status:  res.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export async function GET(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    const { role } = await assertPageAccess(pageId, userId);
    const q = new URLSearchParams();
    for (const k of ["mine", "others"]) { const v = req.nextUrl.searchParams.get(k); if (v) q.set(k, v); }
    return relay(await fetch(await roomUrl(pageId, userId, role, q), { cache: "no-store" }));
  } catch (err) {
    return apiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    const { role } = await assertPageAccess(pageId, userId);
    const res = await fetch(await roomUrl(pageId, userId, role, new URLSearchParams()), {
      method:  "POST",
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body:    await req.text(),
    });
    // Mark the page's first ink, as the browser path does (see ink-mark).
    const text = await res.text();
    if (res.ok && text.includes('"first":true')) {
      await db.page.updateMany({ where: { id: pageId, inkAt: null }, data: { inkAt: new Date() } });
    }
    return new NextResponse(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    return apiError(err);
  }
}
