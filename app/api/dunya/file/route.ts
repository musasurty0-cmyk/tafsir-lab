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

  const token = await new SignJWT({ file: key, name: `Tafsir Lab ${name}` })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("2m")
    .sign(secret());

  const view = req.nextUrl.searchParams.get("view") === "1";
  const url = `${FILES_ORIGIN}/files/${key.split("/").map(encodeURIComponent).join("/")}?token=${token}${view ? "" : "&download=1"}`;
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
