/**
 * /workspaces/[workspaceId]/arabic/quran?surah=N&page=P&word=s:a:w
 *
 * The way into the Qurʾān from an Arabic study workspace. It is the same
 * Qurʾān study page — same Mushaf, same note space — opened in this
 * workspace, where it also colours the words you know and analyses a word
 * you open (ModeBPage `arabic`). This route makes the sūrah's session and a
 * page for it the first time, then sends you there; `page` and `word` carry
 * through so a word's āyāt open on that page with that word already open.
 */

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import * as ArabicService from "@/lib/services/arabic.service";
import * as WorkspacesService from "@/lib/services/workspaces.service";
import * as PagesService from "@/lib/services/pages.service";
import { fetchChapter } from "@/lib/quran-api";

export default async function ArabicQuranPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ surah?: string; page?: string; word?: string }>;
}) {
  const { workspaceId } = await params;
  const { surah, page, word } = await searchParams;
  const { userId } = await getSession();
  // The gate: an Arabic study workspace this reader belongs to.
  await ArabicService.listLessons(workspaceId, userId);

  const n = Math.min(114, Math.max(1, Number(surah) || 1));
  const session = await WorkspacesService.startSurah(workspaceId, n, userId);
  let first = await db.page.findFirst({
    where:   { workspaceSurahId: session.id },
    orderBy: { orderIndex: "asc" },
    select:  { id: true },
  });
  if (!first) {
    const chapter = await fetchChapter(n);
    first = await PagesService.createPage(session.id, userId, chapter.name_simple);
  }

  const q = new URLSearchParams({ mode: "canvas" });
  if (Number(page)) q.set("mpage", String(Number(page)));
  if (/^\d{1,3}:\d{1,3}:\d{1,3}$/.test(word ?? "")) q.set("word", word!);
  redirect(`/workspaces/${workspaceId}/surahs/${n}/pages/${first.id}?${q}`);
}
