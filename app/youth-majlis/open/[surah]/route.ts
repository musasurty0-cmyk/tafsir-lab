/**
 * GET /youth-majlis/open/[surah]
 *
 * "Open in TafsirLab" from the Youth Majlis portal. Lands the student on the
 * sūrah in THEIR OWN "Youth Majlis" workspace, creating the workspace the
 * first time and the sūrah's first page the first time it is opened — so
 * everything they study for the Majlis gathers in one place, alongside the
 * rest of their TafsirLab, rather than scattered across whichever workspace
 * happened to be open.
 *
 * Not signed in to TafsirLab → the login page. Not through the portal's gate
 * → the portal, so this cannot be used to reach anything the gate guards.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/session";
import { db } from "@/lib/db";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService from "@/lib/services/pages.service";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { moduleBySurah } from "@/lib/youth-majlis/content";

const WORKSPACE_NAME = "Youth Majlis";

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

  // Their Youth Majlis workspace — found by name among those they own.
  let ws = await db.workspace.findFirst({
    where:   { ownerId: userId, name: WORKSPACE_NAME, kind: "study" },
    select:  { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!ws) ws = await WorkspacesService.createWorkspace(userId, WORKSPACE_NAME, "private", "study");

  const started = await WorkspacesService.startSurah(ws.id, surah, userId);
  let pageId = started.pages[0]?.id;
  if (!pageId) {
    const m = moduleBySurah(surah);
    const page = await PagesService.createPage(
      started.id, userId, m ? `Module ${m.n} — ${m.title}` : "Youth Majlis",
    );
    pageId = page.id;
  }

  return to(`/workspaces/${ws.id}/surahs/${surah}/pages/${pageId}`);
}
