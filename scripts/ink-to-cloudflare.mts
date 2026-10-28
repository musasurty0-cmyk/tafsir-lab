/**
 * Copy the ink from the database (InkStroke/InkHead, sql 020) into each
 * page's realtime room on Cloudflare (party/ink.ts), then check every copy.
 *
 *   npx tsx scripts/ink-to-cloudflare.mts            # copy what is missing or newer, then check
 *   CHECK=1 npx tsx scripts/ink-to-cloudflare.mts    # check only
 *
 * Run before the app reads from the rooms, and once more after it is live, to
 * bring across anything a tab saved to the database in between. An author's
 * page is copied when the room has no ink for them or an older version, and
 * the copy replaces theirs there wholesale. Safe to run any number of times.
 *
 * The check compares, for every author on every page, the stroke count and
 * the ids in drawing order. The database tables stay until the owner has
 * looked at their ink; dropping them is a separate step.
 */

import { PrismaClient } from "@prisma/client";
import { importInk, inkSummary } from "../lib/collab/ink-admin";

const db = new PrismaClient();
const heads = await db.inkHead.findMany({ select: { pageId: true, authorId: true, updatedAt: true } });
const pages = [...new Set(heads.map((h) => h.pageId))];
const names = new Map((await db.user.findMany({
  where: { id: { in: [...new Set(heads.map((h) => h.authorId))] } }, select: { id: true, name: true },
})).map((u) => [u.id, u.name]));

async function summary() {
  const out: Record<string, { author: string; count: number; updated: number; ids: string }[]> = {};
  for (let i = 0; i < pages.length; i += 25) Object.assign(out, await inkSummary(pages.slice(i, i + 25)));
  return out;
}

if (!process.env.CHECK) {
  const before = await summary();
  let copied = 0, strokes = 0;
  for (const h of heads) {
    const there = before[h.pageId]?.find((a) => a.author === h.authorId);
    if (there && there.updated >= h.updatedAt.getTime()) continue;   // already current
    const rows = await db.inkStroke.findMany({
      where: { pageId: h.pageId, authorId: h.authorId }, orderBy: { seq: "asc" }, select: { data: true },
    });
    const r = await importInk(h.pageId, h.authorId, names.get(h.authorId) ?? "", h.updatedAt.getTime(), rows.map((x) => x.data as object));
    copied++; strokes += r.strokes;
  }
  console.log(`copied ${copied} author-pages, ${strokes} strokes`);
}

// ── Check every author on every page: count and order ──
const after = await summary();
let ok = 0, bad = 0, total = 0;
for (const h of heads) {
  const ids = (await db.inkStroke.findMany({
    where: { pageId: h.pageId, authorId: h.authorId }, orderBy: { seq: "asc" }, select: { id: true },
  })).map((x) => x.id).join(",");
  const there = after[h.pageId]?.find((a) => a.author === h.authorId);
  total += ids ? ids.split(",").length : 0;
  if (there && there.ids === ids) ok++;
  else { bad++; console.log(`MISMATCH page ${h.pageId} author ${h.authorId}: db ${ids.split(",").length} vs room ${there?.count ?? "none"}`); }
}
console.log(`${ok} of ${heads.length} author-pages identical (${total} strokes in the database); ${bad} mismatched`);
await db.$disconnect();
process.exit(bad ? 1 : 0);
