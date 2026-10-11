/**
 * GET /youth-majlis/assignment/[id]
 *
 * Opens a piece of assigned research where it is done: the point's tab for
 * that sūrah in the cohort's shared workspace, so the Majlis can go through
 * everyone's findings together. Until a shared workspace exists, it opens in
 * the student's own workspace instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionOrNull } from "@/lib/session";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { getSettings, joinCohort } from "@/lib/youth-majlis/data";
import { personalWorkspace, surahWithTabs } from "@/lib/youth-majlis/workspace";
import { MODULES } from "@/lib/youth-majlis/content";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const to = (path: string) => NextResponse.redirect(new URL(path, req.url));
  if (!(await hasAccess("majlis"))) return to("/youth-majlis");
  const session = await getSessionOrNull();
  if (!session) return to("/login");

  const a = await db.youthMajlisAssignment.findUnique({
    where: { id }, select: { point: true, session: { select: { moduleN: true } } },
  }).catch(() => null);
  const surah = a ? MODULES.find((m) => m.n === a.session.moduleN)?.surah : undefined;
  if (!a || !surah) return to("/youth-majlis");

  // Also adds them to the cohort workspace. Null: the account is gone.
  if (!(await joinCohort(session.userId))) return to("/login");
  const { cohortWorkspaceId } = await getSettings();
  const member = cohortWorkspaceId
    ? await db.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: cohortWorkspaceId, userId: session.userId } },
        select: { workspaceId: true },
      })
    : null;
  const workspaceId = member?.workspaceId ?? await personalWorkspace(session.userId);

  const tabs = await surahWithTabs(workspaceId, surah, session.userId);
  const pageId = tabs.get(a.point ?? 1) ?? tabs.get(1);
  return to(`/workspaces/${workspaceId}/surahs/${surah}${pageId ? `/pages/${pageId}` : ""}`);
}
