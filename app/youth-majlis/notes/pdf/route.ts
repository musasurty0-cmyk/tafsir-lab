/**
 * GET /youth-majlis/notes/pdf — the class notes as a printable PDF, the
 * compiled book for all three sūrahs. Behind the portal's gate: the file is
 * stored in the database (prisma/sql/011), never in this public repository.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasAccess } from "@/lib/youth-majlis/gate";

export async function GET(req: NextRequest) {
  if (!(await hasAccess("majlis"))) return NextResponse.redirect(new URL("/youth-majlis", req.url));
  const file = await db.youthMajlisFile.findUnique({ where: { name: "class-notes.pdf" } }).catch(() => null);
  if (!file) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(Buffer.from(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": 'attachment; filename="Youth-Majlis-Class-Notes.pdf"',
      "Content-Length": String(file.data.length),
      "Cache-Control": "private, max-age=3600",
      "Last-Modified": file.updatedAt.toUTCString(),
    },
  });
}
