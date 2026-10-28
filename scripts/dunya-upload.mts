/**
 * Put the A-level papers behind /dunya.
 *
 *   DUNYA_PASSWORD=… npx tsx scripts/dunya-upload.mts <file.zip|file.pdf> …
 *
 * Takes the Tafsir Lab paper sets as they come, zipped or loose:
 *   - a paper and its answers, by name: Biology "Test_08_…_TEST.pdf" with
 *     "…_WORKED_ANSWERS.pdf"; Maths "Pure_01_…_TEST.pdf" with
 *     "…_WORKED_SOLUTIONS.pdf" and/or "…_MARK_SCHEME.pdf"; Chemistry
 *     "…_Chem_2.1.2-2.1.3_TEST.pdf" with "…_MARK_SCHEME.pdf";
 *   - a whole subject in one file: "…_ALL_TESTS.pdf", "…_ALL_MARK_SCHEMES.pdf",
 *     "…_ALL_WORKED_ANSWERS.pdf", "…_ALL_WORKED_SOLUTIONS.pdf".
 * A paper's title, time allowed and total marks are read off its front page.
 * The same file given twice (two versions of a zip) is uploaded once.
 *
 * Files go to the private R2 bucket tafsir-lab-dunya (wrangler, already
 * logged in); the paper list goes to DunyaPlan, with an scrypt hash of
 * DUNYA_PASSWORD when it is given. Nothing here is committed: the papers and
 * the password stay out of this repository, which is public. Re-running
 * replaces files and the list, and keeps the logged attempts.
 *
 *   DRY_RUN=1      print the list and stop
 *   SKIP_UPLOAD=1  write the list (and password) only
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { execFileSync } from "node:child_process";
import { randomBytes, scryptSync } from "node:crypto";
import AdmZip from "adm-zip";
import * as mupdf from "mupdf";
import { PrismaClient } from "@prisma/client";
import type { Catalog, FileRef, Paper, Subject } from "../lib/dunya/catalog";

const BUCKET = "tafsir-lab-dunya";

const SUBJECTS: Record<string, Omit<Subject, "groups" | "all">> = {
  biology:   { id: "biology",   name: "Biology",   board: "Edexcel A (Salters-Nuffield)", level: "Year 1" },
  chemistry: { id: "chemistry", name: "Chemistry", board: "OCR A",                        level: "Year 1" },
  maths:     { id: "maths",     name: "Maths",     board: "Edexcel",                      level: "AS" },
};

// The course's own topic names; the zip's folders drop the punctuation.
const BIO_TOPICS: Record<string, string> = {
  "1": "Topic 1 · Lifestyle, health and risk",
  "2": "Topic 2 · Genes and health",
  "3": "Topic 3 · Voice of the genome",
  "4": "Topic 4 · Biodiversity and natural resources",
};

// What each kind of file is called, its key suffix, and where it sits in a paper's list.
const KINDS: Record<string, { label: string; suffix: string; order: number }> = {
  TEST:             { label: "Paper",            suffix: "",              order: 0 },
  WORKED_ANSWERS:   { label: "Worked answers",   suffix: "-worked",       order: 1 },
  WORKED_SOLUTIONS: { label: "Worked solutions", suffix: "-worked",       order: 1 },
  MARK_SCHEME:      { label: "Mark scheme",      suffix: "-mark-scheme",  order: 2 },
};
const ALL: Record<string, { label: string; slug: string; order: number }> = {
  TESTS:            { label: "All papers",           slug: "all-papers",       order: 0 },
  WORKED_ANSWERS:   { label: "All worked answers",   slug: "all-worked",       order: 1 },
  WORKED_SOLUTIONS: { label: "All worked solutions", slug: "all-worked",       order: 1 },
  MARK_SCHEMES:     { label: "All mark schemes",     slug: "all-mark-schemes", order: 2 },
};

interface Front { title: string | null; section: string | null; marks: number | null; minutes: number | null }

function frontPage(bytes: Buffer): Front {
  const doc = mupdf.Document.openDocument(bytes, "application/pdf");
  const t = doc.loadPage(0).toStructuredText("preserve-whitespace").asText();
  // A long title wraps onto the next line; it runs until "End of Topic Test".
  let title = /^(?:Test|Chapter)\s+\d+:\s*([\s\S]+?)\s*End of Topic Test/m.exec(t)?.[1]?.replace(/\s+/g, " ").trim() ?? null;
  // OCR papers list their specification points instead: "2.1.2 Compounds, formulae and equations".
  const points = [...t.split("Topic Test")[0].matchAll(/^(\d+\.\d+\.\d+)\s+(.+)$/gm)];
  if (!title && points.length) title = points.map((m) => m[2].trim()).join(" · ");
  const section = points.length ? /([^\n]+)\n\s*\n\s*\d+\.\d+\.\d+ /.exec(t)?.[1]?.trim() ?? null : null;
  const marks = Number(/Total marks\s+(\d+)/.exec(t)?.[1]) || null;
  const time = /Time allowed\s+(?:(\d+)\s*hours?)?\s*(?:(\d+)\s*minutes)?/.exec(t);
  const minutes = time ? (Number(time[1] ?? 0) * 60 + Number(time[2] ?? 0)) || null : null;
  return { title, section, marks, minutes };
}

/** "Module 2 · Foundations in chemistry", from a zip folder or a paper's front page. */
function chemModule(m: ArrayLike<string | undefined> | null): string {
  if (!m?.[1]) return "Topics";
  const name = (m[2] ?? "").trim();
  return name ? `Module ${m[1]} · ${name[0].toUpperCase()}${name.slice(1).toLowerCase()}` : `Module ${m[1]}`;
}

const tidy = (s: string) => s.replace(/_/g, " ").replace(/\s+/g, " ").trim();
const pad = (n: number) => String(n).padStart(2, "0");

const uploads = new Map<string, Buffer>();
const subjects = new Map<string, Subject>(
  Object.values(SUBJECTS).map((s) => [s.id, { ...s, all: [], groups: [] }]),
);

function addFile(list: FileRef[], f: FileRef, order: (l: string) => number) {
  if (list.some((x) => x.label === f.label)) return;
  list.push(f);
  list.sort((a, b) => order(a.label) - order(b.label));
}
const kindOrder = (l: string) => Object.values(KINDS).find((k) => k.label === l)?.order ?? 9;
const allOrder = (l: string) => Object.values(ALL).find((k) => k.label === l)?.order ?? 9;

function paperIn(subject: Subject, groupName: string, id: string, init: () => Paper): Paper {
  const found = subject.groups.flatMap((g) => g.papers).find((p) => p.id === id);
  if (found) return found;
  let group = subject.groups.find((g) => g.name === groupName);
  if (!group) { group = { name: groupName, papers: [] }; subject.groups.push(group); }
  const paper = init();
  group.papers.push(paper);
  return paper;
}

/** One PDF, by its file name (and, for a zip entry, the folder it was in). */
function take(subjectId: string, path: string, bytes: Buffer) {
  const subject = subjects.get(subjectId)!;
  const file = path.split("/").pop()!;

  const all = /_ALL_(TESTS|WORKED_ANSWERS|WORKED_SOLUTIONS|MARK_SCHEMES)\.pdf$/i.exec(file);
  if (all) {
    const k = ALL[all[1].toUpperCase()];
    const key = `${subjectId}/${k.slug}.pdf`;
    uploads.set(key, bytes);
    addFile(subject.all, { label: k.label, key }, allOrder);
    return;
  }

  // Edexcel: a numbered test in a series.
  const ed = /^(Test|Pure|Mechanics|Statistics)_(\d+)_(.+?)_(TEST|WORKED_ANSWERS|WORKED_SOLUTIONS|MARK_SCHEME)\.pdf$/i.exec(file);
  // OCR: a test named by its specification points.
  const ocr = /_(\d+\.\d+\.\d+(?:-\d+\.\d+\.\d+)?)_(TEST|MARK_SCHEME|WORKED_ANSWERS|WORKED_SOLUTIONS)\.pdf$/i.exec(file);
  if (!ed && !ocr) { console.warn(`  skipping ${file}`); return; }

  const kind = KINDS[(ed ? ed[4] : ocr![2]).toUpperCase()];
  const front = kind.label === "Paper" ? frontPage(bytes) : null;
  let paper: Paper;
  let key: string;
  if (ed) {
    const [, series, num, rawTitle] = ed;
    const n = Number(num);
    const groupName = subjectId === "biology"
      ? BIO_TOPICS[/Topic (\d+)/.exec(path)?.[1] ?? ""] ?? "Topics"
      : subjectId === "chemistry"
        ? chemModule(/Module (\d+) ([^/]+)/.exec(path))
        : series[0].toUpperCase() + series.slice(1).toLowerCase();
    const stem = `${series.toLowerCase()}-${pad(n)}`;
    key = `${subjectId}/${stem}${kind.suffix}.pdf`;
    paper = paperIn(subject, groupName, `${subjectId}-${stem}`, () => ({
      id: `${subjectId}-${stem}`, n, title: tidy(rawTitle), ref: null, marks: null, minutes: null, files: [],
    }));
  } else {
    const span = ocr![1];
    const [a, b] = span.split("-");
    key = `${subjectId}/${span}${kind.suffix}.pdf`;
    const groupName = chemModule([, a.split(".")[0], front?.section ?? ""]);
    // Unnumbered (n 0): it sits after the module's numbered tests, named by its specification points.
    paper = paperIn(subject, groupName, `${subjectId}-${span}`, () => ({
      id: `${subjectId}-${span}`, n: 0, title: span, ref: `Topic test · ${b ? `${a}–${b}` : a}`, marks: null, minutes: null, files: [],
    }));
  }
  uploads.set(key, bytes);
  addFile(paper.files, { label: kind.label, key }, kindOrder);
  if (front) {
    if (front.title) paper.title = front.title;
    paper.marks = front.marks;
    paper.minutes = front.minutes;
  }
}

// Papers before their answers, so an OCR paper's module is known when its mark scheme arrives.
// (Zips are read whole, with their own papers and answers together.)
const args = process.argv.slice(2).sort((a, b) => Number(/_TEST\.pdf$/i.test(b)) - Number(/_TEST\.pdf$/i.test(a)));
for (const arg of args) {
  const name = basename(arg);
  const subjectId = /biolog/i.test(name) ? "biology" : /math/i.test(name) ? "maths" : /chem/i.test(name) ? "chemistry" : null;
  if (!subjectId) { console.warn(`skipping ${name}: which subject is it?`); continue; }
  if (/\.pdf$/i.test(arg)) { take(subjectId, name, readFileSync(arg)); continue; }
  for (const e of new AdmZip(arg).getEntries()) {
    if (!e.isDirectory && /\.pdf$/i.test(e.entryName)) take(subjectId, e.entryName, e.getData());
  }
}

const db = new PrismaClient();
const previousRow = await db.dunyaPlan.findUnique({ where: { id: "main" }, select: { passwordHash: true, catalog: true } });
const previous = { stored: ((previousRow?.catalog ?? {}) as { stored?: Record<string, number> }).stored ?? {} };

// Course order: Edexcel series as taught, OCR by module; papers by number or specification point.
const order = ["Pure", "Mechanics", "Statistics"];
for (const s of subjects.values()) {
  s.groups.sort((a, b) => (order.indexOf(a.name) + 1 || 99) - (order.indexOf(b.name) + 1 || 99) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  for (const g of s.groups) {
    // Numbered tests in order; unnumbered ones (n 0) after them.
    g.papers.sort((a, b) => (a.n || 1e9) - (b.n || 1e9) || (a.ref ?? "").localeCompare(b.ref ?? "", undefined, { numeric: true }));
  }
}

if (process.env.DRY_RUN) {
  for (const s of subjects.values()) {
    console.log(`\n${s.name} · ${s.board}${s.all.length ? ` · ${s.all.map((f) => f.label).join(", ")}` : ""}`);
    for (const g of s.groups) {
      console.log(`  ${g.name}`);
      for (const p of g.papers) {
        console.log(`    ${p.n}. ${p.ref ? `${p.ref} ` : ""}${p.title} — ${p.marks ?? "?"} marks, ${p.minutes ?? "?"} min · ${p.files.map((f) => f.label).join(", ")}`);
      }
    }
  }
  console.log(`\n${uploads.size} files`);
  process.exit(0);
}

/* The free-tier guard for writes. R2's free plan holds 10 GB and allows a
   million writes a month, with no spending cap of its own; this stops well
   short of both. The bucket's present size is counted as well as the new
   files, so a re-upload that replaces files is over-counted, never under. */
const MAX_BUCKET_BYTES = 2 * 1024 ** 3;
const MAX_FILES_PER_RUN = 1_000;
const MAX_FILE_BYTES = 50 * 1024 ** 2;

function bucketBytes(): number {
  const info = execFileSync("npx", ["wrangler", "r2", "bucket", "info", BUCKET, "--config", "party/wrangler.jsonc"],
    { encoding: "utf8", shell: true });
  const m = /bucket_size:\s*([\d.]+)\s*(B|KB|KiB|MB|MiB|GB|GiB|TB|TiB)\b/i.exec(info);
  if (!m) throw new Error(`Couldn’t read the bucket's size, so nothing was uploaded:\n${info}`);
  const unit = m[2].toUpperCase().replace("I", "")[0];
  return Number(m[1]) * 1024 ** "BKMGT".indexOf(unit);
}

if (!process.env.SKIP_UPLOAD) {
  const adding = [...uploads.values()].reduce((n, b) => n + b.length, 0);
  const big = [...uploads].filter(([, b]) => b.length > MAX_FILE_BYTES).map(([k]) => k);
  if (big.length) throw new Error(`Over 50 MB, not uploaded: ${big.join(", ")}`);
  if (uploads.size > MAX_FILES_PER_RUN) throw new Error(`${uploads.size} files is more than ${MAX_FILES_PER_RUN} in one run; nothing uploaded.`);
  /* Cloudflare's figure lags uploads by minutes or more, so it is checked
     against this script's own record of everything it has stored, and the
     larger is believed. A replaced file counts once, at its new size. */
  const record = { ...previous.stored, ...Object.fromEntries([...uploads].map(([k, b]) => [k, b.length])) };
  const recorded = Object.values(record).reduce((n, b) => n + b, 0);
  const present = Math.max(bucketBytes() + adding, recorded) - adding;
  const mb = (n: number) => `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (present + adding > MAX_BUCKET_BYTES) {
    throw new Error(`The bucket holds ${mb(present)}; adding ${mb(adding)} would pass the ${mb(MAX_BUCKET_BYTES)} limit kept to stay on the free plan. Nothing uploaded.`);
  }
  console.log(`Bucket ${mb(present)} + ${mb(adding)}, inside the ${mb(MAX_BUCKET_BYTES)} limit.`);
  console.log(`Uploading ${uploads.size} files to R2 (${BUCKET})…`);
  const work = mkdtempSync(join(tmpdir(), "dunya-"));
  let i = 0;
  for (const [key, bytes] of uploads) {
    const path = join(work, `f${i}.pdf`);
    writeFileSync(path, bytes);
    execFileSync("npx", ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`, "--file", path,
      "--content-type", "application/pdf", "--remote", "--config", "party/wrangler.jsonc"],
      { stdio: "ignore", shell: true });
    process.stdout.write(`\r  ${++i}/${uploads.size}`);
  }
  rmSync(work, { recursive: true, force: true });
  console.log();
}

const stored = process.env.SKIP_UPLOAD ? previous.stored
  : { ...previous.stored, ...Object.fromEntries([...uploads].map(([k, b]) => [k, b.length])) };
const catalog: Catalog = { v: 2, subjects: [...subjects.values()], stored };
const pw = process.env.DUNYA_PASSWORD?.trim().toLowerCase();
const hash = pw
  ? (() => {
      const salt = randomBytes(16);
      const N = 16384, r = 8, p = 1;
      const h = scryptSync(pw, salt, 32, { N, r, p, maxmem: 64 * 1024 * 1024 });
      return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${h.toString("base64")}`;
    })()
  : null;
const existing = previousRow;
if (!existing && !hash) throw new Error("First run: set DUNYA_PASSWORD.");
if (existing) {
  await db.dunyaPlan.update({
    where: { id: "main" },
    data:  { catalog: catalog as object, ...(hash ? { passwordHash: hash } : {}) },
  });
} else {
  await db.dunyaPlan.create({ data: { id: "main", catalog: catalog as object, passwordHash: hash!, progress: { attempts: {} } } });
}
await db.$disconnect();

for (const s of subjects.values()) {
  console.log(`${s.name}: ${s.groups.reduce((n, g) => n + g.papers.length, 0)} papers in ${s.groups.length} groups, ${s.all.length} whole-subject files`);
}
