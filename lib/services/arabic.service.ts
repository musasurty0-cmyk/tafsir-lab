/**
 * Arabic study workspaces — imported flashcard decks and where each reader is.
 *
 * Decks are imported by the reader from their own course files (see
 * lib/arabic/parse). Nothing here assumes a level's length: a level holds
 * whatever has been imported, and grows as the course releases more.
 */

import { db } from "@/lib/db";
import { getWorkspaceWithRole, isAdmin } from "@/lib/services/workspaces.service";
import { createWorkspaceBoard } from "@/lib/services/pages.service";
import {
  numberLessons, foldArabic, lessonKind, cleanTitle, HAS_ARABIC,
  MAX_LESSONS, MAX_CARDS, MAX_FIELD, MAX_TITLE, type ParsedLesson,
} from "@/lib/arabic/parse";
import { nextBox, dueAfter, unlockBox, statusOf, LEARNT_FROM, type Status } from "@/lib/arabic/srs";

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

// ── Review (phase 2) ───────────────────────────────────────────────────────

export type ReviewScope = "due" | "lesson" | "unlock" | "cards";

/** The lesson that holds words a reader adds themselves, from the Qurʾān. */
export const MY_WORDS = { level: 0, fileNo: 0, kind: "mine", title: "My words" } as const;

export interface ReviewCard {
  id: string; lessonId: string; english: string; arabic: string; translit: string | null;
  gender: string | null; isSentence: boolean; box: number; due: boolean;
}

/** New cards a daily session takes from covered lessons, on top of what is due. */
export const NEW_PER_SESSION = 15;

/**
 * What to practise.
 *  - due: every seen card now due, plus new cards from lessons you have
 *    covered, in course order. Lessons you have not reached stay out.
 *  - lesson: every card in one lesson, whatever its state.
 *  - unlock: the cards in one lesson you have never answered — the one-time
 *    pass that tells the schedule what you already know.
 * `pool` is the words and meanings wrong answers are drawn from: the same
 * level, so a distractor is a word you could plausibly confuse it with.
 */
export async function reviewQueue(
  workspaceId: string, userId: string,
  opts: { scope: ReviewScope; lessonId?: string; cardIds?: string[]; sentences: boolean; limit: number },
) {
  await gate(workspaceId, userId);
  const now = new Date();
  const cardSelect = {
    id: true, lessonId: true, english: true, arabic: true, translit: true, gender: true, isSentence: true,
    reviews: { where: { userId }, select: { box: true, due: true } },
  } as const;
  type Row = Omit<ReviewCard, "box" | "due"> & { reviews: { box: number; due: Date }[] };
  const shape = ({ reviews, ...rest }: Row): ReviewCard => {
    const r = reviews[0];
    return { ...rest, box: r?.box ?? 0, due: !r || r.due <= now };
  };
  const sentenceFilter = opts.sentences ? {} : { isSentence: false };
  let cards: ReviewCard[];

  if (opts.scope === "due") {
    const seen = await db.arabicCard.findMany({
      where:  { lesson: { workspaceId }, ...sentenceFilter, reviews: { some: { userId, due: { lte: now } } } },
      select: cardSelect,
      take:   400,
    });
    const reached = await db.arabicLessonState.findMany({
      where:  { userId, lesson: { workspaceId } },
      select: { lessonId: true },
    });
    const fresh = reached.length === 0 ? [] : await db.arabicCard.findMany({
      where:   { lessonId: { in: reached.map((r) => r.lessonId) }, ...sentenceFilter, reviews: { none: { userId } } },
      orderBy: [{ lesson: { level: "asc" } }, { lesson: { fileNo: "asc" } }, { ord: "asc" }],
      select:  cardSelect,
      take:    NEW_PER_SESSION,
    });
    // Due cards shuffled, so the same run never comes back in the same order.
    cards = [...shuffle(seen.map(shape)), ...fresh.map(shape)];
  } else if (opts.scope === "cards") {
    // A chosen set — the words on a Qurʾān page you are reading.
    const ids = (opts.cardIds ?? []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
    if (ids.length === 0) throw new ArabicError("Choose some cards.", "INVALID");
    const rows = await db.arabicCard.findMany({
      where:  { id: { in: ids }, lesson: { workspaceId }, ...sentenceFilter },
      select: cardSelect,
    });
    cards = shuffle(rows.map(shape));
  } else {
    if (!opts.lessonId) throw new ArabicError("Choose a lesson.", "INVALID");
    const lesson = await db.arabicLesson.findFirst({ where: { id: opts.lessonId, workspaceId }, select: { id: true } });
    if (!lesson) throw new ArabicError("Lesson not found", "NOT_FOUND");
    const rows = await db.arabicCard.findMany({
      where:   {
        lessonId: lesson.id, ...sentenceFilter,
        ...(opts.scope === "unlock" ? { reviews: { none: { userId } } } : {}),
      },
      orderBy: { ord: "asc" },
      select:  cardSelect,
    });
    cards = rows.map(shape);
    if (opts.scope === "lesson") cards = shuffle(cards);
  }
  cards = cards.slice(0, Math.max(1, Math.min(opts.limit, 500)));

  // Distractors: the same levels as the cards being asked.
  const lessonIds = [...new Set(cards.map((c) => c.lessonId))];
  const levels = lessonIds.length
    ? [...new Set((await db.arabicLesson.findMany({ where: { id: { in: lessonIds } }, select: { level: true } })).map((l) => l.level))]
    : [];
  const poolSelect = { id: true, lessonId: true, english: true, arabic: true, isSentence: true } as const;
  let pool = levels.length === 0 ? [] : await db.arabicCard.findMany({
    where:  { lesson: { workspaceId, level: { in: levels } } },
    select: poolSelect,
    take:   4000,
  });
  // A handful of your own words is too few to choose wrong answers from.
  if (pool.length < 12) {
    pool = await db.arabicCard.findMany({ where: { lesson: { workspaceId } }, select: poolSelect, take: 4000 });
  }

  return { cards, pool };
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Record answers. Right moves a card up a box, wrong drops it to the first.
 * Answering a card that was not yet due is extra practice: a right answer
 * does not move it (it would be learnt by cramming), but a wrong one does —
 * a miss is real news whenever it happens.
 */
export async function recordAnswers(workspaceId: string, userId: string, raw: unknown) {
  await gate(workspaceId, userId);
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 200) {
    throw new ArabicError("Send between 1 and 200 answers.", "INVALID");
  }
  const answers = (raw as { cardId?: unknown; correct?: unknown; unlock?: unknown }[])
    .filter((a) => typeof a?.cardId === "string" && typeof a?.correct === "boolean")
    .map((a) => ({ cardId: a.cardId as string, correct: a.correct as boolean, unlock: a.unlock === true }));
  if (answers.length === 0) throw new ArabicError("No valid answers.", "INVALID");

  // Only cards in this workspace.
  const ids = [...new Set(answers.map((a) => a.cardId))];
  const valid = new Set((await db.arabicCard.findMany({
    where: { id: { in: ids }, lesson: { workspaceId } }, select: { id: true },
  })).map((c) => c.id));
  const known = new Map((await db.arabicReview.findMany({
    where: { userId, cardId: { in: ids } }, select: { cardId: true, box: true, due: true },
  })).map((r) => [r.cardId, r]));

  const now = Date.now();
  const writes = [];
  const result: Record<string, { box: number; status: Status }> = {};
  for (const a of answers) {
    if (!valid.has(a.cardId)) continue;
    const prev = known.get(a.cardId);
    let box: number;
    if (!prev) box = a.unlock ? unlockBox(a.correct) : nextBox(0, a.correct ? "good" : "again");
    else if (!a.correct) box = nextBox(prev.box, "again");
    else if (prev.due.getTime() > now) box = prev.box;            // extra practice
    else box = nextBox(prev.box, "good");
    const unchanged = !!prev && box === prev.box && a.correct;
    const due = unchanged ? prev!.due : dueAfter(box, now);
    const lapse = prev && !a.correct && prev.box >= LEARNT_FROM ? 1 : 0;
    known.set(a.cardId, { cardId: a.cardId, box, due });
    result[a.cardId] = { box, status: statusOf(box) };
    writes.push(db.arabicReview.upsert({
      where:  { userId_cardId: { userId, cardId: a.cardId } },
      update: { box, due, reps: { increment: 1 }, lapses: { increment: lapse }, lastAt: new Date(now) },
      create: { userId, cardId: a.cardId, box, due, reps: 1, lapses: 0, lastAt: new Date(now) },
    }));
  }
  if (writes.length) await db.$transaction(writes);
  return result;
}

/** Per-lesson counts of learning and learnt cards, and how many are due now. */
export async function reviewSummary(workspaceId: string, userId: string) {
  await gate(workspaceId, userId);
  const rows = await db.$queryRaw<{ lessonId: string; learning: bigint; learnt: bigint; due: bigint }[]>`
    SELECT c."lessonId",
           count(*) FILTER (WHERE r.box BETWEEN 1 AND ${LEARNT_FROM - 1}) AS learning,
           count(*) FILTER (WHERE r.box >= ${LEARNT_FROM})                AS learnt,
           count(*) FILTER (WHERE r.due <= now())                          AS due
    FROM "ArabicReview" r
    JOIN "ArabicCard" c   ON c.id = r."cardId"
    JOIN "ArabicLesson" l ON l.id = c."lessonId"
    WHERE r."userId" = ${userId}::uuid AND l."workspaceId" = ${workspaceId}::uuid
    GROUP BY c."lessonId"`;
  const byLesson: Record<string, { learning: number; learnt: number; due: number }> = {};
  let due = 0;
  for (const r of rows) {
    byLesson[r.lessonId] = { learning: Number(r.learning), learnt: Number(r.learnt), due: Number(r.due) };
    due += Number(r.due);
  }
  // New cards waiting in lessons you have reached count towards today's session.
  const fresh = await db.arabicCard.count({
    where: {
      isSentence: false,
      lesson: { workspaceId, states: { some: { userId } } },
      reviews: { none: { userId } },
    },
  });
  return { byLesson, due, fresh: Math.min(fresh, NEW_PER_SESSION), freshTotal: fresh };
}

/** Each card's box for this reader, for one lesson — the dots on its cards. */
export async function lessonBoxes(workspaceId: string, userId: string, lessonId: string) {
  await gate(workspaceId, userId);
  const rows = await db.arabicReview.findMany({
    where:  { userId, card: { lessonId, lesson: { workspaceId } } },
    select: { cardId: true, box: true },
  });
  return Object.fromEntries(rows.map((r) => [r.cardId, r.box]));
}

/**
 * Every single-word card in the workspace with this reader's box — what the
 * Arabic workspace's Qurʾān colours its words by, and lists under a word.
 */
export async function wordCards(workspaceId: string, userId: string) {
  await gate(workspaceId, userId);
  const cards = await db.arabicCard.findMany({
    where:   { lesson: { workspaceId }, isSentence: false },
    orderBy: [{ lesson: { level: "asc" } }, { lesson: { fileNo: "asc" } }, { ord: "asc" }],
    select:  {
      id: true, english: true, arabic: true,
      lesson:  { select: { id: true, level: true, number: true, kind: true, title: true } },
      reviews: { where: { userId }, select: { box: true } },
    },
    take: 6000,
  });
  return cards.map(({ reviews, ...c }) => ({ ...c, box: reviews[0]?.box ?? 0 }));
}

/**
 * The lesson's board — notes document and canvas — made the first time it
 * is opened, on the workspace's board container like any other board, and
 * shared by everyone in the workspace the way boards are.
 */
export async function lessonBoard(workspaceId: string, userId: string, lessonId: string) {
  await gate(workspaceId, userId);
  const lesson = await db.arabicLesson.findFirst({
    where:  { id: lessonId, workspaceId },
    select: { id: true, level: true, number: true, kind: true, title: true, pageId: true },
  });
  if (!lesson) throw new ArabicError("Lesson not found", "NOT_FOUND");
  if (lesson.pageId) {
    const exists = await db.page.findUnique({ where: { id: lesson.pageId }, select: { id: true } });
    if (exists) return exists.id;
  }
  const label = lesson.number != null ? `Lesson ${lesson.number}` : lesson.kind === "prep" ? "Preparation" : "Revision";
  const page = await createWorkspaceBoard(workspaceId, userId, `Level ${lesson.level} · ${label} · ${lesson.title}`.slice(0, 80));
  await db.arabicLesson.update({ where: { id: lesson.id }, data: { pageId: page.id } });
  return page.id;
}

/**
 * Add a word you met in the Qurʾān to "My words". It goes in as learning,
 * due now, so today's review picks it up straight away. Adding the same word
 * twice returns the card already there.
 */
export async function addMyWord(
  workspaceId: string, userId: string,
  raw: { arabic?: unknown; english?: unknown; translit?: unknown },
) {
  await gate(workspaceId, userId);
  const arabic = typeof raw.arabic === "string" ? raw.arabic.trim().slice(0, MAX_FIELD) : "";
  const english = typeof raw.english === "string" ? raw.english.trim().slice(0, MAX_FIELD) : "";
  const translit = typeof raw.translit === "string" ? raw.translit.trim().slice(0, MAX_FIELD) || null : null;
  if (!HAS_ARABIC.test(arabic) || !english) throw new ArabicError("A word needs its Arabic and its meaning.", "INVALID");

  const lesson = await db.arabicLesson.upsert({
    where:  { workspaceId_level_fileNo: { workspaceId, level: MY_WORDS.level, fileNo: MY_WORDS.fileNo } },
    update: {},
    create: { workspaceId, level: MY_WORDS.level, fileNo: MY_WORDS.fileNo, kind: MY_WORDS.kind, title: MY_WORDS.title },
    select: { id: true, cardCount: true },
  });
  const folded = foldArabic(arabic);
  const already = await db.arabicCard.findFirst({ where: { lessonId: lesson.id, folded }, select: { id: true } });
  if (already) return { cardId: already.id, added: false };

  const card = await db.$transaction(async (tx) => {
    const c = await tx.arabicCard.create({
      data: { lessonId: lesson.id, ord: lesson.cardCount, english, arabic, translit, isSentence: false, folded },
      select: { id: true },
    });
    await tx.arabicLesson.update({ where: { id: lesson.id }, data: { cardCount: { increment: 1 } } });
    await tx.arabicReview.create({ data: { userId, cardId: c.id, box: 1, due: new Date() } });
    return c;
  });
  return { cardId: card.id, added: true };
}
