/**
 * GET /youth-majlis/open/[surah]
 *
 * "Open in TafsirLab" from the Youth Majlis portal. Lands the student on the
 * sūrah in their Youth Majlis workspace, with the Majlis's ten points already
 * made as the sūrah's tabs, each opening on its question.
 *
 * One workspace per student, never another:
 *   1. the workspace pinned to their account (YouthMajlisProgress.workspaceId);
 *   2. otherwise a "Youth Majlis" workspace they already own or run — the
 *      cohort made these by hand before the portal existed — which is then
 *      pinned;
 *   3. otherwise a new one, pinned.
 * Pinning means renaming the workspace never makes a second one, and every
 * step runs under a per-student transaction lock, so a double tap cannot
 * create two workspaces or two sets of tabs.
 *
 * Not signed in to TafsirLab → the login page. Not through the portal's gate
 * → the portal.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/session";
import { db } from "@/lib/db";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { QUESTIONS, TAB_TITLES } from "@/lib/youth-majlis/content";

const WORKSPACE_NAME = "Youth Majlis";
const ADMIN_ROLES = ["owner", "admin"];

/** A tab's starting page: its question as the heading, then a bullet to write in —
 *  the same shape as the tabs the cohort made by hand. */
function questionDoc(q: string) {
  return {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: q }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
    ],
  };
}

/** The leading number of a tab title — "4. Reason for Revelation" → 4. */
const tabNumber = (title: string) => {
  const m = /^\s*(\d{1,2})\s*[.)\-:]/.exec(title);
  return m ? Number(m[1]) : null;
};

async function resolveWorkspace(userId: string): Promise<string> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ym-ws:" + userId}))`;

    const pinned = await tx.youthMajlisProgress.findUnique({ where: { userId }, select: { workspaceId: true } });
    if (pinned?.workspaceId) {
      const still = await tx.workspaceMember.findFirst({
        where: { workspaceId: pinned.workspaceId, userId, role: { in: ADMIN_ROLES } },
        select: { workspaceId: true },
      });
      if (still) return still.workspaceId;
    }

    const existing = await tx.workspaceMember.findFirst({
      where: {
        userId, role: { in: ADMIN_ROLES },
        workspace: { name: { equals: WORKSPACE_NAME, mode: "insensitive" }, kind: "study" },
      },
      orderBy: { joinedAt: "asc" },
      select: { workspaceId: true },
    });

    let workspaceId = existing?.workspaceId;
    if (!workspaceId) {
      const ws = await tx.workspace.create({
        data: { name: WORKSPACE_NAME, type: "private", kind: "study", ownerId: userId },
        select: { id: true },
      });
      await tx.workspaceMember.create({ data: { workspaceId: ws.id, userId, role: "owner" } });
      workspaceId = ws.id;
    }

    await tx.youthMajlisProgress.upsert({
      where:  { userId },
      create: { userId, workspaceId },
      update: { workspaceId },
    });
    return workspaceId;
  });
}

async function ensureTabs(workspaceSurahId: string, userId: string): Promise<string> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"ym-tabs:" + workspaceSurahId}))`;
    const pages = await tx.page.findMany({
      where: { workspaceSurahId }, select: { id: true, title: true, orderIndex: true },
      orderBy: { orderIndex: "asc" },
    });
    const have = new Set(pages.map((p) => tabNumber(p.title)).filter((n): n is number => n != null));
    let next = pages.reduce((m, p) => Math.max(m, p.orderIndex + 1), 0);
    let first = pages.find((p) => tabNumber(p.title) === 1)?.id;

    for (const q of QUESTIONS) {
      if (have.has(q.n)) continue;
      const page = await tx.page.create({
        data: {
          workspaceSurahId, title: TAB_TITLES[q.n - 1], orderIndex: next++, status: "draft",
          tiptapContent: questionDoc(q.q), createdById: userId,
        },
        select: { id: true },
      });
      if (q.n === 1) first = page.id;
    }
    return first ?? pages[0]?.id ?? "";
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ surah: string }> },
) {
  const { surah: raw } = await params;
  const surah = Number(raw);
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return to("/youth-majlis");
  if (!(await hasAccess("majlis"))) return to("/youth-majlis");

  const session = await getSessionOrNull();
  if (!session) return to("/login");
  const { userId } = session;

  const workspaceId = await resolveWorkspace(userId);

  // startSurah is idempotent; a simultaneous first open can still collide on
  // the unique (workspace, sūrah) pair, in which case the other request won.
  let ws;
  try {
    ws = await WorkspacesService.startSurah(workspaceId, surah, userId);
  } catch {
    ws = await db.workspaceSurah.findUniqueOrThrow({
      where: { workspaceId_surahNumber: { workspaceId, surahNumber: surah } },
      select: { id: true },
    });
  }

  const pageId = await ensureTabs(ws.id, userId);
  return to(`/workspaces/${workspaceId}/surahs/${surah}${pageId ? `/pages/${pageId}` : ""}`);
}
