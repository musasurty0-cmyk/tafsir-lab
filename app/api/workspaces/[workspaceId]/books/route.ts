/**
 * POST /api/workspaces/[workspaceId]/books
 *   Add a book to a books-workspace. Body: { title, pdfUrl, pdfName? }.
 *   pdfUrl is a library path ("/books/slug.pdf") or "local" (uploaded PDF, the
 *   bytes live in the reader's IndexedDB keyed by the returned book id).
 *   Returns { book: { id, title, pdfUrl, pdfName } }.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import * as PagesService from "@/lib/services/pages.service";
import { apiError } from "@/lib/api-errors";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ workspaceId: string }> },
) {
  try {
    const { workspaceId } = await params;
    const { userId } = await getSession();
    const body = await req.json().catch(() => ({})) as {
      title?: unknown; pdfUrl?: unknown; pdfName?: unknown;
    };

    const title  = typeof body.title  === "string" ? body.title  : "";
    const pdfUrl = typeof body.pdfUrl === "string" ? body.pdfUrl : "";
    const pdfName = typeof body.pdfName === "string" ? body.pdfName : null;

    if (!pdfUrl) {
      return NextResponse.json({ error: "pdfUrl is required" }, { status: 400 });
    }
    // Only allow our own library paths or the "local" sentinel — never an
    // arbitrary external URL (would let a book point anywhere / SSRF-ish).
    const ok = pdfUrl === "local" || /^\/books\/[a-z0-9-]+\.pdf$/.test(pdfUrl);
    if (!ok) {
      return NextResponse.json({ error: "Invalid pdfUrl" }, { status: 400 });
    }

    const book = await PagesService.createWorkspaceBook(workspaceId, userId, { title, pdfUrl, pdfName });
    return NextResponse.json({ book }, { status: 201 });
  } catch (err) {
    return apiError(err);
  }
}
