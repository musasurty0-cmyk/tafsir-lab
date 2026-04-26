/**
 * POST /api/workspaces/[workspaceId]/surahs
 *
 * Starts studying a surah in this workspace.
 * Idempotent: returns existing session if already started.
 *
 * Body: { surahNumber: number, templateId?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { workspaceId } = await params;
    const body = await req.json() as { surahNumber?: number; templateId?: string };

    if (!body.surahNumber || typeof body.surahNumber !== "number") {
      return NextResponse.json({ error: "surahNumber is required" }, { status: 400 });
    }

    const session = await WorkspacesService.startSurah(
      workspaceId,
      body.surahNumber,
      userId,
      body.templateId
    );

    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    if (err instanceof WorkspacesService.WorkspaceError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 409;
      return NextResponse.json({ error: err.message }, { status });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
