/**
 * Youth Majlis — the compiled class notes.
 *
 * One document per module, read from the database (prisma/sql/010): this
 * repository is public and the notes belong to the cohort, so they are never
 * written into the source. Each holds the passage in the QPC Hafs text (the
 * encoding the King Fahd font is drawn for), with the Majlis's translation,
 * an opening paragraph, the points of the ten-question method as HTML, and a
 * closing summary. Row 0 holds the sources the notes draw on.
 */

import { db } from "@/lib/db";
import { sanitizeTafsirHtml } from "@/lib/sanitize-html";

export interface NoteVerse { n: number; ar: string; en: string }
export interface NoteSection { n: number; slug: string; title: string; html: string }
export interface ModuleNotes {
  moduleN: number;
  surah: number;
  from_: number;
  to: number;
  title: string;
  meta: string[];
  module: string;
  basmala: boolean;
  verses: NoteVerse[];
  intro: string;
  sections: NoteSection[];
  summary: string | null;
}
export interface NoteSources { groups: { title: string; items: string[] }[]; note: string }

export async function getNotes(moduleN: number): Promise<ModuleNotes | null> {
  const row = await db.youthMajlisNote.findUnique({ where: { moduleN } });
  if (!row || moduleN === 0) return null;
  const d = row.data as unknown as ModuleNotes;
  // Defence in depth: the HTML is ours, but it is rendered as HTML.
  return {
    ...d,
    intro: sanitizeTafsirHtml(d.intro),
    summary: d.summary ? sanitizeTafsirHtml(d.summary) : null,
    sections: d.sections.map((s) => ({ ...s, html: sanitizeTafsirHtml(s.html) })),
  };
}

export async function getSources(): Promise<NoteSources | null> {
  const row = await db.youthMajlisNote.findUnique({ where: { moduleN: 0 } });
  if (!row) return null;
  const d = row.data as unknown as NoteSources;
  return {
    note: sanitizeTafsirHtml(d.note),
    groups: d.groups.map((g) => ({ ...g, items: g.items.map(sanitizeTafsirHtml) })),
  };
}

/** The modules that have notes, for linking to them. */
export async function modulesWithNotes(): Promise<Set<number>> {
  const rows = await db.youthMajlisNote.findMany({ where: { moduleN: { gt: 0 } }, select: { moduleN: true } });
  return new Set(rows.map((r) => r.moduleN));
}
