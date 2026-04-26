/**
 * workspaces.service
 *
 * Responsibilities:
 *   - Resolve workspace membership and role for the acting user.
 *     getWorkspaceWithRole() is the gate used by pages.service and
 *     progress.service before any mutation — always call it first.
 *   - List workspaces the user belongs to.
 *   - Start (or return an existing) surah session within a workspace.
 *     When a template is supplied, scaffold pages from template.structure.
 */

import { db } from "@/lib/db";
import { log } from "./activity.service";

// ── Error type ────────────────────────────────────────────────

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "FORBIDDEN" | "CONFLICT"
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

// ── Role type (used across services) ─────────────────────────

export type MemberRole = "owner" | "admin" | "member";

/** True if the role is at least admin level. */
export function isAdmin(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

// ── Queries ───────────────────────────────────────────────────

/**
 * Verify the user is a member of this workspace and return their role.
 * This is the primary access-control gate used by every other service.
 * Throws WorkspaceError NOT_FOUND if workspace doesn't exist.
 * Throws WorkspaceError FORBIDDEN if user is not a member.
 */
export async function getWorkspaceWithRole(
  workspaceId: string,
  userId: string
): Promise<{ workspace: { id: string; name: string; type: string; ownerId: string }; role: MemberRole }> {
  const [workspace, membership] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, type: true, ownerId: true },
    }),
    db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    }),
  ]);

  if (!workspace) {
    throw new WorkspaceError("Workspace not found", "NOT_FOUND");
  }
  if (!membership) {
    throw new WorkspaceError("You are not a member of this workspace", "FORBIDDEN");
  }

  return { workspace, role: membership.role as MemberRole };
}

/**
 * All workspaces the user belongs to, ordered by join date.
 * Includes the user's role and member/surah counts.
 */
export async function listForUser(userId: string) {
  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    orderBy: { joinedAt: "asc" },
    include: {
      workspace: {
        include: {
          _count: { select: { members: true, surahs: true } },
        },
      },
    },
  });

  return memberships.map((m) => ({
    ...m.workspace,
    role: m.role as MemberRole,
  }));
}

// ── Mutations ─────────────────────────────────────────────────

/**
 * Create a new workspace and add the creating user as owner.
 */
export async function createWorkspace(
  userId: string,
  name: string,
  type: "private" | "group",
) {
  const workspace = await db.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: { name: name.trim(), type, ownerId: userId },
    });
    await tx.workspaceMember.create({
      data: { workspaceId: ws.id, userId, role: "owner" },
    });
    return ws;
  });

  void log({
    workspaceId: workspace.id,
    userId,
    action:     "workspace.created",
    entityType: "workspace",
    entityId:   workspace.id,
    metadata:   { name: workspace.name, type },
  });

  return workspace;
}

/**
 * Rename a workspace. Only the owner may do this.
 */
export async function renameWorkspace(
  workspaceId: string,
  userId: string,
  newName: string,
) {
  const { role } = await getWorkspaceWithRole(workspaceId, userId);
  if (role !== "owner") {
    throw new WorkspaceError("Only the workspace owner can rename it", "FORBIDDEN");
  }

  const trimmed = newName.trim();
  if (!trimmed) throw new WorkspaceError("Name cannot be empty", "CONFLICT");
  if (trimmed.length > 80) throw new WorkspaceError("Name is too long (max 80 chars)", "CONFLICT");

  return db.workspace.update({
    where: { id: workspaceId },
    data:  { name: trimmed },
    select: { id: true, name: true, type: true, ownerId: true },
  });
}

/**
 * Start studying a surah in this workspace.
 *
 * Idempotent: if a session already exists, returns it unchanged.
 * If templateId is provided and the session is new, scaffolds pages
 * from template.structure with isAdminAuthored = true on each page.
 */
export async function startSurah(
  workspaceId: string,
  surahNumber: number,
  userId: string,
  templateId?: string
) {
  // Verify membership before any write.
  await getWorkspaceWithRole(workspaceId, userId);

  // Return existing session if already started.
  const existing = await db.workspaceSurah.findUnique({
    where: { workspaceId_surahNumber: { workspaceId, surahNumber } },
    include: { pages: { orderBy: { orderIndex: "asc" } } },
  });
  if (existing) return existing;

  // Create session (and optionally scaffold pages) in a transaction.
  const workspaceSurah = await db.$transaction(async (tx) => {
    const ws = await tx.workspaceSurah.create({
      data: { workspaceId, surahNumber, templateId: templateId ?? null },
    });

    if (templateId) {
      const template = await tx.pageTemplate.findUnique({
        where: { id: templateId },
        select: { structure: true },
      });

      if (template) {
        const slots = template.structure as Array<{
          title: string;
          orderIndex: number;
          isAdminAuthored: boolean;
        }>;

        await tx.page.createMany({
          data: slots.map((slot) => ({
            workspaceSurahId: ws.id,
            title:            slot.title,
            orderIndex:       slot.orderIndex,
            status:           "draft",
            isAdminAuthored:  slot.isAdminAuthored ?? false,
            templateId:       templateId,
            templatePageIdx:  slot.orderIndex,
            createdById:      userId,
          })),
        });
      }
    }

    return tx.workspaceSurah.findUniqueOrThrow({
      where: { id: ws.id },
      include: { pages: { orderBy: { orderIndex: "asc" } } },
    });
  });

  void log({
    workspaceId,
    userId,
    action:     "surah.started",
    entityType: "workspace_surah",
    entityId:   workspaceSurah.id,
    metadata:   { surahNumber, templateId: templateId ?? null },
  });

  return workspaceSurah;
}
