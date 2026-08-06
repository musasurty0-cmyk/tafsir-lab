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
import { db } from "@/lib/db";
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

/**
 * Discard demo accounts older than 24h. Best-effort and deliberately quiet:
 * a demo user who wrote a note inside somebody else's workspace cannot be
 * deleted (StructuredNote.author has no cascade), and that is correct — the
 * note outranks the cleanup.
 */
async function discardStaleDemos(): Promise<void> {
  const stale = await db.user.findMany({
    where: {
      email:     { endsWith: `@${DEMO_DOMAIN}` },
      createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
  });
  for (const u of stale) {
    try {
      await db.workspace.deleteMany({ where: { ownerId: u.id } });
      await db.user.delete({ where: { id: u.id } });
    } catch { /* has data outside their own workspaces — leave them */ }
  }
}

export async function provisionDemoSession(): Promise<DemoSession> {
  const recent = await db.user.count({
    where: {
      email:     { endsWith: `@${DEMO_DOMAIN}` },
      createdAt: { gt: new Date(Date.now() - 60_000) },
    },
  });
  if (recent >= MAX_NEW_DEMOS_PER_MINUTE) throw new DemoBusyError();

  await discardStaleDemos();

  const user = await db.user.create({
    data: { email: `demo-${randomUUID()}@${DEMO_DOMAIN}`, name: "Demo Guest" },
  });

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

  return { userId: user.id, workspaceId: ws.id, pageId };
}
