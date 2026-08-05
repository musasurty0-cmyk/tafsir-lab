/**
 * GET    /api/pages/[pageId]  — fetch full page
 * PATCH  /api/pages/[pageId]  — rename  { title: string }
 * DELETE /api/pages/[pageId]  — permanently delete
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as PagesService from "@/lib/services/pages.service";
import { apiError } from "@/lib/api-errors";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    const page = await PagesService.getPage(pageId, userId);
    return NextResponse.json({ page });
  } catch (err) { return apiError(err); }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    const body = await req.json() as { title?: string };
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const page = await PagesService.renamePage(pageId, userId, body.title);
    return NextResponse.json({ page });
  } catch (err) { return apiError(err); }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    await PagesService.deletePage(pageId, userId);
    return NextResponse.json({ ok: true });
  } catch (err) { return apiError(err); }
}
