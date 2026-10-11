/**
 * GET /youth-majlis/open/[surah]?point=N
 *
 * "Open in TafsirLab": the sūrah in the student's personal Youth Majlis
 * workspace (see lib/youth-majlis/workspace.ts — one per student, never
 * another), with the ten points as its tabs, landing on point N (default 1).
 *
 * Not signed in to TafsirLab → the login page. Not through the portal's gate
 * → the portal.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionOrNull } from "@/lib/session";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { joinCohort } from "@/lib/youth-majlis/data";
import { personalWorkspace, surahWithTabs } from "@/lib/youth-majlis/workspace";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ surah: string }> },
) {
  const { surah: raw } = await params;
  const surah = Number(raw);
  const point = Math.min(10, Math.max(1, Number(req.nextUrl.searchParams.get("point")) || 1));
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));

  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return to("/youth-majlis");
  if (!(await hasAccess("majlis"))) return to("/youth-majlis");

  const session = await getSessionOrNull();
  if (!session) return to("/login");

  if (!(await joinCohort(session.userId))) return to("/login");   // the account is gone
  const workspaceId = await personalWorkspace(session.userId);
  const tabs = await surahWithTabs(workspaceId, surah, session.userId);
  const pageId = tabs.get(point) ?? tabs.get(1);
  return to(`/workspaces/${workspaceId}/surahs/${surah}${pageId ? `/pages/${pageId}` : ""}`);
}
