/**
 * activity.service
 *
 * Fire-and-forget audit log. Called by other services after mutations.
 * Never throws — a logging failure must never break the caller's response.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ActivityAction =
  | "workspace.created"
  | "member.joined"   | "member.removed"
  | "surah.started"
  | "page.created"    | "page.published" | "page.archived"
  | "progress.set"
  | "note.created"    | "note.updated"   | "note.deleted"
  | "ayah.collapsed"  | "ayah.expanded"
  | "drawing.saved";

export type EntityType =
  | "workspace" | "workspace_surah"
  | "page" | "note"
  | "ayah_progress" | "drawing";

interface LogParams {
  workspaceId: string;
  userId:      string;
  action:      ActivityAction;
  entityType:  EntityType;
  entityId?:   string;
  metadata?:   Record<string, unknown>;
}

export async function log(p: LogParams): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        workspaceId: p.workspaceId,
        userId:      p.userId,
        action:      p.action,
        entityType:  p.entityType,
        entityId:    p.entityId ?? null,
        metadata:    p.metadata != null ? (p.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch {
    // Intentionally swallowed — logging must never block the main path.
  }
}
