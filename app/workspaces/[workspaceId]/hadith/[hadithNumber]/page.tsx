/**
 * /workspaces/[workspaceId]/hadith/[n] — open this hadith.
 *
 * A bare hadith number has no page of its own; it resolves to one. This exists
 * so the prev/next arrows in the shell, and any link anyone shares, can name a
 * hadith rather than a page id — the session is created on arrival if it does
 * not exist, and the reader lands on its first page either way.
 */

export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getWorkspaceWithRole } from "@/lib/services/workspaces.service";
import { getHadith } from "@/lib/hadith";

export default async function HadithEntry({
  params,
}: {
  params: Promise<{ workspaceId: string; hadithNumber: string }>;
}) {
  const { workspaceId, hadithNumber } = await params;
  const n = parseInt(hadithNumber, 10);
  const hadith = getHadith(n);
  if (!hadith) notFound();

  const { userId } = await getSession();
  const gate = await getWorkspaceWithRole(workspaceId, userId).catch(() => null);
  if (!gate || gate.workspace.kind !== "nawawi") notFound();

  /* Upsert, so two arrows pressed quickly cannot make two sessions for one
     hadith — the unique (workspace, number) pair settles it. */
  const session = await db.workspaceSurah.upsert({
    where:  { workspaceId_surahNumber: { workspaceId, surahNumber: n } },
    update: {},
    create: { workspaceId, surahNumber: n },
    select: { id: true },
  });

  const first = await db.page.findFirst({
    where:   { workspaceSurahId: session.id },
    orderBy: { orderIndex: "asc" },
    select:  { id: true },
  });

  const pageId = first?.id ?? (await db.page.create({
    data: {
      workspaceSurahId: session.id,
      title: hadith.title,
      orderIndex: 0,
      status: "draft",
      createdById: userId,
    },
    select: { id: true },
  })).id;

  redirect(`/workspaces/${workspaceId}/hadith/${n}/pages/${pageId}`);
}
