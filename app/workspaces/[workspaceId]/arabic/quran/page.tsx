/**
 * /workspaces/[workspaceId]/arabic/quran?surah=N
 *   The Qurʾān inside an Arabic study workspace: the same Mushaf as Qurʾān
 *   study, but a tapped word opens what it is (root, grammar, your cards) and
 *   the words you are learning or have learnt are coloured.
 */

export const dynamic = "force-dynamic";

import { getSession } from "@/lib/session";
import * as ArabicService from "@/lib/services/arabic.service";
import { fetchChapters, fetchVerses } from "@/lib/quran-api";
import ArabicQuran from "@/components/workspace/arabic/ArabicQuran";

export default async function ArabicQuranPage({
  params, searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ surah?: string; page?: string; word?: string }>;
}) {
  const { workspaceId } = await params;
  const { surah, page, word } = await searchParams;
  const { userId } = await getSession();
  // The gate: this must be an Arabic study workspace the reader belongs to.
  await ArabicService.listLessons(workspaceId, userId);
  const n = Math.min(114, Math.max(1, Number(surah) || 1));
  /* The sūrah's pages come from its own verses, exactly as Qurʾān study
     works them out — the chapter list's page range can stop a page short
     (it puts all of al-Ghāshiyah on 592; its last four āyāt are on 593). */
  const [chapters, verses] = await Promise.all([fetchChapters(), fetchVerses(n)]);
  const pages = [...new Set(verses.map((v) => v.page_number).filter(Boolean))].sort((a, b) => a - b);
  const p = Number(page);
  const initialPage = pages.includes(p) ? p : undefined;
  // ?word=s:a:w — arriving from a word's āyāt, that word opens selected.
  const m = /^(\d{1,3}):(\d{1,3}):(\d{1,3})$/.exec(word ?? "");
  const initialWord = m && Number(m[1]) === n ? { verseKey: `${m[1]}:${m[2]}`, position: Number(m[3]) } : undefined;
  return (
    <ArabicQuran
      key={n}
      workspaceId={workspaceId} chapters={chapters} pages={pages.length ? pages : undefined}
      initialSurah={n} initialPage={initialPage} initialWord={initialWord}
    />
  );
}
