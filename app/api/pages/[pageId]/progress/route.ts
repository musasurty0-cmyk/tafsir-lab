/**
 * GET  /api/pages/[pageId]/progress?scope=personal
 * POST /api/pages/[pageId]/progress
 *
 * GET  — returns personal progress map for the acting user on this page.
 *         Returns { progress: Record<"surah:ayah", status> }
 *
 * POST — sets personal or group ayah progress for the acting user.
 *
 * Body (POST):
 *   {
 *     scope:       "personal" | "group"
 *     surahNumber: number
 *     ayahNumber:  number
 *     status:      "not_studied" | "pending" | "studied"
 *   }
 *
 * Permission rules enforced in progress.service:
 *   personal — any workspace member; direction is unrestricted
 *   group    — members may only advance; admin+ may set any direction
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as ProgressService from "@/lib/services/progress.service";
import { PageError } from "@/lib/services/pages.service";
import { apiError } from "@/lib/api-errors";

type ProgressBody = {
  scope?:       string;
  surahNumber?: unknown;
  ayahNumber?:  unknown;
  status?:      unknown;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;
    const scope = req.nextUrl.searchParams.get("scope");

    if (scope === "personal") {
      const map = await ProgressService.getPersonalProgress(pageId, userId);
      return NextResponse.json({ progress: Object.fromEntries(map) });
    }

    if (scope === "group") {
      const map = await ProgressService.getGroupProgress(pageId, userId);
      const plain: Record<string, { status: string; lastChangedBy: string }> = {};
      map.forEach((v, k) => { plain[k] = v; });
      return NextResponse.json({ progress: plain });
    }

    return NextResponse.json(
      { error: 'scope query param must be "personal" or "group"' },
      { status: 400 }
    );
  } catch (err) {
    if (err instanceof ProgressService.ProgressError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "NOT_FOUND" ? 404 : 403 });
    }
    if (err instanceof PageError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return apiError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;

    const body = (await req.json()) as ProgressBody;
    const { scope, surahNumber, ayahNumber, status } = body;

    // Validate required fields.
    if (scope !== "personal" && scope !== "group") {
      return NextResponse.json(
        { error: 'scope must be "personal" or "group"' },
        { status: 400 }
      );
    }
    if (typeof surahNumber !== "number" || surahNumber < 1 || surahNumber > 114) {
      return NextResponse.json({ error: "surahNumber must be 1–114" }, { status: 400 });
    }
    if (typeof ayahNumber !== "number" || ayahNumber < 1) {
      return NextResponse.json({ error: "ayahNumber must be a positive integer" }, { status: 400 });
    }
    if (typeof status !== "string") {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const record =
      scope === "personal"
        ? await ProgressService.setPersonalProgress(pageId, userId, surahNumber, ayahNumber, status)
        : await ProgressService.setGroupProgress(pageId, userId, surahNumber, ayahNumber, status);

    return NextResponse.json({ record }, { status: 200 });
  } catch (err) {
    if (err instanceof ProgressService.ProgressError) {
      const status = err.code === "NOT_FOUND" ? 404 : 403;
      return NextResponse.json({ error: err.message }, { status });
    }
    if (err instanceof PageError) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return apiError(err);
  }
}
