/**
 * Analytics — everything a user has actually written, counted.
 *
 * There are no counters anywhere in this file. Totals, the activity calendar
 * and the streak are all derived from the rows themselves on read, because a
 * denormalised `annotationCount` drifts the first time a delete misses its
 * decrement, and a streak stored as an integer is wrong for anyone who edits
 * an old note or crosses a timezone. Reading is cheap here: a user's notes are
 * in the thousands, not the millions, and the queries below are indexed on the
 * columns they filter.
 *
 * "Annotation" means a StructuredNote — a thing with words in it. Ink
 * (CanvasDrawing) is one row per page+author holding a stroke array, so it
 * cannot be counted per mark; it contributes "this page has ink", never a
 * number. Saying so is more honest than inflating a total with a figure that
 * means something different.
 */

import { db } from "@/lib/db";

// ── Types ──────────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  total:        number;
  surahs:       number;      // distinct surahs touched
  surahsTotal:  number;      // 114
  pages:        number;      // distinct mushaf sheets touched
  pagesTotal:   number;      // 604
  streak:       number;      // consecutive days ending today (or yesterday)
  bestStreak:   number;
  todayCount:   number;
  dailyGoal:    number;
  mostAnnotated: { surahNumber: number; count: number } | null;
}

export interface DayCount { day: string; count: number }   // day = "YYYY-MM-DD"

export type MapScope = "all" | "pages" | "surahs" | "verses" | "words";

export interface MapRow {
  kind:        "page" | "surah" | "verse" | "word";
  surahNumber: number | null;
  ayahNumber:  number | null;
  mushafPage:  number | null;
  count:       number;
  lastAt:      string;
}

const SURAHS_TOTAL = 114;
const PAGES_TOTAL  = 604;

/** Local calendar day for a timestamp, as YYYY-MM-DD. */
function dayKey(d: Date, tzOffsetMinutes: number): string {
  const shifted = new Date(d.getTime() - tzOffsetMinutes * 60_000);
  return shifted.toISOString().slice(0, 10);
}

/**
 * Consecutive days ending today, and the longest run ever.
 *
 * A streak that breaks the moment the clock passes midnight would punish
 * someone mid-session, so today counts as unbroken whether or not it has an
 * annotation yet: the run is allowed to end on today OR yesterday. `days` must
 * be sorted ascending and free of duplicates.
 */
export function streakFromDays(days: string[], today: string): { current: number; best: number } {
  if (days.length === 0) return { current: 0, best: 0 };

  const step = (a: string, b: string) =>
    (Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86_400_000;

  let best = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    run = step(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  const last = days[days.length - 1];
  const gap  = step(last, today);
  const current = gap === 0 || gap === 1 ? run : 0;

  return { current, best };
}

// ── Queries ────────────────────────────────────────────────────────────────

/**
 * Headline numbers for the Activity tab.
 *
 * tzOffsetMinutes is the viewer's offset from UTC (what `getTimezoneOffset()`
 * returns), passed in from the client. Without it a user in NZ sees their
 * evening's work land on tomorrow's square.
 */
export async function summary(userId: string, tzOffsetMinutes = 0): Promise<AnalyticsSummary> {
  const [notes, user] = await Promise.all([
    db.structuredNote.findMany({
      where:  { authorId: userId },
      select: { createdAt: true, surahNumber: true, mushafPage: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { dailyGoal: true } }),
  ]);

  const today = dayKey(new Date(), tzOffsetMinutes);
  const dayset = new Set<string>();
  const surahs = new Set<number>();
  const pages  = new Set<number>();
  const perSurah = new Map<number, number>();
  let todayCount = 0;

  for (const n of notes) {
    const d = dayKey(n.createdAt, tzOffsetMinutes);
    dayset.add(d);
    if (d === today) todayCount++;
    if (n.surahNumber != null) {
      surahs.add(n.surahNumber);
      perSurah.set(n.surahNumber, (perSurah.get(n.surahNumber) ?? 0) + 1);
    }
    if (n.mushafPage != null && n.mushafPage > 0) pages.add(n.mushafPage);
  }

  const { current, best } = streakFromDays([...dayset].sort(), today);

  let mostAnnotated: AnalyticsSummary["mostAnnotated"] = null;
  for (const [surahNumber, count] of perSurah) {
    if (!mostAnnotated || count > mostAnnotated.count) mostAnnotated = { surahNumber, count };
  }

  return {
    total: notes.length,
    surahs: surahs.size, surahsTotal: SURAHS_TOTAL,
    pages: pages.size,   pagesTotal: PAGES_TOTAL,
    streak: current, bestStreak: best,
    todayCount, dailyGoal: user?.dailyGoal ?? 10,
    mostAnnotated,
  };
}

/** Per-day counts across a closed date range, for the activity calendar. */
export async function daily(
  userId: string, fromISO: string, toISO: string, tzOffsetMinutes = 0,
): Promise<DayCount[]> {
  const notes = await db.structuredNote.findMany({
    where: {
      authorId:  userId,
      // Widened a day each way so a note near the boundary still lands on the
      // right local square after the timezone shift below.
      createdAt: { gte: new Date(Date.parse(fromISO) - 86_400_000),
                   lt:  new Date(Date.parse(toISO)   + 86_400_000) },
    },
    select: { createdAt: true },
  });

  const counts = new Map<string, number>();
  for (const n of notes) {
    const d = dayKey(n.createdAt, tzOffsetMinutes);
    if (d < fromISO || d > toISO) continue;      // trim the widened edges
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  return [...counts].map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * The annotation map: what has been annotated, grouped by the chosen scope.
 *
 * `annotatedOnly` false is not "list all 604 pages" — the caller renders the
 * empty slots itself from pagesTotal/surahsTotal. This only ever returns rows
 * that exist, so the query stays proportional to what the user has written.
 */
export async function map(
  userId: string, scope: MapScope, workspaceId?: string,
): Promise<MapRow[]> {
  const notes = await db.structuredNote.findMany({
    where: {
      authorId: userId,
      ...(workspaceId
        ? { page: { workspaceSurah: { workspaceId } } }
        : {}),
    },
    select: {
      anchorType: true, surahNumber: true, ayahNumber: true,
      wordPosition: true, mushafPage: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const bucket = new Map<string, MapRow>();
  const add = (key: string, row: Omit<MapRow, "count" | "lastAt">, at: Date) => {
    const hit = bucket.get(key);
    if (hit) { hit.count++; return; }
    bucket.set(key, { ...row, count: 1, lastAt: at.toISOString() });
  };

  for (const n of notes) {
    const isWord  = n.wordPosition != null;
    const isVerse = !isWord && n.ayahNumber != null;
    const isSurah = !isWord && !isVerse && n.surahNumber != null;
    const isPage  = n.mushafPage != null && n.mushafPage > 0;

    if ((scope === "all" || scope === "words") && isWord)
      add(`w:${n.surahNumber}:${n.ayahNumber}:${n.wordPosition}`,
          { kind: "word", surahNumber: n.surahNumber, ayahNumber: n.ayahNumber, mushafPage: n.mushafPage }, n.createdAt);

    if ((scope === "all" || scope === "verses") && isVerse)
      add(`v:${n.surahNumber}:${n.ayahNumber}`,
          { kind: "verse", surahNumber: n.surahNumber, ayahNumber: n.ayahNumber, mushafPage: n.mushafPage }, n.createdAt);

    if ((scope === "all" || scope === "surahs") && (isSurah || n.surahNumber != null))
      add(`s:${n.surahNumber}`,
          { kind: "surah", surahNumber: n.surahNumber, ayahNumber: null, mushafPage: null }, n.createdAt);

    if ((scope === "all" || scope === "pages") && isPage)
      add(`p:${n.mushafPage}`,
          { kind: "page", surahNumber: null, ayahNumber: null, mushafPage: n.mushafPage }, n.createdAt);
  }

  const order = { page: 0, surah: 1, verse: 2, word: 3 } as const;
  return [...bucket.values()].sort((a, b) =>
    order[a.kind] - order[b.kind] ||
    (a.surahNumber ?? a.mushafPage ?? 0) - (b.surahNumber ?? b.mushafPage ?? 0) ||
    (a.ayahNumber ?? 0) - (b.ayahNumber ?? 0));
}

/** Every note the user owns, flattened for export. */
export async function exportRows(userId: string) {
  return db.structuredNote.findMany({
    where:   { authorId: userId },
    orderBy: [{ surahNumber: "asc" }, { ayahNumber: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, noteType: true, anchorType: true, surahNumber: true,
      ayahNumber: true, wordPosition: true, mushafPage: true,
      content: true, color: true, createdAt: true,
      page: { select: { title: true, workspaceSurah: { select: { workspace: { select: { name: true } } } } } },
    },
  });
}
