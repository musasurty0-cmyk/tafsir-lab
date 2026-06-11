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
import { WorkspaceError, getWorkspaceWithRole } from "@/lib/services/workspaces.service";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ pageId: string }> }
) {
  try {
    const { userId } = await getSession();
    const { pageId } = await params;

    // Resolve the workspaceId from the page so we can check membership and get role.
    const page = await db.page.findUnique({
      where: { id: pageId },
      select: { workspaceSurah: { select: { workspaceId: true } } },
    });
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

    const { role } = await getWorkspaceWithRole(page.workspaceSurah.workspaceId, userId);
    const notes = await NotesService.getNotesForPage(pageId, userId, role);

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
      visibility?:  unknown;
      offsetX?:     unknown;
      offsetY?:     unknown;
      width?:       unknown;
      height?:      unknown;
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
      visibility:  (body.visibility === "private" || body.visibility === "workspace" || body.visibility === "admin")
                     ? body.visibility
                     : undefined,
      offsetX:     typeof body.offsetX === "number" ? body.offsetX : undefined,
      offsetY:     typeof body.offsetY === "number" ? body.offsetY : undefined,
      width:       typeof body.width   === "number" ? body.width   : undefined,
      height:      typeof body.height  === "number" ? body.height  : undefined,
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
