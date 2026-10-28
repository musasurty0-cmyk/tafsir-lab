/**
 * POST /api/pages/[pageId]/ink-mark — this page now has ink.
 *
 * Ink is stored in the page's realtime room, not the database; the room tells
 * the browser when a save was the page's first, and the browser marks it here
 * (Page.inkAt), so a sūrah with only handwriting still counts as started.
 * Set once; later calls change nothing.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { assertPageAccess } from "@/lib/services/pages.service";
import { apiError } from "@/lib/api-errors";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    await assertPageAccess(pageId, userId);
    await db.page.updateMany({ where: { id: pageId, inkAt: null }, data: { inkAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
