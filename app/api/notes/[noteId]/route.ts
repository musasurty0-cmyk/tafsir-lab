/**
 * PATCH  /api/notes/[noteId]  — update note content and/or geometry
 * DELETE /api/notes/[noteId]  — delete a note
 *
 * This route was referenced by NoteCard / AnchoredNoteCard from the start
 * but never existed — every note edit, minimize, move, and delete silently
 * 404'd. All permission logic lives in notes.service.
 *
 * PATCH body (all fields optional, at least one required):
 *   {
 *     content?:     object   (TipTap JSON doc)
 *     offsetX?:     number
 *     offsetY?:     number
 *     width?:       number
 *     height?:      number
 *     isMinimized?: boolean
 *     zIndex?:      number
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as NotesService from "@/lib/services/notes.service";
import { WorkspaceError } from "@/lib/services/workspaces.service";
import { db } from "@/lib/db";

function errorResponse(err: unknown) {
  if (err instanceof NotesService.NoteError) {
    const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
  if (err instanceof WorkspaceError) {
    return NextResponse.json({ error: err.message }, { status: err.code === "NOT_FOUND" ? 404 : 403 });
  }
  return NextResponse.json({ error: String(err) }, { status: 500 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { noteId } = await params;

    const body = await req.json() as {
      content?:     unknown;
      noteType?:    unknown;
      offsetX?:     unknown;
      offsetY?:     unknown;
      width?:       unknown;
      height?:      unknown;
      isMinimized?: unknown;
      zIndex?:      unknown;
    };

    if (body.content !== undefined) {
      await NotesService.updateNoteContent(noteId, userId, body.content);
    }

    // Note type reclassification (was silently dropped before — clients sent
    // noteType but the route never processed it).
    const VALID_TYPES = ["text", "callout", "linguistic", "thematic", "ruling", "question"];
    if (typeof body.noteType === "string" && VALID_TYPES.includes(body.noteType)) {
      await NotesService.updateNoteType(noteId, userId, body.noteType as NotesService.NoteType);
    }

    const geometry: NotesService.NoteGeometryPatch = {};
    if (typeof body.offsetX     === "number")  geometry.offsetX     = body.offsetX;
    if (typeof body.offsetY     === "number")  geometry.offsetY     = body.offsetY;
    if (typeof body.width       === "number")  geometry.width       = body.width;
    if (typeof body.height      === "number")  geometry.height      = body.height;
    if (typeof body.isMinimized === "boolean") geometry.isMinimized = body.isMinimized;
    if (typeof body.zIndex      === "number")  geometry.zIndex      = body.zIndex;

    if (Object.keys(geometry).length > 0) {
      await NotesService.updateNoteGeometry(noteId, userId, geometry);
    }

    // Return the fully-shaped note (with author) so clients can merge it
    // straight into their NoteData state.
    const note = await db.structuredNote.findUnique({
      where:   { id: noteId },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    return NextResponse.json({ note });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { noteId } = await params;
    await NotesService.deleteNote(noteId, userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
