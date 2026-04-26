/**
 * drawings.service — Phase 2 scope (canvas layer)
 *
 * Per-user CanvasDrawing CRUD. Written ahead of schedule; wired into
 * route handlers and the tldraw canvas in Phase 2. Do not import before that phase.
 */

import { db } from "@/lib/db";
import { getWorkspaceWithRole } from "./workspaces.service";
import { log } from "./activity.service";

export async function getDrawing(pageId: string, authorId: string) {
  return db.canvasDrawing.findUnique({ where: { pageId_authorId: { pageId, authorId } } });
}

export async function getAllDrawings(pageId: string) {
  return db.canvasDrawing.findMany({
    where: { pageId },
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });
}

export async function saveDrawing(pageId: string, authorId: string, strokes: unknown[]) {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { workspaceSurah: { select: { workspaceId: true } } },
  });
  if (!page) return;

  const { workspaceId } = page.workspaceSurah;
  await getWorkspaceWithRole(workspaceId, authorId);

  const drawing = await db.canvasDrawing.upsert({
    where: { pageId_authorId: { pageId, authorId } },
    update: { strokes: strokes as never },
    create: { pageId, authorId, strokes: strokes as never },
  });

  await log({
    workspaceId, userId: authorId,
    action: "drawing.saved", entityType: "drawing", entityId: drawing.id,
    metadata: { strokeCount: strokes.length },
  });

  return drawing;
}

export async function clearDrawing(pageId: string, authorId: string) {
  return db.canvasDrawing.deleteMany({ where: { pageId, authorId } });
}
