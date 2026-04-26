/**
 * GET  /api/pages/[pageId]/notes   — list all notes for this page
 * POST /api/pages/[pageId]/notes   — create a structured note on this page
 *
 * Visibility: any workspace member may read notes.
 * Creation:   any workspace member; isAdmin notes are write-protected on update/delete
 *             (enforced in notes.service, not here).
 *
 * POST body:
 *   {
 *     noteType:    "text" | "callout" | "linguistic" | "thematic" | "ruling" | "question"
 *     anchorType:  "ayah" | "word" | "page"
 *     surahNumber?: number   (required when anchorType = "ayah" | "word")
 *     ayahNumber?:  number   (required when anchorType = "ayah" | "word")
 *     wordPosition?: number  (required when anchorType = "word")
 *     content:     object    (TipTap JSON doc)
 *     color?:      string
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as NotesService from "@/lib/services/notes.service";
import { WorkspaceError } from "@/lib/services/workspaces.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;

    // getNotesForPage does not currently check workspace membership.
    // For Phase 3, we rely on the page existing (invalid pageId returns []).
    // Phase 4 will add explicit membership check here.
    void userId; // present for when auth is real
    const notes = await NotesService.getNotesForPage(pageId);

    return NextResponse.json({ notes });
  } catch (err) {
    if (err instanceof WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "NOT_FOUND" ? 404 : 403 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;

    const body = await req.json() as {
      noteType?:    string;
      anchorType?:  string;
      surahNumber?: unknown;
      ayahNumber?:  unknown;
      wordPosition?: unknown;
      content?:     unknown;
      color?:       unknown;
    };

    // Basic validation — service validates anchor logic and membership.
    if (!body.noteType || !body.anchorType || !body.content) {
      return NextResponse.json(
        { error: "noteType, anchorType, and content are required" },
        { status: 400 }
      );
    }

    const note = await NotesService.createNote(pageId, userId, {
      noteType:    body.noteType    as NotesService.NoteType,
      anchorType:  body.anchorType  as NotesService.AnchorType,
      surahNumber: typeof body.surahNumber === "number" ? body.surahNumber : undefined,
      ayahNumber:  typeof body.ayahNumber  === "number" ? body.ayahNumber  : undefined,
      wordPosition:typeof body.wordPosition=== "number" ? body.wordPosition: undefined,
      content:     body.content,
      color:       typeof body.color === "string" ? body.color : undefined,
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (err) {
    if (err instanceof NotesService.NoteError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "FORBIDDEN" ? 403 : 400;
      return NextResponse.json({ error: err.message }, { status });
    }
    if (err instanceof WorkspaceError) {
      return NextResponse.json({ error: err.message }, { status: err.code === "NOT_FOUND" ? 404 : 403 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
