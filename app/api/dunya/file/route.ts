/**
 * GET /api/dunya/file?key=biology/test-08.pdf  → 302 to the file
 *
 * The PDFs are in a private R2 bucket behind the realtime worker, which hands
 * one out only with a token for that file. This route is where the password
 * is checked: behind the gate, for a key on the paper list, it signs a token
 * good for two minutes and sends you to the worker.
 */

import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { db } from "@/lib/db";
import { hasAccess, PLAN_ID } from "@/lib/dunya/gate";
import { asCatalog, fileFor } from "@/lib/dunya/catalog";

/* R2's free plan allows 10 million reads a month. A link is good for two
   minutes, so even if every one were opened a hundred times this many a
   month stays ten-fold inside it — and it is about 300 a day, far more
   than anyone downloads. */
const MONTHLY_FILE_LINKS = 10_000;

// The deployed worker, in development too: the files are only in the real bucket.
const FILES_ORIGIN = process.env.DUNYA_FILES_ORIGIN ?? "https://tafsir-lab-realtime.tafsir-lab.workers.dev";

function secret(): Uint8Array {
  const s = process.env.COLLAB_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error("COLLAB_SECRET / SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function GET(req: NextRequest) {
  if (!(await hasAccess())) return NextResponse.redirect(new URL("/dunya", req.url));
  const key = req.nextUrl.searchParams.get("key") ?? "";
  const row = await db.dunyaPlan.findUnique({ where: { id: PLAN_ID }, select: { catalog: true } });
  const name = row ? fileFor(asCatalog(row.catalog), key) : null;
  if (!name) return NextResponse.json({ error: "No such file" }, { status: 404 });

  /* The free-tier guard. R2 has no spending cap of its own, so one is kept
     here: the worker only reads the bucket for a token, and tokens only come
     from this route, so counting them bounds every read. Counted and checked
     in one statement, so two downloads at once cannot both slip past. */
  const month = new Date().toISOString().slice(0, 7);
  const counted = await db.$queryRaw<{ fileReads: number }[]>`
    UPDATE "DunyaPlan"
       SET "fileReads" = CASE WHEN "fileReadsMonth" = ${month} THEN "fileReads" + 1 ELSE 1 END,
           "fileReadsMonth" = ${month}
     WHERE "id" = ${PLAN_ID}
       AND ("fileReadsMonth" IS DISTINCT FROM ${month} OR "fileReads" < ${MONTHLY_FILE_LINKS})
    RETURNING "fileReads"`;
  if (counted.length === 0) {
    return new NextResponse(
      "This month’s download allowance is used up, to keep the file store inside Cloudflare’s free plan. It resets on the 1st.",
      { status: 429, headers: { "Content-Type": "text/plain; charset=utf-8" } },
    );
  }

  const token = await new SignJWT({ file: key, name: `Tafsir Lab ${name}` })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(secret());

  const view = req.nextUrl.searchParams.get("view") === "1";
  const url = `${FILES_ORIGIN}/files/${key.split("/").map(encodeURIComponent).join("/")}?token=${token}${view ? "" : "&download=1"}`;
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
