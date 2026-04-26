/**
 * GET  /api/pages/[pageId]/prefs  — return this user's prefs for the page
 * PATCH /api/pages/[pageId]/prefs  — update collapsedAyahs and/or canvasViewport
 *
 * Both fields are optional on PATCH; only sent keys are updated.
 * The record is upserted — it is created on first write.
 *
 * PATCH body (all fields optional):
 *   {
 *     collapsedAyahs?: number[]              — ayah numbers (Int) to mark as collapsed
 *     canvasViewport?: { x, y, zoom } | null — Mode B viewport; null resets to default
 *   }
 *
 * collapsedAyahs is the SOLE source of truth for ayah collapse state in Mode B.
 * It is never inferred from anchor positions or note visibility.
 */

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as WorkspacesService from "@/lib/services/workspaces.service";

// Resolve the workspaceId from a pageId (needed for auth gate).
async function getWorkspaceIdForPage(pageId: string): Promise<string | null> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { workspaceSurah: { select: { workspaceId: true } } },
  });
  return page?.workspaceSurah.workspaceId ?? null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;

    const workspaceId = await getWorkspaceIdForPage(pageId);
    if (!workspaceId) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    await WorkspacesService.getWorkspaceWithRole(workspaceId, userId);

    const prefs = await db.pageUserPrefs.findUnique({
      where: { pageId_userId: { pageId, userId } },
    });

    return NextResponse.json({
      prefs: prefs ?? { pageId, userId, collapsedAyahs: [], canvasViewport: null },
    });
  } catch (err) {
    if (err instanceof WorkspacesService.WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "NOT_FOUND" ? 404 : 403 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;

    const workspaceId = await getWorkspaceIdForPage(pageId);
    if (!workspaceId) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    await WorkspacesService.getWorkspaceWithRole(workspaceId, userId);

    const body = await req.json() as {
      collapsedAyahs?: unknown;
      canvasViewport?:  unknown;
    };

    // Build partial update — only touch keys that were sent.
    const updateData: {
      collapsedAyahs?: number[];
      canvasViewport?:  Prisma.InputJsonValue | typeof Prisma.JsonNull;
    } = {};

    if (body.collapsedAyahs !== undefined) {
      if (!Array.isArray(body.collapsedAyahs)) {
        return NextResponse.json({ error: "collapsedAyahs must be a number[]" }, { status: 400 });
      }
      updateData.collapsedAyahs = body.collapsedAyahs.filter((v) => typeof v === "number") as number[];
    }

    if ("canvasViewport" in body) {
      updateData.canvasViewport = body.canvasViewport != null
        ? (body.canvasViewport as Prisma.InputJsonValue)
        : Prisma.JsonNull;
    }

    const prefs = await db.pageUserPrefs.upsert({
      where: { pageId_userId: { pageId, userId } },
      update: updateData,
      create: {
        pageId,
        userId,
        collapsedAyahs: updateData.collapsedAyahs ?? [],
        canvasViewport:  updateData.canvasViewport ?? Prisma.JsonNull,
      },
    });

    return NextResponse.json({ prefs });
  } catch (err) {
    if (err instanceof WorkspacesService.WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "NOT_FOUND" ? 404 : 403 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
