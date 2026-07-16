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
import { randomBytes } from "crypto";

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

/**
 * Whether the acting role may create / rename / delete pages.
 * Admins always can; members can only when the workspace has opted in via
 * its membersCanManagePages flag.
 */
export function canManagePages(role: MemberRole, membersCanManagePages: boolean): boolean {
  return isAdmin(role) || membersCanManagePages;
}

/**
 * Capability matrix for a role. Single source of truth for both the
 * server-side gates and the client UI (settings panel, button visibility).
 *
 * Policy:
 *   Admins (owner + admin) manage structure — create/rename/delete pages
 *   and create surah boards. Members write: page content, notes, drawings,
 *   text boxes, and progress. Page management can be extended to members
 *   per-workspace via the membersCanManagePages flag.
 */
export interface RoleCapabilities {
  managePages:  boolean;  // create / rename / delete pages
  manageBoards: boolean;  // start new surah boards
  manageMembers: boolean; // invite / promote / remove
  writeContent: boolean;  // edit page content, notes, drawings, progress
}

export function capabilitiesFor(role: MemberRole, membersCanManagePages = false): RoleCapabilities {
  const admin = isAdmin(role);
  return {
    managePages:   canManagePages(role, membersCanManagePages),
    manageBoards:  admin,         // board creation stays admin-only
    manageMembers: admin,
    writeContent:  true,          // every member can write
  };
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
): Promise<{ workspace: { id: string; name: string; type: string; kind: string; ownerId: string; membersCanManagePages: boolean }; role: MemberRole }> {
  const [workspace, membership] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, type: true, kind: true, ownerId: true, membersCanManagePages: true },
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
  kind: "study" | "boards" = "study",
) {
  const workspace = await db.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: { name: name.trim(), type, kind, ownerId: userId },
    });
    await tx.workspaceMember.create({
      data: { workspaceId: ws.id, userId, role: "owner" },
    });
    // Boards workspace: scaffold the sentinel board container + a first board
    // so the user lands on something usable instead of an empty list.
    if (kind === "boards") {
      const container = await tx.workspaceSurah.create({
        data: { workspaceId: ws.id, surahNumber: 0 },
      });
      await tx.page.create({
        data: { workspaceSurahId: container.id, title: "Board 1", orderIndex: 0, status: "draft", createdById: userId },
      });
    }
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
 * Set whether members may manage pages (create/rename/delete).
 * Admins (owner + admin) may change this policy.
 */
export async function setMembersCanManagePages(
  workspaceId: string,
  userId: string,
  value: boolean,
) {
  const { role } = await getWorkspaceWithRole(workspaceId, userId);
  if (!isAdmin(role)) {
    throw new WorkspaceError("Only admins can change permissions", "FORBIDDEN");
  }

  const updated = await db.workspace.update({
    where: { id: workspaceId },
    data:  { membersCanManagePages: value },
    select: { id: true, membersCanManagePages: true },
  });

  void log({
    workspaceId,
    userId,
    action:     "workspace.permissions_changed",
    entityType: "workspace",
    entityId:   workspaceId,
    metadata:   { membersCanManagePages: value },
  });

  return updated;
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
  const { role } = await getWorkspaceWithRole(workspaceId, userId);

  // Return existing session if already started — opening a board members
  // can already see is harmless and stays open to everyone.
  const existing = await db.workspaceSurah.findUnique({
    where: { workspaceId_surahNumber: { workspaceId, surahNumber } },
    include: { pages: { orderBy: { orderIndex: "asc" } } },
  });
  if (existing) return existing;

  // Permissions: only admins may create a new surah board. Members study
  // within boards admins have set up; they don't create structure.
  if (!isAdmin(role)) {
    throw new WorkspaceError("Only admins can start a new surah board", "FORBIDDEN");
  }

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

// ── Invite codes ──────────────────────────────────────────────

function generateInviteCode(): string {
  return randomBytes(5).toString("hex").toUpperCase(); // 10-char uppercase hex
}

export async function regenerateInviteCode(workspaceId: string, userId: string): Promise<string> {
  const { role } = await getWorkspaceWithRole(workspaceId, userId);
  if (!isAdmin(role)) throw new WorkspaceError("Only admins can regenerate invite codes", "FORBIDDEN");
  const code = generateInviteCode();
  await db.workspace.update({ where: { id: workspaceId }, data: { inviteCode: code } });
  return code;
}

export async function joinByInviteCode(code: string, userId: string) {
  const workspace = await db.workspace.findUnique({ where: { inviteCode: code } });
  if (!workspace) throw new WorkspaceError("Invalid invite code", "NOT_FOUND");
  if (workspace.type !== "group") throw new WorkspaceError("This workspace is private", "FORBIDDEN");

  const existing = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId } },
  });
  if (existing) throw new WorkspaceError("Already a member", "CONFLICT");

  await db.workspaceMember.create({
    data: { workspaceId: workspace.id, userId, role: "member" },
  });
  return workspace;
}

export async function listMembers(workspaceId: string, userId: string) {
  await getWorkspaceWithRole(workspaceId, userId); // verify membership
  return db.workspaceMember.findMany({
    where: { workspaceId },
    include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { joinedAt: "asc" },
  });
}

export async function setMemberRole(
  workspaceId: string,
  targetUserId: string,
  newRole: "admin" | "member",
  actingUserId: string
) {
  const [{ role: actingRole }, target] = await Promise.all([
    getWorkspaceWithRole(workspaceId, actingUserId),
    db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetUserId } } }),
  ]);
  if (actingRole !== "owner") throw new WorkspaceError("Only the owner can change roles", "FORBIDDEN");
  if (!target) throw new WorkspaceError("Member not found", "NOT_FOUND");
  if (target.role === "owner") throw new WorkspaceError("Cannot change owner role", "FORBIDDEN");
  return db.workspaceMember.update({
    where: { workspaceId_userId: { workspaceId, userId: targetUserId } },
    data: { role: newRole },
  });
}

export async function removeMember(workspaceId: string, targetUserId: string, actingUserId: string) {
  const [{ role: actingRole }, target] = await Promise.all([
    getWorkspaceWithRole(workspaceId, actingUserId),
    db.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId: targetUserId } } }),
  ]);
  if (!isAdmin(actingRole)) throw new WorkspaceError("Only admins can remove members", "FORBIDDEN");
  if (!target) throw new WorkspaceError("Member not found", "NOT_FOUND");
  if (target.role === "owner") throw new WorkspaceError("Cannot remove the owner", "FORBIDDEN");
  await db.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId: targetUserId } } });
}

export async function leaveWorkspace(workspaceId: string, userId: string) {
  const { role } = await getWorkspaceWithRole(workspaceId, userId);
  if (role === "owner") throw new WorkspaceError("Owner cannot leave — transfer ownership first", "FORBIDDEN");
  await db.workspaceMember.delete({ where: { workspaceId_userId: { workspaceId, userId } } });
}

export async function deleteWorkspace(workspaceId: string, userId: string) {
  const { role } = await getWorkspaceWithRole(workspaceId, userId);
  if (role !== "owner") throw new WorkspaceError("Only the owner can delete the workspace", "FORBIDDEN");
  await db.workspace.delete({ where: { id: workspaceId } });
}

export async function ensureInviteCode(workspaceId: string): Promise<string> {
  const ws = await db.workspace.findUnique({ where: { id: workspaceId }, select: { inviteCode: true } });
  if (ws?.inviteCode) return ws.inviteCode;
  const code = generateInviteCode();
  await db.workspace.update({ where: { id: workspaceId }, data: { inviteCode: code } });
  return code;
}
