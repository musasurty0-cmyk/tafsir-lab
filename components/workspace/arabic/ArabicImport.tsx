"use client";

/**
 * Bring a course's flashcard decks into an Arabic study workspace.
 *
 * Accepts the course export as a .zip, or one or more lesson .txt files. It
 * is all read here, in the browser: the reader sees exactly what was found —
 * levels, lessons, cards, which files are revision — and says which lesson
 * they are on, before anything is saved. Only the parsed cards are sent.
 */

import { useMemo, useRef, useState } from "react";
import { Upload, FileText } from "lucide-react";
import {
  parseLessonPath, parseDeck, lessonKind, numberLessons, type ParsedLesson,
} from "@/lib/arabic/parse";
import { readZipTexts } from "@/lib/arabic/zip";

interface Existing { level: number; fileNo: number }

interface Props {
  workspaceId: string;
  /** Lessons already in the workspace, so the preview can say what is new. */
  existing: Existing[];
  /** Ask where the reader is. Only on a first import: after that, they set it from a lesson. */
  askPlace: boolean;
  onDone: (summary: string) => void;
  onCancel?: () => void;
}

export default function ArabicImport({ workspaceId, existing, askPlace, onDone, onCancel }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [lessons, setLessons] = useState<ParsedLesson[] | null>(null);
  const [skippedFiles, setSkippedFiles] = useState(0);
  const [fallbackLevel, setFallbackLevel] = useState(1);
  const [place, setPlace] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const have = useMemo(() => new Set(existing.map((e) => `${e.level}:${e.fileNo}`)), [existing]);
  const numbered = useMemo(() => (lessons ? numberLessons(lessons) : []), [lessons]);
  const fresh = numbered.filter((l) => !have.has(`${l.level}:${l.fileNo}`) && l.cards.length > 0);

  const byLevel = useMemo(() => {
    const m = new Map<number, typeof fresh>();
    for (const l of fresh) m.set(l.level, [...(m.get(l.level) ?? []), l]);
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [fresh]);

  async function read(files: FileList | File[]) {
    setError(null);
    const list = [...files];
    if (list.length === 0) return;
    setBusy(true);
    try {
      const texts: { path: string; text: string }[] = [];
      for (const f of list) {
        if (/\.zip$/i.test(f.name)) texts.push(...await readZipTexts(await f.arrayBuffer()));
        else if (/\.txt$/i.test(f.name)) {
          const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
          texts.push({ path: rel, text: await f.text() });
        }
      }
      const parsed: ParsedLesson[] = [];
      let skipped = 0;
      for (const t of texts) {
        const p = parseLessonPath(t.path, fallbackLevel);
        if (!p) { skipped++; continue; }
        const cards = parseDeck(t.text);
        if (cards.length === 0) { skipped++; continue; }
        parsed.push({ ...p, kind: lessonKind(p.fileNo, p.title), cards });
      }
      if (parsed.length === 0) {
        setError("No lesson files found. Files should be named like “Lesson 3 - Title.txt”, inside a “Level 1” folder.");
        setLessons(null);
      } else {
        setLessons(parsed);
        setSkippedFiles(skipped);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That file couldn’t be read.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!fresh.length || busy) return;
    setBusy(true);
    setError(null);
    const [lv, fn] = place ? place.split(":").map(Number) : [];
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/arabic/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessons: fresh.map(({ level, fileNo, title, cards }) => ({ level, fileNo, title, cards })),
          currentAt: place ? { level: lv, fileNo: fn } : null,
        }),
      });
      const data = await res.json().catch(() => ({})) as { added?: number; cards?: number; error?: string };
      if (!res.ok) { setError(data.error ?? "The import didn’t go through. Try again."); return; }
      onDone(`Added ${data.added} lesson${data.added === 1 ? "" : "s"} and ${(data.cards ?? 0).toLocaleString()} cards.`);
    } catch {
      setError("Couldn’t reach TafsirLab. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const dupes = numbered.length - fresh.length;
  const cardTotal = fresh.reduce((n, l) => n + l.cards.length, 0);

  return (
    <div className="ar-import">
      {!lessons ? (
        <label
          className="ar-drop"
          data-dragging={dragging ? "true" : "false"}
          data-busy={busy ? "true" : "false"}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void read(e.dataTransfer.files); }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".zip,.txt,application/zip,text/plain"
            multiple
            hidden
            onChange={(e) => { if (e.target.files) void read(e.target.files); e.target.value = ""; }}
          />
          <Upload size={20} strokeWidth={2} aria-hidden />
          <span className="ar-drop-title">{busy ? "Reading…" : "Drop your flashcards here"}</span>
          <span className="ar-drop-sub">
            The course’s .zip, or lesson .txt files. They’re read on this device; only the cards are saved.
          </span>
          <span className="ar-drop-btn">Choose files</span>
        </label>
      ) : null}
      {!lessons && (
        <p className="ar-drop-level">
          Lesson files that aren’t in a “Level” folder go into
          <select value={fallbackLevel} onChange={(e) => setFallbackLevel(Number(e.target.value))} aria-label="Level for loose files">
            {Array.from({ length: 15 }, (_, i) => <option key={i + 1} value={i + 1}>Level {i + 1}</option>)}
          </select>
        </p>
      )}
      {lessons && (
        <div className="ar-preview">
          <div className="ar-preview-head">
            <FileText size={16} aria-hidden />
            <span>
              {fresh.length
                ? `${fresh.length} new lesson${fresh.length === 1 ? "" : "s"}, ${cardTotal.toLocaleString()} cards`
                : "Nothing new to add"}
            </span>
            <button type="button" className="ar-link" onClick={() => { setLessons(null); setPlace(""); }}>
              Choose other files
            </button>
          </div>

          {byLevel.map(([level, ls]) => {
            const extra = ls.filter((l) => l.kind !== "lesson").length;
            return (
              <div key={level} className="ar-preview-level">
                <p className="ar-preview-level-name">Level {level}</p>
                <p className="ar-preview-level-sub">
                  {ls.length - extra} lesson{ls.length - extra === 1 ? "" : "s"}
                  {extra ? `, plus ${extra} revision` : ""} · {ls.reduce((n, l) => n + l.cards.length, 0).toLocaleString()} cards
                </p>
                <ol className="ar-preview-list">
                  {ls.map((l) => (
                    <li key={l.fileNo} data-kind={l.kind}>
                      <span className="ar-preview-n">{l.number ?? "Revision"}</span>
                      <span className="ar-preview-t">{l.title}</span>
                      <span className="ar-preview-c">{l.cards.length}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}

          {(dupes > 0 || skippedFiles > 0) && (
            <p className="ar-note">
              {dupes > 0 && `${dupes} already in this workspace and left as they are. `}
              {skippedFiles > 0 && `${skippedFiles} file${skippedFiles === 1 ? " was" : "s were"} empty or not a lesson.`}
            </p>
          )}

          {askPlace && fresh.length > 0 && (
            <label className="ar-place">
              <span className="ar-place-label">Which lesson are you on?</span>
              <select value={place} onChange={(e) => setPlace(e.target.value)}>
                <option value="">I’m just starting</option>
                {byLevel.map(([level, ls]) => (
                  <optgroup key={level} label={`Level ${level}`}>
                    {ls.filter((l) => l.kind === "lesson").map((l) => (
                      <option key={l.fileNo} value={`${l.level}:${l.fileNo}`}>Lesson {l.number}: {l.title}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="ar-place-hint">Everything before it is marked as covered. You can change this from any lesson.</span>
            </label>
          )}
        </div>
      )}

      {error && <p className="ar-error" role="alert">{error}</p>}

      <div className="ar-import-foot">
        {onCancel && <button type="button" className="nw-btn nw-btn--quiet" onClick={onCancel} disabled={busy}>Cancel</button>}
        {lessons && (
          <button type="button" className="nw-btn nw-btn--primary" onClick={submit} disabled={busy || fresh.length === 0}>
            {busy ? "Importing…" : `Import ${fresh.length} lesson${fresh.length === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
    </div>
  );
}
