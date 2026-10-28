/**
 * Dunya — the shape of the A-level paper list and of what is logged against it.
 *
 * The list itself is not in this repository (it is public): scripts/
 * dunya-upload.mts reads the papers' front pages, puts the PDFs in the
 * private R2 bucket and writes the list to DunyaPlan.catalog. Progress is
 * DunyaPlan.progress, { attempts: { [paperId]: Attempt[] } }.
 */

/** One PDF in the bucket: "Paper", "Worked solutions", "Mark scheme"… */
export interface FileRef { label: string; key: string }

export interface Paper {
  id: string; n: number; title: string;
  /** The specification points it covers, where the board numbers them ("2.1.2–2.1.3"). */
  ref: string | null;
  marks: number | null; minutes: number | null;
  /** The paper first, then its answers. */
  files: FileRef[];
}
export interface Group { name: string; papers: Paper[] }
export interface Subject {
  id: string; name: string; board: string; level: string;
  /** Whole-subject PDFs: every paper, every answer, in one file each. */
  all: FileRef[];
  groups: Group[];
}
export interface Catalog { v: 2; subjects: Subject[] }

export type Confidence = "red" | "amber" | "green";
export interface Attempt {
  id: string;
  /** The day it was done, YYYY-MM-DD. */
  date: string;
  score: number;
  marks: number;
  confidence: Confidence;
}
export interface Progress { attempts: Record<string, Attempt[]> }

export const CONFIDENCE: { value: Confidence; label: string }[] = [
  { value: "red",   label: "Not yet" },
  { value: "amber", label: "Getting there" },
  { value: "green", label: "Confident" },
];

export function asCatalog(raw: unknown): Catalog {
  const c = raw as Catalog | null;
  return c && c.v === 2 && Array.isArray(c.subjects) ? c : { v: 2, subjects: [] };
}

export function asProgress(raw: unknown): Progress {
  const p = raw as Progress | null;
  return p && p.attempts && typeof p.attempts === "object" ? p : { attempts: {} };
}

export function findPaper(catalog: Catalog, paperId: string): { subject: Subject; paper: Paper } | null {
  for (const subject of catalog.subjects)
    for (const g of subject.groups)
      for (const paper of g.papers) if (paper.id === paperId) return { subject, paper };
  return null;
}

/**
 * The file behind an R2 key, if the list has it, with the name it saves as —
 * "Biology Test 08 - Inheritance and genetic disorders (worked answers).pdf".
 * Only keys on the list can be fetched, so a guessed key gets nothing.
 */
export function fileFor(catalog: Catalog, key: string): string | null {
  for (const s of catalog.subjects) {
    const whole = s.all.find((f) => f.key === key);
    if (whole) return `${s.name} - ${whole.label.toLowerCase()}.pdf`;
    for (const g of s.groups) for (const p of g.papers) {
      const f = p.files.find((x) => x.key === key);
      if (!f) continue;
      const which = p.ref ?? `${s.id === "biology" ? "Test" : g.name} ${String(p.n).padStart(2, "0")}`;
      const base = `${s.name} ${which} - ${p.title}`.replace(/[–·]/g, "-");
      return f.label === "Paper" ? `${base}.pdf` : `${base} (${f.label.toLowerCase()}).pdf`;
    }
  }
  return null;
}
