/**
 * Youth Majlis — the server's view of the cohort.
 *
 * Sessions, membership, settings, and the one thing that makes the portal
 * honest: preparation measured from what a student has actually written in
 * TafsirLab, not from boxes they ticked. Each of the ten tabs is read and its
 * words counted; the question a tab opens with does not count as an answer.
 */

import { db } from "@/lib/db";
import { MODULES, QUESTIONS, TAB_TITLES } from "@/lib/youth-majlis/content";

// ── Dates (UK) ─────────────────────────────────────────────────────────────

/** Today's date in London, "YYYY-MM-DD". */
export function londonToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
}
/** A DATE column as "YYYY-MM-DD" (stored at UTC midnight). */
export const ymd = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
/** Whole days from today (London) to a "YYYY-MM-DD". */
export const daysUntil = (date: string) => Math.round((Date.parse(date) - Date.parse(londonToday())) / 86_400_000);
export function longDate(date: string, withWeekday = true): string {
  return new Intl.DateTimeFormat("en-GB", {
    ...(withWeekday ? { weekday: "long" as const } : {}), day: "numeric", month: "long", year: "numeric",
    timeZone: "Europe/London",
  }).format(new Date(`${date}T12:00:00Z`));
}

// ── Sessions ───────────────────────────────────────────────────────────────

export type PrepItem = { text: string };
export type AgendaItem = { time: string; item: string };

export interface SessionView {
  id: string; moduleN: number; seq: number; surah: number; surahEn: string;
  date: string | null; startTime: string | null; endTime: string | null; venue: string | null;
  ayahFrom: number | null; ayahTo: number | null;
  prep: PrepItem[]; prepDue: string | null; takeaways: string[];
  recordingUrl: string | null; followUp: string | null; agenda: AgendaItem[];
  assignments: AssignmentView[];
}
export interface AssignmentView {
  id: string; sessionId: string; point: number | null; ayahFrom: number | null; ayahTo: number | null;
  note: string | null; due: string | null; assignees: { userId: string; name: string }[];
}

const arr = <T>(v: unknown, ok: (x: unknown) => x is T): T[] => (Array.isArray(v) ? v.filter(ok) : []);
const isPrep = (x: unknown): x is PrepItem => !!x && typeof (x as PrepItem).text === "string";
const isStr = (x: unknown): x is string => typeof x === "string";
const isAgenda = (x: unknown): x is AgendaItem =>
  !!x && typeof (x as AgendaItem).time === "string" && typeof (x as AgendaItem).item === "string";

export async function getSessions(): Promise<SessionView[]> {
  const rows = await db.youthMajlisSession.findMany({
    orderBy: [{ moduleN: "asc" }, { seq: "asc" }],
    include: {
      assignments: {
        orderBy: [{ point: "asc" }, { createdAt: "asc" }],
        include: { assignees: { include: { user: { select: { id: true, name: true } } } } },
      },
    },
  });
  return rows.map((r) => {
    const m = MODULES.find((x) => x.n === r.moduleN);
    return {
      id: r.id, moduleN: r.moduleN, seq: r.seq, surah: m?.surah ?? 0, surahEn: m?.surahEn ?? "",
      date: ymd(r.date), startTime: r.startTime, endTime: r.endTime, venue: r.venue,
      ayahFrom: r.ayahFrom, ayahTo: r.ayahTo,
      prep: arr(r.prep, isPrep), prepDue: ymd(r.prepDue), takeaways: arr(r.takeaways, isStr),
      recordingUrl: r.recordingUrl, followUp: r.followUp, agenda: arr(r.agenda, isAgenda),
      assignments: r.assignments.map((a) => ({
        id: a.id, sessionId: a.sessionId, point: a.point, ayahFrom: a.ayahFrom, ayahTo: a.ayahTo,
        note: a.note, due: ymd(a.due),
        assignees: a.assignees.map((x) => ({ userId: x.user.id, name: x.user.name })),
      })),
    };
  });
}

/** The next gathering: the first dated session from today on. */
export function nextSession(sessions: SessionView[]): SessionView | null {
  const today = londonToday();
  return [...sessions].filter((s) => s.date && s.date >= today)
    .sort((a, b) => a.date!.localeCompare(b.date!))[0] ?? null;
}

/** The module being studied: the next session's, or else the most recent one's. */
export function currentModule(sessions: SessionView[]): number {
  const next = nextSession(sessions);
  if (next) return next.moduleN;
  const past = sessions.filter((s) => s.date).sort((a, b) => b.date!.localeCompare(a.date!));
  return past[0]?.moduleN ?? 1;
}

/** Has every session of a module happened? (And it is not the current one.) */
export function moduleDone(sessions: SessionView[], moduleN: number, current: number): boolean {
  if (moduleN === current) return false;
  const own = sessions.filter((s) => s.moduleN === moduleN && s.date);
  return own.length > 0 && own.every((s) => s.date! < londonToday());
}

// ── Settings ───────────────────────────────────────────────────────────────

export interface Settings { announcement?: string; cohortWorkspaceId?: string }

export async function getSettings(): Promise<Settings> {
  const row = await db.youthMajlisSettings.findUnique({ where: { id: "main" } });
  const d = (row?.data ?? {}) as Settings;
  return {
    announcement: typeof d.announcement === "string" && d.announcement.trim() ? d.announcement : undefined,
    cohortWorkspaceId: typeof d.cohortWorkspaceId === "string" ? d.cohortWorkspaceId : undefined,
  };
}

export async function saveSettings(patch: Settings): Promise<void> {
  const cur = await getSettings();
  const data = { ...cur, ...patch };
  await db.youthMajlisSettings.upsert({ where: { id: "main" }, create: { id: "main", data }, update: { data } });
}

// ── Membership ─────────────────────────────────────────────────────────────

export type Role = "student" | "organiser" | "left";

/** A signed-in visitor through the gate is in the cohort. Never demotes. */
export async function joinCohort(userId: string): Promise<{ role: Role; workspaceId: string | null }> {
  const row = await db.youthMajlisProgress.upsert({
    where: { userId }, create: { userId }, update: {},
    select: { role: true, workspaceId: true },
  });
  // Belong to the shared cohort workspace too, once there is one.
  const { cohortWorkspaceId } = await getSettings();
  if (cohortWorkspaceId && row.role !== "left") {
    await db.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: cohortWorkspaceId, userId } },
      create: { workspaceId: cohortWorkspaceId, userId, role: "member" },
      update: {},
    }).catch(() => { /* workspace gone: ignore */ });
  }
  return { role: row.role as Role, workspaceId: row.workspaceId };
}

export async function isOrganiser(userId: string): Promise<boolean> {
  const row = await db.youthMajlisProgress.findUnique({ where: { userId }, select: { role: true } });
  return row?.role === "organiser";
}

// ── The ten tabs, and how much is in them ──────────────────────────────────

export type TabState = "empty" | "started" | "written";
export interface TabStat { n: number; title: string; pageId: string | null; words: number; notes: number; state: TabState }

/** The leading number of a tab title — "4. Reason for Revelation" → 4. */
export const tabNumber = (title: string) => {
  const m = /^\s*(\d{1,2})\s*[.)\-:]/.exec(title);
  return m ? Number(m[1]) : null;
};

/** Words a student wrote in a tab's document. A heading that asks a question
 *  is the prompt, not the answer, so it is not counted. */
export function wordsIn(doc: unknown): number {
  let n = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const nd = node as { type?: string; text?: string; content?: unknown[] };
    if (nd.type === "heading") {
      const t = (nd.content ?? []).map((c) => (c as { text?: string }).text ?? "").join("").trim();
      if (t.endsWith("?")) return;
    }
    if (typeof nd.text === "string") n += nd.text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    (nd.content ?? []).forEach(walk);
  };
  walk(doc);
  return n;
}

const stateOf = (words: number, notes: number): TabState =>
  words >= 40 || notes > 0 ? "written" : words > 0 ? "started" : "empty";

/** The ten points for a sūrah in a workspace. Missing tabs come back empty. */
export async function tabStats(workspaceId: string | null, surah: number): Promise<TabStat[]> {
  const blank = QUESTIONS.map((q) => ({ n: q.n, title: TAB_TITLES[q.n - 1], pageId: null, words: 0, notes: 0, state: "empty" as TabState }));
  if (!workspaceId) return blank;
  const pages = await db.page.findMany({
    where: { workspaceSurah: { workspaceId, surahNumber: surah } },
    select: { id: true, title: true, tiptapContent: true, _count: { select: { notes: true } } },
    orderBy: { orderIndex: "asc" },
  });
  return blank.map((b) => {
    const p = pages.find((x) => tabNumber(x.title) === b.n);
    if (!p) return b;
    const words = wordsIn(p.tiptapContent);
    return { ...b, title: p.title, pageId: p.id, words, notes: p._count.notes, state: stateOf(words, p._count.notes) };
  });
}

/** How many of the ten points have something real in them. */
export const writtenCount = (stats: TabStat[]) => stats.filter((s) => s.state === "written").length;

// ── The organiser's view of the cohort ─────────────────────────────────────

export interface MemberView {
  userId: string; name: string; email: string; role: Role; joinedAt: string;
  workspaceId: string | null; tabs: TabStat[];
}

/** Everyone in the cohort, with how far each has prepared the given sūrah.
 *  Counts only — the organiser never sees what anyone wrote. */
export async function cohort(surah: number): Promise<MemberView[]> {
  const rows = await db.youthMajlisProgress.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { joinedAt: "asc" },
  });
  return Promise.all(rows.map(async (r) => ({
    userId: r.userId, name: r.user.name, email: r.user.email, role: r.role as Role,
    joinedAt: r.joinedAt.toISOString(), workspaceId: r.workspaceId,
    tabs: await tabStats(r.workspaceId, surah),
  })));
}
