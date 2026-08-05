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
import { memoryLimit, clientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-errors";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService      from "@/lib/services/pages.service";

const DEMO_DOMAIN = "demo.tafsirlab.local";

export async function POST(req: NextRequest) {
  try {
    // Fail closed. There used to be a fallback of "1653" here, which meant an
    // unset DEMO_CODE left demo mode wide open on a value committed to the
    // repo — anyone could mint real sessions. With no env var set, demo mode
    // is simply OFF, and the endpoint reveals nothing about why.
    const expected = process.env.DEMO_CODE;
    if (!expected) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { code } = await req.json().catch(() => ({})) as { code?: string };
    if (!code || code !== expected) {
      return NextResponse.json({ error: "Invalid code" }, { status: 403 });
    }

    // ── Rate limit ────────────────────────────────────────────────────────
    // Two layers (see lib/rate-limit). The memory layer sheds a flood on one
    // instance; the DB count is the real ceiling and survives serverless.
    const ip = clientIp(req);
    if (!memoryLimit(`demo:${ip}`, 5, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const recentDemos = await db.user.count({
      where: {
        email:     { endsWith: `@${DEMO_DOMAIN}` },
        createdAt: { gt: new Date(Date.now() - 60_000) },
      },
    });
    if (recentDemos >= 30) {
      return NextResponse.json({ error: "Demo is busy — try again shortly" }, { status: 429 });
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
    return apiError(err);
  }
}
