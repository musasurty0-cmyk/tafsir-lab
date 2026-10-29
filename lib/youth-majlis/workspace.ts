/**
 * Youth Majlis — the TafsirLab workspaces behind the portal.
 *
 * The cohort shares one workspace, where everyone studies the sūrah together
 * (each with their own Mushaf board, see Workspace.privateBoards). Until an
 * organiser makes it, each student has one personal "Youth Majlis"
 * workspace, pinned to their account, never duplicated. In either, a sūrah
 * always opens with the ten points as its tabs.
 *
 * Every creation runs under a transaction-scoped advisory lock, so a double
 * tap cannot make two workspaces, two sūrah sessions or two sets of tabs.
 */

import { db } from "@/lib/db";
import { QUESTIONS, TAB_TITLES } from "@/lib/youth-majlis/content";
import { getSettings, tabNumber } from "@/lib/youth-majlis/data";

const WORKSPACE_NAME = "Youth Majlis";
const ADMIN_ROLES = ["owner", "admin"];

/** A tab's starting page: its question as the heading, then a bullet to write
 *  in — the same shape as the tabs the cohort made by hand. */
function questionDoc(q: string) {
  return {
    type: "doc",
    content: [
      { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: q }] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
    ],
  };
}

/**
 * Where the portal opens a sūrah: the shared cohort workspace, for anyone in
 * it (joinCohort adds every member of the cohort), else their personal one.
 * Since 29 Oct 2026 (owner's request): "Open al-Ṣaff" goes to the shared
 * workspace, not a private one.
 */
export async function majlisWorkspace(userId: string): Promise<string> {
  const { cohortWorkspaceId } = await getSettings();
  if (cohortWorkspaceId) {
    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: cohortWorkspaceId, userId } }, select: { workspaceId: true },
    });
    if (member) return member.workspaceId;
  }
  return personalWorkspace(userId);
}

/**
 * The student's personal Youth Majlis workspace:
 *   1. the one pinned to their account;
 *   2. else a "Youth Majlis" workspace they already own or run (adopted, pinned);
 *   3. else a new one (pinned).
 */
export async function personalWorkspace(userId: string): Promise<string> {
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
      where: { userId }, create: { userId, workspaceId }, update: { workspaceId },
    });
    return workspaceId;
  });
}

/** The cohort's shared workspace, made the first time an organiser asks for
 *  it, with every member of the cohort added. */
export async function createCohortWorkspace(organiserId: string): Promise<string> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ym-cohort-ws'))`;
    const row = await tx.youthMajlisSettings.findUnique({ where: { id: "main" } });
    const data = (row?.data ?? {}) as { cohortWorkspaceId?: string };
    if (data.cohortWorkspaceId) {
      const ok = await tx.workspace.findUnique({ where: { id: data.cohortWorkspaceId }, select: { id: true } });
      if (ok) return ok.id;
    }
    const ws = await tx.workspace.create({
      data: { name: "Youth Majlis Cohort", type: "group", kind: "study", ownerId: organiserId, membersCanManagePages: false, privateBoards: true },
      select: { id: true },
    });
    await tx.workspaceMember.create({ data: { workspaceId: ws.id, userId: organiserId, role: "owner" } });
    const members = await tx.youthMajlisProgress.findMany({ where: { role: { not: "left" } }, select: { userId: true, role: true } });
    for (const m of members) {
      if (m.userId === organiserId) continue;
      await tx.workspaceMember.create({
        data: { workspaceId: ws.id, userId: m.userId, role: m.role === "organiser" ? "admin" : "member" },
      });
    }
    const next = { ...data, cohortWorkspaceId: ws.id };
    await tx.youthMajlisSettings.upsert({ where: { id: "main" }, create: { id: "main", data: next }, update: { data: next } });
    return ws.id;
  });
}

/**
 * The sūrah in a workspace, with the ten points as tabs — missing ones only.
 * Done directly rather than through startSurah, because in the shared cohort
 * workspace a student is a member, and members cannot start a sūrah there.
 * Returns the tab ids by point number.
 */
export async function surahWithTabs(workspaceId: string, surah: number, userId: string): Promise<Map<number, string>> {
  /* In the shared workspace the tabs are everyone's, so they are published:
     a draft is seen only by whoever made it and the admins. In a personal
     workspace they stay drafts, as they always were. */
  const { cohortWorkspaceId } = await getSettings();
  const status = workspaceId === cohortWorkspaceId ? "published" : "draft";
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ym-tabs:${workspaceId}:${surah}`}))`;
    const ws = await tx.workspaceSurah.upsert({
      where:  { workspaceId_surahNumber: { workspaceId, surahNumber: surah } },
      create: { workspaceId, surahNumber: surah },
      update: {},
      select: { id: true },
    });
    const pages = await tx.page.findMany({
      where: { workspaceSurahId: ws.id }, select: { id: true, title: true, orderIndex: true },
      orderBy: { orderIndex: "asc" },
    });
    const ids = new Map<number, string>();
    for (const p of pages) { const n = tabNumber(p.title); if (n && !ids.has(n)) ids.set(n, p.id); }
    let next = pages.reduce((m, p) => Math.max(m, p.orderIndex + 1), 0);
    for (const q of QUESTIONS) {
      if (ids.has(q.n)) continue;
      const page = await tx.page.create({
        data: {
          workspaceSurahId: ws.id, title: TAB_TITLES[q.n - 1], orderIndex: next++, status,
          ...(status === "published" ? { publishedById: userId, publishedAt: new Date() } : {}),
          tiptapContent: questionDoc(q.q), createdById: userId,
        },
        select: { id: true },
      });
      ids.set(q.n, page.id);
    }
    return ids;
  });
}
