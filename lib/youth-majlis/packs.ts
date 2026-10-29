/**
 * Youth Majlis prep packs: PDFs an organiser uploads for a session, which the
 * cohort can read or download from the portal.
 *
 * The files live in the private R2 bucket behind the realtime worker, like
 * the /dunya papers (see app/api/dunya/file), never in Supabase, where every
 * download would count against the egress quota. The browser uploads straight
 * to the worker with a token signed here, since a PDF can be larger than a
 * Vercel request may be. Reading works the same way round: the portal checks
 * who you are, then hands you a two-minute link to that one file.
 *
 * Free-tier guards, as for /dunya: at most 40 MB a file, 1 GB and 300 files
 * in all (R2's free plan is 10 GB, shared with the Dunya papers), and 10,000
 * links a month (the plan allows 10 million reads).
 */

import { SignJWT } from "jose";
import { db } from "@/lib/db";

export const PACK_MAX_BYTES = 40 * 1024 * 1024;
const PACK_MAX_TOTAL = 1024 * 1024 * 1024;
const PACK_MAX_COUNT = 300;
const MONTHLY_LINKS = 10_000;

// The deployed worker, in development too: the files are only in the real bucket.
export const FILES_ORIGIN = process.env.DUNYA_FILES_ORIGIN ?? "https://tafsir-lab-realtime.tafsir-lab.workers.dev";

function secret(): Uint8Array {
  const s = process.env.COLLAB_SECRET || process.env.SESSION_SECRET;
  if (!s) throw new Error("COLLAB_SECRET / SESSION_SECRET is not set");
  return new TextEncoder().encode(s);
}

const sign = (claims: Record<string, unknown>, ttl: string) =>
  new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(ttl).sign(secret());

const keyPath = (key: string) => key.split("/").map(encodeURIComponent).join("/");

export class PackError extends Error {}

/** "Saff prep pack.pdf" stays readable; anything odd is dropped. */
export function cleanFileName(name: string): string {
  const base = name.replace(/\.pdf$/i, "").replace(/[^\p{L}\p{N} ._()-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  return `${base || "Prep pack"}.pdf`;
}

/**
 * Makes room for one more file and returns where the browser should send it.
 * Uploads that were started and never finished are cleared first, so they
 * neither count against the limits nor linger in the bucket.
 */
export async function beginUpload(opts: { sessionId: string; title: string; fileName: string; bytes: number; userId: string }) {
  if (!Number.isInteger(opts.bytes) || opts.bytes <= 0) throw new PackError("That file is empty.");
  if (opts.bytes > PACK_MAX_BYTES) throw new PackError("Keep each PDF under 40 MB.");

  const stale = await db.youthMajlisPack.findMany({
    where: { ready: false, createdAt: { lt: new Date(Date.now() - 60 * 60_000) } }, select: { id: true, key: true },
  });
  if (stale.length) {
    await adminFiles("delete", stale.map((p) => p.key)).catch(() => null);
    await db.youthMajlisPack.deleteMany({ where: { id: { in: stale.map((p) => p.id) } } });
  }

  const all = await db.youthMajlisPack.aggregate({ _sum: { bytes: true }, _count: true });
  if (all._count >= PACK_MAX_COUNT) throw new PackError("The portal holds 300 prep packs at most. Delete an old one first.");
  if ((all._sum.bytes ?? 0) + opts.bytes > PACK_MAX_TOTAL) throw new PackError("The prep pack store is full (1 GB). Delete an old one first.");

  const row = await db.youthMajlisPack.create({
    data: { sessionId: opts.sessionId, title: opts.title, fileName: opts.fileName, key: "", bytes: opts.bytes, uploadedBy: opts.userId },
    select: { id: true },
  });
  const key = `youth-majlis/${row.id}.pdf`;
  await db.youthMajlisPack.update({ where: { id: row.id }, data: { key } });
  const token = await sign({ upload: key, max: opts.bytes }, "10m");
  return { id: row.id, uploadUrl: `${FILES_ORIGIN}/upload/${keyPath(key)}?token=${token}` };
}

/** After the browser's upload: checks the bucket really has it, at the size promised. */
export async function finishUpload(id: string): Promise<void> {
  const row = await db.youthMajlisPack.findUnique({ where: { id }, select: { key: true, bytes: true } });
  if (!row) throw new PackError("That upload has gone. Try again.");
  const sizes = await adminFiles("head", [row.key]) as Record<string, number | null>;
  if (sizes[row.key] !== row.bytes) {
    await removePacks([id]);
    throw new PackError("The upload didn’t arrive in full. Try again.");
  }
  await db.youthMajlisPack.update({ where: { id }, data: { ready: true } });
}

/** Deletes packs, file and row. */
export async function removePacks(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const rows = await db.youthMajlisPack.findMany({ where: { id: { in: ids } }, select: { key: true } });
  if (rows.length) await adminFiles("delete", rows.map((r) => r.key).filter(Boolean));
  await db.youthMajlisPack.deleteMany({ where: { id: { in: ids } } });
}

async function adminFiles(op: "head" | "delete", keys: string[]): Promise<unknown> {
  const token = await sign({ admin: "files" }, "1m");
  const r = await fetch(`${FILES_ORIGIN}/files-admin`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ op, keys }),
    cache: "no-store",
  });
  if (!r.ok) throw new PackError("Couldn’t reach the file store. Try again.");
  return r.json();
}

/**
 * A two-minute link to one pack, or null once this month's links are used
 * up. Counted and checked in one statement, so two at once cannot both slip
 * past the limit.
 */
export async function packLink(id: string, download: boolean): Promise<string | null | undefined> {
  const row = await db.youthMajlisPack.findFirst({ where: { id, ready: true }, select: { key: true, fileName: true } });
  if (!row) return undefined;
  const month = new Date().toISOString().slice(0, 7);
  const counted = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "YouthMajlisPackReads" ("month", "count") VALUES (${month}, 1)
    ON CONFLICT ("month") DO UPDATE SET "count" = "YouthMajlisPackReads"."count" + 1
      WHERE "YouthMajlisPackReads"."count" < ${MONTHLY_LINKS}
    RETURNING "count"`;
  if (counted.length === 0) return null;
  const token = await sign({ file: row.key, name: row.fileName }, "2m");
  return `${FILES_ORIGIN}/files/${keyPath(row.key)}?token=${token}${download ? "&download=1" : ""}`;
}
