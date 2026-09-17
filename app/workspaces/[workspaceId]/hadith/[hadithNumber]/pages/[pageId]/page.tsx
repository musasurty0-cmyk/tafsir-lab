/**
 * /workspaces/[workspaceId]/hadith/[n]/pages/[pageId]
 *
 * One hadith, open for study. The hadith text itself is vendored and needs no
 * round trip, so the only work here is access control and the page row.
 */

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getWorkspaceWithRole } from "@/lib/services/workspaces.service";
import { getHadith, HADITH_COUNT } from "@/lib/hadith";
import HadithShell from "@/components/workspace/HadithShell";

export default async function HadithPageView({
  params,
}: {
  params: Promise<{ workspaceId: string; hadithNumber: string; pageId: string }>;
}) {
  const { workspaceId, hadithNumber, pageId } = await params;
  const n = parseInt(hadithNumber, 10);
  const hadith = getHadith(n);
  if (!hadith) notFound();

  const { userId } = await getSession();

  const [gate, page, user] = await Promise.all([
    getWorkspaceWithRole(workspaceId, userId).catch(() => null),
    db.page.findUnique({
      where:  { id: pageId },
      select: { id: true, workspaceSurah: { select: { workspaceId: true, surahNumber: true } } },
    }),
    db.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  if (!gate) notFound();
  if (gate.workspace.kind !== "nawawi") notFound();
  /* The page must really belong to THIS hadith in THIS workspace. Without
     this, a valid page id from anywhere else would render under a hadith it
     has nothing to do with, and the reader's notes would appear attached to
     the wrong narration. */
  if (!page || page.workspaceSurah.workspaceId !== workspaceId
      || page.workspaceSurah.surahNumber !== n) {
    notFound();
  }

  return (
    <HadithShell
      workspaceId={workspaceId}
      workspaceName={gate.workspace.name}
      pageId={page.id}
      hadith={hadith}
      prevNumber={n > 1 ? n - 1 : null}
      nextNumber={n < HADITH_COUNT ? n + 1 : null}
      role={gate.role}
      currentUserId={userId}
      currentUserName={user?.name ?? "You"}
    />
  );
}
