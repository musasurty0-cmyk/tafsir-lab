/**
 * GET    /api/bookmarks           — the user's saved places, newest first
 * POST   /api/bookmarks           — { pageId, label?, surahNumber?, ayahNumber?, mushafPage? }
 * DELETE /api/bookmarks?id=<uuid> — remove one
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as Bookmarks from "@/lib/services/bookmarks.service";
import { apiError } from "@/lib/api-errors";

/** null for absent/invalid, a number otherwise — never NaN. */
function num(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export async function GET() {
  try {
    const { userId } = await getSession();
    return NextResponse.json({ bookmarks: await Bookmarks.listBookmarks(userId) });
  } catch (err) { return apiError(err); }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    if (typeof body.pageId !== "string")
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });

    const created = await Bookmarks.addBookmark(userId, {
      pageId:      body.pageId,
      label:       typeof body.label === "string" ? body.label : undefined,
      surahNumber: num(body.surahNumber),
      ayahNumber:  num(body.ayahNumber),
      mushafPage:  num(body.mushafPage),
    });

    // Null means the page does not exist OR is not theirs. One answer for both,
    // so this cannot be used to probe which page ids are real.
    if (!created) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    return NextResponse.json({ bookmark: created }, { status: 201 });
  } catch (err) { return apiError(err); }
}

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await getSession();
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

    const gone = await Bookmarks.removeBookmark(userId, id);
    if (!gone) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) { return apiError(err); }
}
