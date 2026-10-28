/**
 * POST   /api/dunya/attempts   { paperId, date, score, confidence } → { attempt }
 * DELETE /api/dunya/attempts   { paperId, id } → { ok }
 *
 * A score logged against one A-level paper, or taken back. One attempt at a
 * time rather than the whole log, so two devices never overwrite each other.
 * Behind the Dunya password.
 */

import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hasAccess, PLAN_ID } from "@/lib/dunya/gate";
import { asCatalog, asProgress, findPaper, type Attempt, type Confidence } from "@/lib/dunya/catalog";

const CONFIDENCES = new Set<Confidence>(["red", "amber", "green"]);
const MAX_PER_PAPER = 50;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  if (!(await hasAccess())) return bad("Locked", 401);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const paperId = typeof body?.paperId === "string" ? body.paperId : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const score = Number(body?.score);
  const confidence = body?.confidence as Confidence;

  const row = await db.dunyaPlan.findUnique({ where: { id: PLAN_ID }, select: { catalog: true, progress: true } });
  if (!row) return bad("Not set up", 404);
  const found = findPaper(asCatalog(row.catalog), paperId);
  if (!found) return bad("No such paper");
  const marks = found.paper.marks ?? 100;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return bad("Choose the date you did it.");
  if (!Number.isFinite(score) || score < 0 || score > marks) return bad(`Enter a score from 0 to ${marks}.`);
  if (!CONFIDENCES.has(confidence)) return bad("Choose how confident you feel.");

  const attempt: Attempt = { id: randomUUID(), date, score: Math.round(score * 2) / 2, marks, confidence };
  const progress = asProgress(row.progress);
  const list = [...(progress.attempts[paperId] ?? []), attempt]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-MAX_PER_PAPER);
  progress.attempts[paperId] = list;
  await db.dunyaPlan.update({ where: { id: PLAN_ID }, data: { progress: progress as object } });
  return NextResponse.json({ attempt });
}

export async function DELETE(req: NextRequest) {
  if (!(await hasAccess())) return bad("Locked", 401);
  const body = await req.json().catch(() => null) as { paperId?: unknown; id?: unknown } | null;
  if (typeof body?.paperId !== "string" || typeof body.id !== "string") return bad("Which attempt?");
  const row = await db.dunyaPlan.findUnique({ where: { id: PLAN_ID }, select: { progress: true } });
  if (!row) return bad("Not set up", 404);
  const progress = asProgress(row.progress);
  const list = (progress.attempts[body.paperId] ?? []).filter((a) => a.id !== body.id);
  if (list.length) progress.attempts[body.paperId] = list;
  else delete progress.attempts[body.paperId];
  await db.dunyaPlan.update({ where: { id: PLAN_ID }, data: { progress: progress as object } });
  return NextResponse.json({ ok: true });
}
