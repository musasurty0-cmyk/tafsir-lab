/**
 * GET /api/pages/[pageId]
 *
 * Returns a single page with full content.
 * Draft visibility rules are enforced in pages.service.
 * Returns NOT_FOUND (not FORBIDDEN) for invisible drafts.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as PagesService from "@/lib/services/pages.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;

    const page = await PagesService.getPage(pageId, userId);

    return NextResponse.json({ page });
  } catch (err) {
    if (err instanceof PagesService.PageError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
