/**
 * Provision a throwaway demo account, seeded the way the tour expects.
 *
 * Shared by /api/auth/demo (the code-gated login) and /api/beta/start (the
 * public tour entry). It used to exist only inside the demo route, and only
 * created a bare "Welcome" page — so a demo user landed on an empty document
 * while the tour's own script talks about "real notes on the seven names of
 * al-Fātiḥah". The tour built its own workspace client-side to get around
 * that, which meant a demo user ended up with two.
 *
 * Doing it here, server-side, means one workspace with the content the tour
 * actually describes, created in one round trip instead of five sequential
 * fetches from the browser.
 */

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { boardRooms, wipeInk } from "@/lib/collab/ink-admin";
import { createSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService from "@/lib/services/pages.service";
import { createConnection } from "@/lib/services/connections.service";
import { fatihaNotesDoc, DEMO_CONNECTIONS } from "@/lib/demo/fatiha-notes";

export const DEMO_DOMAIN = "demo.tafsirlab.local";

/** Global ceiling, independent of the per-IP limit. Survives serverless, where
 *  an in-memory counter does not. */
const MAX_NEW_DEMOS_PER_MINUTE = 30;

export interface DemoSession {
  userId: string;
  workspaceId: string;
  /** null only if page creation failed — the workspace still demos fine. */
  pageId: string | null;
}

/** Thrown when the global ceiling is hit. Carries a code so apiError maps it. */
export class DemoBusyError extends Error {
  readonly code = "CONFLICT";
  constructor() {
    super("Demo is busy — try again shortly.");
    this.name = "DemoBusyError";
  }
}

/** A readable, non-secret flag telling the browser this is a demo, so it can
 *  check in and say goodbye. The session itself stays in the httpOnly cookie. */
export const DEMO_FLAG = "tl-demo";

export const isDemoEmail = (email: string) => email.endsWith(`@${DEMO_DOMAIN}`);

/**
 * Delete a demo account and everything it made.
 *
 * Several relations to User do not cascade (logs, templates, the page/note/
 * drawing author, segments, connections, group progress), so a bare
 * user.delete fails — which is why demo accounts used to linger. They are
 * removed explicitly, inside the account's own workspaces, in one
 * transaction. If the demo ever wrote into SOMEONE ELSE's workspace it is
 * left alone: that writing outranks the cleanup.
 *
 * Refuses anything that is not a demo account, whatever it is passed.
 */
export async function deleteDemoUser(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user || !isDemoEmail(user.email)) return false;

  const own = (await db.workspace.findMany({ where: { ownerId: userId }, select: { id: true } })).map((w) => w.id);
  const outside = { workspaceSurah: { workspaceId: { notIn: own } } };
  const foreign =
    (await db.structuredNote.count({ where: { authorId: userId, page: outside } })) +
    (await db.page.count({ where: { createdById: userId, ...outside } })) +
    (await db.quranSegment.count({ where: { createdById: userId, workspaceId: { notIn: own } } })) +
    (await db.quranConnection.count({ where: { createdById: userId, workspaceId: { notIn: own } } }));
  if (foreign > 0) return false;

  /* Ink is in the pages' realtime rooms, out of the database cascade's reach:
     all of it on the demo's own pages, and the demo's strokes on any other
     page it could reach (ink needs membership, so those are the pages of
     workspaces it joined). Gathered before the rows that name them go. */
  const ownPages = (await db.page.findMany({ where: { workspaceSurah: { workspaceId: { in: own } } }, select: { id: true } })).map((p) => p.id);
  const joined = (await db.workspaceMember.findMany({ where: { userId, workspaceId: { notIn: own } }, select: { workspaceId: true } })).map((m) => m.workspaceId);
  const otherPages = joined.length
    ? (await db.page.findMany({ where: { workspaceSurah: { workspaceId: { in: joined } } }, select: { id: true } })).map((p) => p.id)
    : [];
  // Its own Mushaf boards, where a workspace it joined gives everyone one.
  const boardPages = joined.length
    ? (await db.page.findMany({ where: { workspaceSurah: { workspace: { id: { in: joined }, privateBoards: true } } }, select: { id: true } })).map((p) => p.id)
    : [];

  try {
    await db.$transaction([
      db.activityLog.deleteMany({ where: { userId } }),
      db.groupAyahProgress.deleteMany({ where: { lastChangedBy: userId } }),
      db.pageTemplate.deleteMany({ where: { createdById: userId } }),
      db.workspace.deleteMany({ where: { ownerId: userId } }),   // pages, notes, ink, segments… go with them
      db.user.delete({ where: { id: userId } }),
    ]);
    await wipeInk(ownPages);
    await wipeInk(otherPages, userId);
    await wipeInk(boardRooms(boardPages, [userId]));
    return true;
  } catch {
    return false;
  }
}

/** A demo whose tab was closed and not reopened within this long is gone. */
const CLOSED_GRACE_MS = 60 * 1000;
/** An open demo checks in every 15s; silent for this long, it is gone. */
const SILENT_MS = 10 * 60 * 1000;

/**
 * Discard finished demos: closed and not reopened, silent for ten minutes,
 * never checked in at all after fifteen, or simply older than a day.
 * Best-effort and quiet; runs whenever any demo starts, checks in or closes,
 * so a closed demo does not wait for a cron.
 */
export async function purgeDemos(except?: string): Promise<number> {
  const now = Date.now();
  const finished = await db.user.findMany({
    where: {
      email: { endsWith: `@${DEMO_DOMAIN}` },
      ...(except ? { id: { not: except } } : {}),
      OR: [
        { demoPresence: { closedAt: { lt: new Date(now - CLOSED_GRACE_MS) } } },
        { demoPresence: { seenAt: { lt: new Date(now - SILENT_MS) } } },
        { demoPresence: null, createdAt: { lt: new Date(now - 15 * 60 * 1000) } },
        { createdAt: { lt: new Date(now - 24 * 60 * 60 * 1000) } },
      ],
    },
    select: { id: true },
    take: 50,
  });
  let n = 0;
  for (const u of finished) if (await deleteDemoUser(u.id)) n++;
  return n;
}

export async function provisionDemoSession(): Promise<DemoSession> {
  const recent = await db.user.count({
    where: {
      email:     { endsWith: `@${DEMO_DOMAIN}` },
      createdAt: { gt: new Date(Date.now() - 60_000) },
    },
  });
  if (recent >= MAX_NEW_DEMOS_PER_MINUTE) throw new DemoBusyError();

  await purgeDemos();

  const user = await db.user.create({
    data: { email: `demo-${randomUUID()}@${DEMO_DOMAIN}`, name: "Demo Guest" },
  });
  await db.demoPresence.create({ data: { userId: user.id } });

  const ws = await WorkspacesService.createWorkspace(
    user.id, "Tutorial Workspace", "private", "study",
  );

  let pageId: string | null = null;
  try {
    const surah = await WorkspacesService.startSurah(ws.id, 1, user.id);
    const page = await PagesService.createPage(
      surah.id, user.id, "The Names of al-Fātiḥah", fatihaNotesDoc(),
    );
    pageId = page.id;

    /* Two Connections so the list and the map are not empty when the tour
       reaches them — one crossing sūrahs, one staying inside al-Fātiḥah,
       because the map draws those differently. */
    await Promise.allSettled(
      DEMO_CONNECTIONS.map((c) =>
        createConnection(ws.id, user.id, { ...c, tags: [...c.tags] })),
    );
  } catch {
    /* Seeding is best-effort. An unseeded workspace is a worse demo, not a
       broken one, and failing here would turn a visitor away at the door. */
  }

  // Browser-session cookie: the demo ends when the browser closes.
  await createSession(user.id, { ephemeral: true });
  // The flag the page reads to check in, and to say goodbye when it closes.
  (await cookies()).set(DEMO_FLAG, "1", { path: "/", sameSite: "lax" });

  return { userId: user.id, workspaceId: ws.id, pageId };
}
