/**
 * progress.service
 *
 * Two completely separate tables, two completely separate code paths.
 *
 * PersonalAyahProgress
 *   - One record per (page, user, surah, ayah)
 *   - No direction restriction. User can freely move between any status.
 *
 * GroupAyahProgress
 *   - One record per (page, surah, ayah) — shared group state
 *   - Direction rule enforced here (not in DB):
 *       members  → can only advance  (rank must increase)
 *       admin+   → can set any status in any direction
 *   - lastChangedBy records who made the last change (accountability)
 */

import { db } from "@/lib/db";
import { getWorkspaceWithRole, isAdmin } from "./workspaces.service";
import { PageError } from "./pages.service";
import { log } from "./activity.service";

// ── Error type ────────────────────────────────────────────────

export class ProgressError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "FORBIDDEN"
  ) {
    super(message);
    this.name = "ProgressError";
  }
}

// ── Status helpers ────────────────────────────────────────────

export type ProgressStatus = "not_studied" | "pending" | "studied";

const STATUS_RANK: Record<ProgressStatus, number> = {
  not_studied: 0,
  pending:     1,
  studied:     2,
};

function isValidStatus(s: string): s is ProgressStatus {
  return s in STATUS_RANK;
}

function isAdvancing(from: ProgressStatus | null, to: ProgressStatus): boolean {
  const fromRank = from !== null ? STATUS_RANK[from] : -1;
  return STATUS_RANK[to] > fromRank;
}

// ── Internal page → workspace resolver ───────────────────────

async function resolveWorkspaceId(pageId: string): Promise<string> {
  const page = await db.page.findUnique({
    where: { id: pageId },
    select: { workspaceSurah: { select: { workspaceId: true } } },
  });
  if (!page) throw new PageError("Page not found", "NOT_FOUND");
  return page.workspaceSurah.workspaceId;
}

// ── Personal progress ─────────────────────────────────────────

export async function setPersonalProgress(
  pageId:      string,
  userId:      string,
  surahNumber: number,
  ayahNumber:  number,
  status:      string
) {
  if (!isValidStatus(status)) {
    throw new ProgressError(
      `Invalid status "${status}". Must be not_studied | pending | studied`,
      "FORBIDDEN"
    );
  }

  const workspaceId = await resolveWorkspaceId(pageId);
  // Confirm user is a workspace member (no direction check for personal).
  await getWorkspaceWithRole(workspaceId, userId);

  const record = await db.personalAyahProgress.upsert({
    where: {
      pageId_userId_surahNumber_ayahNumber: { pageId, userId, surahNumber, ayahNumber },
    },
    update: { status },
    create: { pageId, userId, surahNumber, ayahNumber, status },
  });

  void log({
    workspaceId, userId,
    action:     "progress.set",
    entityType: "ayah_progress",
    entityId:   record.id,
    metadata:   { scope: "personal", surahNumber, ayahNumber, status },
  });

  return record;
}

export async function getPersonalProgress(
  pageId: string,
  userId: string
): Promise<Map<string, ProgressStatus>> {
  const workspaceId = await resolveWorkspaceId(pageId);
  await getWorkspaceWithRole(workspaceId, userId);

  const records = await db.personalAyahProgress.findMany({
    where: { pageId, userId },
    select: { surahNumber: true, ayahNumber: true, status: true },
  });

  return new Map(
    records.map((r) => [`${r.surahNumber}:${r.ayahNumber}`, r.status as ProgressStatus])
  );
}

// ── Group progress ────────────────────────────────────────────

export async function setGroupProgress(
  pageId:      string,
  userId:      string,
  surahNumber: number,
  ayahNumber:  number,
  status:      string
) {
  if (!isValidStatus(status)) {
    throw new ProgressError(
      `Invalid status "${status}". Must be not_studied | pending | studied`,
      "FORBIDDEN"
    );
  }

  const workspaceId = await resolveWorkspaceId(pageId);
  const { role } = await getWorkspaceWithRole(workspaceId, userId);

  // Read current group status for direction check.
  const existing = await db.groupAyahProgress.findUnique({
    where: { pageId_surahNumber_ayahNumber: { pageId, surahNumber, ayahNumber } },
    select: { status: true, id: true },
  });

  const currentStatus = existing?.status as ProgressStatus | null;

  if (!isAdvancing(currentStatus, status) && !isAdmin(role)) {
    throw new ProgressError(
      "Members can only advance group progress. " +
      "Ask an admin to reverse it.",
      "FORBIDDEN"
    );
  }

  const record = await db.groupAyahProgress.upsert({
    where: {
      pageId_surahNumber_ayahNumber: { pageId, surahNumber, ayahNumber },
    },
    update: { status, lastChangedBy: userId },
    create: { pageId, surahNumber, ayahNumber, status, lastChangedBy: userId },
  });

  void log({
    workspaceId, userId,
    action:     "progress.set",
    entityType: "ayah_progress",
    entityId:   record.id,
    metadata:   {
      scope: "group",
      surahNumber, ayahNumber,
      from: currentStatus,
      to:   status,
    },
  });

  return record;
}

export async function getGroupProgress(
  pageId: string,
  // userId is used only for workspace membership verification.
  // Group progress is shared state — the query is NOT filtered by userId.
  userId: string
): Promise<Map<string, { status: ProgressStatus; lastChangedBy: string }>> {
  const workspaceId = await resolveWorkspaceId(pageId);
  await getWorkspaceWithRole(workspaceId, userId);

  const records = await db.groupAyahProgress.findMany({
    where: { pageId },
    select: { surahNumber: true, ayahNumber: true, status: true, lastChangedBy: true },
  });

  return new Map(
    records.map((r) => [
      `${r.surahNumber}:${r.ayahNumber}`,
      { status: r.status as ProgressStatus, lastChangedBy: r.lastChangedBy },
    ])
  );
}
