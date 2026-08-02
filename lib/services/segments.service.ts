/**
 * Segments — user-defined ranges of consecutive āyāt studied as one unit.
 *
 * Every function gates on workspace membership through getWorkspaceWithRole,
 * the same door every other service uses, so a segment can never be read or
 * written across workspace boundaries.
 *
 * Ranges are validated here rather than trusted from the client: a segment
 * with endAyah < startAyah, or one spilling past the surah, would render as a
 * marker spanning nothing and would silently corrupt every consumer.
 */

import { db } from "@/lib/db";
import { getWorkspaceWithRole, isAdmin, type MemberRole } from "./workspaces.service";

export interface SegmentInput {
  surahNumber: number;
  startAyah:   number;
  endAyah:     number;
  title:       string;
  description?: string | null;
  color?:      string | null;
}

export class SegmentError extends Error {
  constructor(message: string, public code: "BAD_RANGE" | "NOT_FOUND" | "FORBIDDEN") {
    super(message);
  }
}

/** Ayah counts per surah, so a range cannot be saved past the end of a surah. */
import { SURAH_AYAH_COUNTS } from "@/lib/quran-meta";

function assertRange(surahNumber: number, startAyah: number, endAyah: number) {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    throw new SegmentError("Surah out of range", "BAD_RANGE");
  }
  const max = SURAH_AYAH_COUNTS[surahNumber - 1];
  if (!Number.isInteger(startAyah) || !Number.isInteger(endAyah)) {
    throw new SegmentError("Ayah numbers must be integers", "BAD_RANGE");
  }
  if (startAyah < 1 || endAyah < 1 || startAyah > max || endAyah > max) {
    throw new SegmentError(`Ayah out of range for surah ${surahNumber} (1–${max})`, "BAD_RANGE");
  }
  if (endAyah < startAyah) {
    throw new SegmentError("End ayah precedes start ayah", "BAD_RANGE");
  }
}

export async function listSegments(
  workspaceId: string, userId: string, surahNumber?: number,
) {
  await getWorkspaceWithRole(workspaceId, userId);
  return db.quranSegment.findMany({
    where: { workspaceId, ...(surahNumber ? { surahNumber } : {}) },
    orderBy: [{ surahNumber: "asc" }, { sortOrder: "asc" }, { startAyah: "asc" }],
  });
}

export async function createSegment(
  workspaceId: string, userId: string, input: SegmentInput,
) {
  await getWorkspaceWithRole(workspaceId, userId);
  assertRange(input.surahNumber, input.startAyah, input.endAyah);

  /* An empty title is meaningful, not missing: a Selection is created the
     moment its whiteboard opens and is NAMED when it is first closed. Filling
     in a placeholder here would make every new Selection look already-named
     and skip the naming step. */
  const title = input.title.trim();

  /* Simultaneous creation of the SAME range by two people is treated as one
     segment rather than two identical ones — the second editor gets the
     existing record. Overlapping ranges remain perfectly legal; only an exact
     duplicate collapses. */
  /* Collapse an exact repeat so two people creating the same Selection at
     once get one record. Unnamed Selections are exempt: two people each
     opening their own scratch whiteboard over the same verses are doing two
     different things, and merging them would hand one person the other's
     canvas. */
  if (title) {
    const existing = await db.quranSegment.findFirst({
      where: {
        workspaceId,
        surahNumber: input.surahNumber,
        startAyah:   input.startAyah,
        endAyah:     input.endAyah,
        title,
      },
    });
    if (existing) return existing;
  }

  const last = await db.quranSegment.findFirst({
    where: { workspaceId, surahNumber: input.surahNumber },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  return db.quranSegment.create({
    data: {
      workspaceId,
      surahNumber: input.surahNumber,
      startAyah:   input.startAyah,
      endAyah:     input.endAyah,
      title,
      description: input.description ?? null,
      color:       input.color ?? null,
      sortOrder:   (last?.sortOrder ?? 0) + 1,
      createdById: userId,
    },
  });
}

/** Author or admin may edit; ordinary members may not rewrite others' segments. */
function assertCanMutate(role: MemberRole, createdById: string, userId: string) {
  if (createdById !== userId && !isAdmin(role)) {
    throw new SegmentError("Only the author or an admin can change this segment", "FORBIDDEN");
  }
}

export async function updateSegment(
  workspaceId: string, userId: string, segmentId: string,
  patch: Partial<SegmentInput> & { sortOrder?: number },
) {
  const { role } = await getWorkspaceWithRole(workspaceId, userId);
  const current = await db.quranSegment.findFirst({ where: { id: segmentId, workspaceId } });
  if (!current) throw new SegmentError("Segment not found", "NOT_FOUND");
  assertCanMutate(role, current.createdById, userId);

  const surahNumber = patch.surahNumber ?? current.surahNumber;
  const startAyah   = patch.startAyah   ?? current.startAyah;
  const endAyah     = patch.endAyah     ?? current.endAyah;
  assertRange(surahNumber, startAyah, endAyah);

  return db.quranSegment.update({
    where: { id: segmentId },
    data: {
      surahNumber, startAyah, endAyah,
      ...(patch.title !== undefined       ? { title: patch.title.trim() || current.title } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.color !== undefined       ? { color: patch.color } : {}),
      ...(patch.sortOrder !== undefined   ? { sortOrder: patch.sortOrder } : {}),
    },
  });
}

/**
 * Delete a segment. Notes anchored to it are DETACHED, never destroyed:
 * losing a grouping must not silently take a user's writing with it. They
 * become page-anchored so they stay reachable in the workspace.
 */
export async function deleteSegment(
  workspaceId: string, userId: string, segmentId: string,
) {
  const { role } = await getWorkspaceWithRole(workspaceId, userId);
  const current = await db.quranSegment.findFirst({ where: { id: segmentId, workspaceId } });
  if (!current) throw new SegmentError("Segment not found", "NOT_FOUND");
  assertCanMutate(role, current.createdById, userId);

  await db.$transaction([
    db.structuredNote.updateMany({
      where: { segmentId },
      data:  { segmentId: null, anchorType: "page" },
    }),
    db.quranSegment.delete({ where: { id: segmentId } }),
  ]);
  return { id: segmentId };
}

export async function duplicateSegment(
  workspaceId: string, userId: string, segmentId: string,
) {
  await getWorkspaceWithRole(workspaceId, userId);
  const src = await db.quranSegment.findFirst({ where: { id: segmentId, workspaceId } });
  if (!src) throw new SegmentError("Segment not found", "NOT_FOUND");

  return db.quranSegment.create({
    data: {
      workspaceId,
      surahNumber: src.surahNumber,
      startAyah:   src.startAyah,
      endAyah:     src.endAyah,
      title:       `${src.title} copy`,
      description: src.description,
      color:       src.color,
      sortOrder:   src.sortOrder + 1,
      createdById: userId,
    },
  });
}
