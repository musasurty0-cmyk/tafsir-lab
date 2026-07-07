/**
 * notes.service — Phase 2 scope
 *
 * Full CRUD for StructuredNote. Written ahead of schedule; wired into
 * route handlers and UI in Phase 2. Do not import before that phase.
 */

import { db } from "@/lib/db";
import { getWorkspaceWithRole, isAdmin, type MemberRole } from "./workspaces.service";
import { log } from "./activity.service";

export class NoteError extends Error {
  constructor(message: string, public code: "NOT_FOUND" | "FORBIDDEN" | "INVALID") {
    super(message);
  }
}

export type NoteType = "text" | "callout" | "linguistic" | "thematic" | "ruling" | "question";
export type AnchorType = "ayah" | "word" | "page";
export type NoteVisibility = "private" | "workspace" | "admin";

export interface CreateNoteInput {
  noteType: NoteType;
  anchorType: AnchorType;
  surahNumber?: number;
  ayahNumber?: number;
  wordPosition?: number;
  content: unknown; // TipTap JSON
  color?: string;
  offsetX?: number;
  offsetY?: number;
  width?: number;
  height?: number;
  visibility?: NoteVisibility;
}

export interface NoteGeometryPatch {
  offsetX?: number;
  offsetY?: number;
  width?: number;
  height?: number;
  isMinimized?: boolean;
  zIndex?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────

async function getNoteAndWorkspace(noteId: string) {
  const note = await db.structuredNote.findUnique({
    where: { id: noteId },
    include: { page: { include: { workspaceSurah: { select: { workspaceId: true } } } } },
  });
  if (!note) throw new NoteError("Note not found", "NOT_FOUND");
  return { note, workspaceId: note.page.workspaceSurah.workspaceId };
}

function validateAnchor(input: CreateNoteInput) {
  if (input.anchorType === "ayah" && (!input.surahNumber || !input.ayahNumber)) {
    throw new NoteError("Ayah anchor requires surahNumber and ayahNumber", "INVALID");
  }
  if (input.anchorType === "word" && (!input.surahNumber || !input.ayahNumber || input.wordPosition == null)) {
    throw new NoteError("Word anchor requires surahNumber, ayahNumber, and wordPosition", "INVALID");
  }
}

// ── Queries ──────────────────────────────────────────────────────────

export async function getNotesForPage(pageId: string, userId: string, role: MemberRole) {
  return db.structuredNote.findMany({
    where: {
      pageId,
      OR: [
        { visibility: "workspace" },
        { visibility: "private", authorId: userId },
        ...(isAdmin(role) ? [{ visibility: "admin" }] : []),
      ],
    },
    orderBy: [{ zIndex: "asc" }, { createdAt: "asc" }],
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

/** Plain-text extraction from TipTap JSON (server-side, for search). */
function extractPlain(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const n = node as { text?: string; content?: unknown[] };
  if (n.text) return n.text;
  if (!n.content) return "";
  return n.content.map(extractPlain).join(" ");
}

/**
 * All notes across every page of a workspace, visibility-filtered, with
 * optional type / surah / free-text filters. Powers the Notes review view —
 * the retrieval layer that turns ayah anchors + type tags into something
 * students can actually query.
 */
export async function listWorkspaceNotes(
  workspaceId: string,
  userId: string,
  opts: { query?: string; noteType?: string; surahNumber?: number } = {},
) {
  const { role } = await getWorkspaceWithRole(workspaceId, userId);

  const notes = await db.structuredNote.findMany({
    where: {
      page: { workspaceSurah: { workspaceId } },
      ...(opts.noteType    ? { noteType:    opts.noteType }    : {}),
      ...(opts.surahNumber ? { surahNumber: opts.surahNumber } : {}),
      OR: [
        { visibility: "workspace" },
        { visibility: "private", authorId: userId },
        ...(isAdmin(role) ? [{ visibility: "admin" }] : []),
      ],
    },
    orderBy: [{ surahNumber: "asc" }, { ayahNumber: "asc" }, { createdAt: "desc" }],
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      page: {
        select: {
          id: true,
          title: true,
          workspaceSurah: { select: { surahNumber: true } },
        },
      },
    },
  });

  if (!opts.query?.trim()) return notes;

  const q = opts.query.trim().toLowerCase();
  return notes.filter((n) => extractPlain(n.content).toLowerCase().includes(q));
}

export async function searchNotes(workspaceId: string, query: string) {
  // Full-text search via Postgres ILIKE on text content
  // For production: use pg_trgm or tsvector index
  return db.$queryRaw<{ id: string; content: unknown; pageId: string }[]>`
    SELECT id, content, "pageId"
    FROM "StructuredNote" sn
    JOIN "Page" p ON p.id = sn."pageId"
    JOIN "WorkspaceSurah" ws ON ws.id = p."workspaceSurahId"
    WHERE ws."workspaceId" = ${workspaceId}::uuid
      AND sn.content::text ILIKE ${'%' + query + '%'}
    LIMIT 50
  `;
}

// ── Mutations ────────────────────────────────────────────────────────

export async function createNote(
  pageId: string,
  authorId: string,
  input: CreateNoteInput
) {
  validateAnchor(input);

  const page = await db.page.findUnique({
    where: { id: pageId },
    include: { workspaceSurah: { select: { workspaceId: true } } },
  });
  if (!page) throw new NoteError("Page not found", "NOT_FOUND");
  await getWorkspaceWithRole(page.workspaceSurah.workspaceId, authorId);

  const note = await db.structuredNote.create({
    data: {
      pageId,
      authorId,
      noteType: input.noteType,
      anchorType: input.anchorType,
      surahNumber: input.surahNumber ?? null,
      ayahNumber: input.ayahNumber ?? null,
      wordPosition: input.wordPosition ?? null,
      content: input.content as never,
      color: input.color ?? null,
      offsetX: input.offsetX ?? 40,
      offsetY: input.offsetY ?? 0,
      width: input.width ?? 280,
      height: input.height ?? null,
      visibility: input.visibility ?? "workspace",
    },
    // Include author so callers receive a fully-shaped NoteData without
    // a second round-trip (needed by the Mode A optimistic note creation).
    include: { author: { select: { id: true, name: true, avatarUrl: true } } },
  });

  await log({
    workspaceId: page.workspaceSurah.workspaceId, userId: authorId,
    action: "note.created", entityType: "note", entityId: note.id,
    metadata: { noteType: input.noteType, anchorType: input.anchorType },
  });

  return note as never;
}

export async function updateNoteContent(
  noteId: string,
  userId: string,
  content: unknown
) {
  const { note, workspaceId } = await getNoteAndWorkspace(noteId);
  const { role } = await getWorkspaceWithRole(workspaceId, userId);

  if (note.isAdmin && role === "member") {
    throw new NoteError("Cannot edit admin-locked notes", "FORBIDDEN");
  }

  const updated = await db.structuredNote.update({
    where: { id: noteId },
    data: { content: content as never },
  });
  await log({
    workspaceId, userId,
    action: "note.updated", entityType: "note", entityId: noteId,
  });
  return updated;
}

/**
 * Change a note's type (text/callout/linguistic/thematic/ruling/question).
 * Same permission rules as content edits: admin-locked notes are protected.
 */
export async function updateNoteType(
  noteId: string,
  userId: string,
  noteType: NoteType,
) {
  const { note, workspaceId } = await getNoteAndWorkspace(noteId);
  const { role } = await getWorkspaceWithRole(workspaceId, userId);

  if (note.isAdmin && role === "member") {
    throw new NoteError("Cannot edit admin-locked notes", "FORBIDDEN");
  }

  return db.structuredNote.update({
    where: { id: noteId },
    data:  { noteType },
  });
}

export async function updateNoteGeometry(
  noteId: string,
  userId: string,
  patch: NoteGeometryPatch
) {
  const { workspaceId } = await getNoteAndWorkspace(noteId);
  await getWorkspaceWithRole(workspaceId, userId);

  return db.structuredNote.update({
    where: { id: noteId },
    data: {
      ...(patch.offsetX !== undefined && { offsetX: patch.offsetX }),
      ...(patch.offsetY !== undefined && { offsetY: patch.offsetY }),
      ...(patch.width   !== undefined && { width:   patch.width }),
      ...(patch.height  !== undefined && { height:  patch.height }),
      ...(patch.isMinimized !== undefined && { isMinimized: patch.isMinimized }),
      ...(patch.zIndex  !== undefined && { zIndex:  patch.zIndex }),
    },
  });
}

export async function deleteNote(noteId: string, userId: string) {
  const { note, workspaceId } = await getNoteAndWorkspace(noteId);
  const { role } = await getWorkspaceWithRole(workspaceId, userId);

  if (note.isAdmin && role === "member") {
    throw new NoteError("Cannot delete admin-locked notes", "FORBIDDEN");
  }

  await db.structuredNote.delete({ where: { id: noteId } });
  await log({
    workspaceId, userId,
    action: "note.deleted", entityType: "note", entityId: noteId,
    metadata: { noteType: note.noteType, anchorType: note.anchorType },
  });
}
