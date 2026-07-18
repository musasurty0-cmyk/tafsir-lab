/**
 * POST /api/auth/demo — open a throwaway demo session (no sign-in).
 *
 * Body: { code: string } — must match the demo code (env DEMO_CODE, default
 * "1653"; the code prompt is hidden behind the login-page logo).
 *
 * Creates an ephemeral demo user + a pre-seeded workspace (Sūrat Al-Fātiḥa
 * started with a first page), and sets a BROWSER-SESSION cookie — closing the
 * browser ends the demo. Demo data is discarded: every call also deletes demo
 * accounts (and everything they made) older than 24 hours.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomUUID }   from "crypto";
import { db }           from "@/lib/db";
import { createSession } from "@/lib/session";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService      from "@/lib/services/pages.service";

const DEMO_DOMAIN = "demo.tafsirlab.local";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json().catch(() => ({})) as { code?: string };
    const expected = process.env.DEMO_CODE ?? "1653";
    if (!code || code !== expected) {
      return NextResponse.json({ error: "Invalid code" }, { status: 403 });
    }

    // ── Opportunistic cleanup: discard demo accounts older than 24h ───────
    // (workspace deletion cascades surahs/pages/notes/drawings/activity)
    const stale = await db.user.findMany({
      where:  { email: { endsWith: `@${DEMO_DOMAIN}` }, createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      select: { id: true },
    });
    for (const u of stale) {
      try {
        await db.workspace.deleteMany({ where: { ownerId: u.id } });
        await db.user.delete({ where: { id: u.id } });
      } catch { /* skip users with data outside their own workspaces */ }
    }

    // ── Fresh demo user + seeded workspace ────────────────────────────────
    const user = await db.user.create({
      data: {
        email: `demo-${randomUUID()}@${DEMO_DOMAIN}`,
        name:  "Demo Guest",
      },
    });

    const ws = await WorkspacesService.createWorkspace(user.id, "Demo Workspace", "private", "study");
    try {
      const session = await WorkspacesService.startSurah(ws.id, 1, user.id);
      await PagesService.createPage(session.id, user.id, "Welcome");
    } catch { /* seeding is best-effort — the empty workspace still demos fine */ }

    // Browser-session cookie: demo ends when the browser closes.
    await createSession(user.id, { ephemeral: true });

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
