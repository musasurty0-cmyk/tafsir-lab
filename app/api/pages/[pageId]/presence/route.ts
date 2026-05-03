import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";

const PRESENCE_TTL_MS = 45_000; // 45 seconds

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    const since = new Date(Date.now() - PRESENCE_TTL_MS);
    const presence = await db.pagePresence.findMany({
      where: { pageId, updatedAt: { gte: since } },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
    return NextResponse.json({ presence, currentUserId: userId });
  } catch {
    return NextResponse.json({ presence: [] });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    const body = await req.json().catch(() => ({})) as {
      isTyping?: boolean;
      cursorFrom?: number | null;
      cursorTo?: number | null;
    };
    const { isTyping = false } = body;

    // Only include cursor fields in the update when they were explicitly sent.
    // PresenceBar pings with { isTyping: false } only — we must not wipe
    // cursor positions that the editor just posted.
    const hasCursor = "cursorFrom" in body;
    const cursorPatch = hasCursor
      ? { cursorFrom: body.cursorFrom ?? null, cursorTo: body.cursorTo ?? null }
      : {};

    await db.pagePresence.upsert({
      where:  { pageId_userId: { pageId, userId } },
      create: { pageId, userId, isTyping, cursorFrom: body.cursorFrom ?? null, cursorTo: body.cursorTo ?? null },
      update: { isTyping, ...cursorPatch, updatedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
