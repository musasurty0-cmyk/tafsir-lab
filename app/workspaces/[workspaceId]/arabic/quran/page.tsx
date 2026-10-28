/**
 * /workspaces/[workspaceId]/arabic/quran?surah=N
 *   The Qurʾān inside an Arabic study workspace: the same Mushaf as Qurʾān
 *   study, but a tapped word opens what it is (root, grammar, your cards) and
 *   the words you are learning or have learnt are coloured.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import * as ArabicService from "@/lib/services/arabic.service";
import { fetchChapters } from "@/lib/quran-api";
import ArabicQuran from "@/components/workspace/arabic/ArabicQuran";

export default async function ArabicQuranPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ surah?: string; page?: string }>;
}) {
  const { workspaceId } = await params;
  const { surah, page } = await searchParams;
  const { userId } = await getSession();
  // The gate: this must be an Arabic study workspace the reader belongs to.
  await ArabicService.listLessons(workspaceId, userId);
  const chapters = await fetchChapters();
  const n = Math.min(114, Math.max(1, Number(surah) || 1));
  const ch = chapters.find((c) => c.id === n);
  const p = Number(page);
  const initialPage = ch && p >= ch.pages[0] && p <= ch.pages[1] ? p : undefined;
  return <ArabicQuran workspaceId={workspaceId} chapters={chapters} initialSurah={n} initialPage={initialPage} />;
}
