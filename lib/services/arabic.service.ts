/**
 * Arabic study workspaces — imported flashcard decks and where each reader is.
 *
 * Decks are imported by the reader from their own course files (see
 * lib/arabic/parse). Nothing here assumes a level's length: a level holds
 * whatever has been imported, and grows as the course releases more.
 */

import { db } from "@/lib/db";
import { getWorkspaceWithRole, isAdmin } from "@/lib/services/workspaces.service";
import {
  numberLessons, foldArabic, lessonKind, cleanTitle, HAS_ARABIC,
  MAX_LESSONS, MAX_CARDS, MAX_FIELD, MAX_TITLE, type ParsedLesson,
} from "@/lib/arabic/parse";

export class ArabicError extends Error {
  constructor(message: string, public readonly code: "NOT_FOUND" | "FORBIDDEN" | "INVALID") {
    super(message);
    this.name = "ArabicError";
  }
}

export type LessonState = "covered" | "current";

async function gate(workspaceId: string, userId: string) {
  const g = await getWorkspaceWithRole(workspaceId, userId);
  if (g.workspace.kind !== "arabic") throw new ArabicError("This isn't an Arabic study workspace.", "NOT_FOUND");
  return g;
}

// ── Reading ────────────────────────────────────────────────────────────────

export async function listLessons(workspaceId: string, userId: string) {
  await gate(workspaceId, userId);
  const lessons = await db.arabicLesson.findMany({
    where:   { workspaceId },
    orderBy: [{ level: "asc" }, { fileNo: "asc" }],
    select:  {
      id: true, level: true, fileNo: true, number: true, kind: true, title: true, cardCount: true,
      states: { where: { userId }, select: { state: true } },
    },
  });
  return lessons.map(({ states, ...l }) => ({ ...l, state: (states[0]?.state ?? null) as LessonState | null }));
}

export async function getLesson(workspaceId: string, lessonId: string, userId: string) {
  await gate(workspaceId, userId);
  const lesson = await db.arabicLesson.findFirst({
    where:  { id: lessonId, workspaceId },
    select: {
      id: true, level: true, fileNo: true, number: true, kind: true, title: true, cardCount: true,
      states: { where: { userId }, select: { state: true } },
      cards:  {
        orderBy: { ord: "asc" },
        select:  { id: true, grp: true, english: true, arabic: true, translit: true, gender: true, isSentence: true },
      },
    },
  });
  if (!lesson) throw new ArabicError("Lesson not found", "NOT_FOUND");
  const { states, ...rest } = lesson;
  return { ...rest, state: (states[0]?.state ?? null) as LessonState | null };
}

/** Matching cards across the workspace, English or Arabic, ḥarakāt optional. */
export async function search(workspaceId: string, userId: string, raw: string) {
  await gate(workspaceId, userId);
  const q = raw.trim().slice(0, 80);
  if (q.length < 2 && !/[؀-ۿ]/.test(q)) return [];
  const arabic = /[؀-ۿ]/.test(q);
  const term = arabic ? foldArabic(q) : q;
  if (!term) return [];
  const cards = await db.arabicCard.findMany({
    where: {
      lesson: { workspaceId },
      ...(arabic
        ? { folded: { contains: term } }
        : { english: { contains: term, mode: "insensitive" as const } }),
    },
    take:    40,
    orderBy: [{ isSentence: "asc" }, { lesson: { level: "asc" } }, { lesson: { fileNo: "asc" } }, { ord: "asc" }],
    select:  {
      id: true, english: true, arabic: true, translit: true, gender: true, isSentence: true,
      lesson: { select: { id: true, level: true, number: true, kind: true, title: true } },
    },
  });
  return cards;
}

// ── Writing ────────────────────────────────────────────────────────────────

interface IncomingLesson { level: unknown; fileNo: unknown; title: unknown; cards: unknown }
interface IncomingCard {
  english: unknown; arabic: unknown; translit?: unknown; gender?: unknown; group?: unknown; isSentence?: unknown;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const int = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null;

/**
 * Validate what the browser parsed. The client's parse is a preview; this is
 * the import, so every field is bounded and reshaped here rather than trusted.
 */
function sanitise(raw: unknown): ParsedLesson[] {
  if (!Array.isArray(raw)) throw new ArabicError("Nothing to import.", "INVALID");
  if (raw.length > MAX_LESSONS) throw new ArabicError(`At most ${MAX_LESSONS} lessons at once.`, "INVALID");
  let total = 0;
  const lessons: ParsedLesson[] = [];
  for (const l of raw as IncomingLesson[]) {
    const level = int(l?.level, 1, 99);
    const fileNo = int(l?.fileNo, 0, 999);
    if (level == null || fileNo == null || !Array.isArray(l.cards)) continue;
    const title = cleanTitle(str(l.title, MAX_TITLE));
    const cards = (l.cards as IncomingCard[]).flatMap((c) => {
      const english = str(c?.english, MAX_FIELD);
      const arabic  = str(c?.arabic, MAX_FIELD);
      if (!english || !HAS_ARABIC.test(arabic)) return [];
      const translit = str(c?.translit, MAX_FIELD) || null;
      const gender: "m" | "f" | null = c?.gender === "m" || c?.gender === "f" ? c.gender : null;
      return [{ english, arabic, translit, gender, group: int(c?.group, 0, 9999) ?? 0, isSentence: c?.isSentence === true }];
    });
    total += cards.length;
    if (total > MAX_CARDS) throw new ArabicError(`At most ${MAX_CARDS.toLocaleString()} cards at once.`, "INVALID");
    lessons.push({ level, fileNo, title, kind: lessonKind(fileNo, title), cards });
  }
  return lessons;
}

/**
 * Import decks. A lesson already in the workspace (same level and file
 * number) is left as it is, so dropping the same zip twice never duplicates
 * cards; new lessons are added and the whole workspace is renumbered.
 */
export async function importLessons(
  workspaceId: string, userId: string, raw: unknown,
  /** Where the reader says they are, by level and file number, if they said. */
  currentAt?: { level: number; fileNo: number } | null,
) {
  const { role } = await gate(workspaceId, userId);
  if (!isAdmin(role)) throw new ArabicError("Only the workspace's owner or admins can import lessons.", "FORBIDDEN");

  const incoming = sanitise(raw).filter((l) => l.cards.length > 0);
  const existing = await db.arabicLesson.findMany({
    where:  { workspaceId },
    select: { id: true, level: true, fileNo: true, title: true, kind: true },
  });
  const have = new Set(existing.map((l) => `${l.level}:${l.fileNo}`));
  const fresh = incoming.filter((l) => !have.has(`${l.level}:${l.fileNo}`));

  await db.$transaction(async (tx) => {
    for (const l of fresh) {
      const lesson = await tx.arabicLesson.create({
        data: { workspaceId, level: l.level, fileNo: l.fileNo, kind: l.kind, title: l.title, cardCount: l.cards.length },
        select: { id: true },
      });
      await tx.arabicCard.createMany({
        data: l.cards.map((c, i) => ({
          lessonId: lesson.id, ord: i, grp: c.group, english: c.english, arabic: c.arabic,
          translit: c.translit, gender: c.gender, isSentence: c.isSentence, folded: foldArabic(c.arabic),
        })),
      });
    }

    /* Numbers are recomputed across everything, old and new, so a revision
       lesson that arrives later shifts the numbering the way the course does. */
    const all = await tx.arabicLesson.findMany({
      where:  { workspaceId },
      select: { id: true, level: true, fileNo: true, title: true, kind: true, number: true },
    });
    const numbered = numberLessons(all.map((l) => ({ ...l, kind: l.kind as ParsedLesson["kind"], cards: [] })));
    for (const l of numbered) {
      if (all.find((a) => a.id === l.id)?.number !== l.number) {
        await tx.arabicLesson.update({ where: { id: l.id }, data: { number: l.number } });
      }
    }
  }, { timeout: 60_000 });

  if (currentAt) {
    const at = await db.arabicLesson.findFirst({
      where:  { workspaceId, level: currentAt.level, fileNo: currentAt.fileNo },
      select: { id: true },
    });
    if (at) await setCurrentLesson(workspaceId, userId, at.id);
  }

  return {
    added:   fresh.length,
    skipped: incoming.length - fresh.length,
    cards:   fresh.reduce((n, l) => n + l.cards.length, 0),
  };
}

/**
 * Say where you are: one lesson becomes current, everything before it in
 * course order covered, everything after it untouched. Per reader.
 */
export async function setCurrentLesson(workspaceId: string, userId: string, lessonId: string) {
  await gate(workspaceId, userId);
  const lessons = await db.arabicLesson.findMany({
    where:   { workspaceId },
    orderBy: [{ level: "asc" }, { fileNo: "asc" }],
    select:  { id: true },
  });
  const at = lessons.findIndex((l) => l.id === lessonId);
  if (at < 0) throw new ArabicError("Lesson not found", "NOT_FOUND");
  await db.$transaction([
    db.arabicLessonState.deleteMany({ where: { userId, lesson: { workspaceId } } }),
    db.arabicLessonState.createMany({
      data: lessons.slice(0, at + 1).map((l, i) => ({ userId, lessonId: l.id, state: i === at ? "current" : "covered" })),
    }),
  ]);
}

/** Tick or untick one lesson, or make it the current one, without touching the rest. */
export async function setLessonState(
  workspaceId: string, userId: string, lessonId: string, state: LessonState | null,
) {
  await gate(workspaceId, userId);
  const lesson = await db.arabicLesson.findFirst({ where: { id: lessonId, workspaceId }, select: { id: true } });
  if (!lesson) throw new ArabicError("Lesson not found", "NOT_FOUND");
  if (state === null) {
    await db.arabicLessonState.deleteMany({ where: { userId, lessonId } });
    return;
  }
  await db.$transaction(async (tx) => {
    // Only one lesson is current at a time; the previous one counts as covered.
    if (state === "current") {
      await tx.arabicLessonState.updateMany({
        where: { userId, state: "current", lesson: { workspaceId }, NOT: { lessonId } },
        data:  { state: "covered" },
      });
    }
    await tx.arabicLessonState.upsert({
      where:  { userId_lessonId: { userId, lessonId } },
      update: { state },
      create: { userId, lessonId, state },
    });
  });
}
