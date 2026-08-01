"use client";

/**
 * QuranSearch — the one target picker.
 *
 * Used by /ayah today and built to serve /link, Segment range editing and
 * Connection creation without change: callers say which target KINDS they
 * accept and what to do with the selection, and nothing else differs. Four
 * separate pickers would drift into four different ideas of what "2:255"
 * means and four different Arabic-matching rules.
 *
 * Responsiveness comes from splitting the work by cost (see lib/quran-search):
 * references and Surah names resolve locally on every keystroke with no
 * network, while verse-TEXT search is debounced and proxied. So typing "2:255"
 * or "baqarah" answers instantly, and only free-text search waits.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chapter } from "@/lib/types";
import {
  parseReference, searchChapters, findMatchRange,
  readRecents, pushRecent, verseKey, isArabic,
  type SearchTarget, type TargetKind,
} from "@/lib/quran-search";

/* Chapters are static and tiny. Fetched once per page load and shared by
   every instance, so opening the picker repeatedly costs nothing. */
let chaptersPromise: Promise<Chapter[]> | null = null;
function loadChapters(): Promise<Chapter[]> {
  if (!chaptersPromise) {
    chaptersPromise = fetch("/api/chapters")
      .then((r) => (r.ok ? r.json() : { chapters: [] }))
      .then((d) => (d.chapters ?? []) as Chapter[])
      .catch(() => []);
  }
  return chaptersPromise;
}

/** Long enough that a fast typist issues one request, not one per letter. */
const DEBOUNCE_MS = 180;

interface Props {
  /** Target kinds this caller accepts. Defaults to ayah + surah. */
  kinds?: TargetKind[];
  /** Surah being studied — its verses sort first, as they are the likely target. */
  currentSurah?: number;
  /** Workspace segments, for callers that accept them (/link). */
  segments?: SearchTarget[];
  onSelect: (t: SearchTarget) => void;
  onCancel: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

interface Group { label: string; items: SearchTarget[] }

/** Render a result, marking the matched span in the original text. */
function Marked({ text, query }: { text: string; query: string }) {
  const r = useMemo(() => findMatchRange(text, query), [text, query]);
  if (!r) return <>{text}</>;
  return (
    <>
      {text.slice(0, r.start)}
      <mark className="qs-mark">{text.slice(r.start, r.end)}</mark>
      {text.slice(r.end)}
    </>
  );
}

export default function QuranSearch({
  kinds = ["ayah", "surah"],
  currentSurah,
  segments = [],
  onSelect,
  onCancel,
  placeholder = "Search the Qurʾān…",
  autoFocus = true,
}: Props) {
  const [q, setQ]               = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [verses, setVerses]     = useState<SearchTarget[]>([]);
  const [loading, setLoading]   = useState(false);
  const [active, setActive]     = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { loadChapters().then(setChapters); }, []);
  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  const chapterById = useMemo(() => {
    const m = new Map<number, Chapter>();
    for (const c of chapters) m.set(c.id, c);
    return m;
  }, [chapters]);

  const nameFor = useCallback(
    (s: number) => chapterById.get(s)?.name_simple ?? `Surah ${s}`,
    [chapterById],
  );

  // ── Remote verse-text search (debounced) ─────────────────────────────────
  useEffect(() => {
    const query = q.trim();
    // A reference is answered locally; no point spending a request on it.
    if (query.length < 2 || parseReference(query)) { setVerses([]); setLoading(false); return; }

    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/quran/search?q=${encodeURIComponent(query)}&size=20`)
        .then((r) => (r.ok ? r.json() : { results: [] }))
        .then((d: { results?: { verseKey: string; surah: number; ayah: number; arabic: string; translation?: string }[] }) => {
          if (cancelled) return;
          const hits = (d.results ?? []).map<SearchTarget>((v) => ({
            kind:    "ayah",
            id:      v.verseKey,
            surah:   v.surah,
            ayah:    v.ayah,
            label:   `${nameFor(v.surah)} ${v.verseKey}`,
            arabic:  v.arabic,
            preview: v.translation,
          }));
          // The Surah in front of the user is the likely target, so its verses
          // lead — without hiding the rest, which is the point of searching.
          if (currentSurah) {
            hits.sort((a, b) =>
              Number(b.surah === currentSurah) - Number(a.surah === currentSurah));
          }
          setVerses(hits);
        })
        .catch(() => { if (!cancelled) setVerses([]); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, DEBOUNCE_MS);

    return () => { cancelled = true; clearTimeout(t); };
  }, [q, currentSurah, nameFor]);

  // ── Groups ───────────────────────────────────────────────────────────────
  const groups: Group[] = useMemo(() => {
    const query = q.trim();
    const out: Group[] = [];

    if (!query) {
      const recents = readRecents().filter((r) => kinds.includes(r.kind));
      if (recents.length) out.push({ label: "Recent", items: recents });
      return out;
    }

    // Exact reference first — it is unambiguous, so it outranks everything.
    const ref = parseReference(query);
    const exact: SearchTarget[] = [];
    if (ref && kinds.includes("ayah") && ref.ayah != null) {
      exact.push({
        kind: "ayah", id: verseKey(ref.surah, ref.ayah),
        surah: ref.surah, ayah: ref.ayah,
        label: `${nameFor(ref.surah)} ${ref.surah}:${ref.ayah}`,
      });
    }
    if (ref && ref.ayah == null && kinds.includes("surah")) {
      exact.push({
        kind: "surah", id: String(ref.surah), surah: ref.surah,
        label: nameFor(ref.surah),
        arabic: chapterById.get(ref.surah)?.name_arabic,
      });
    }
    if (exact.length) out.push({ label: "Reference", items: exact });

    if (kinds.includes("surah")) {
      const hits = searchChapters(query, chapters)
        .slice(0, 6)
        .map<SearchTarget>((h) => ({
          kind: "surah", id: String(h.chapter.id), surah: h.chapter.id,
          label: `${h.chapter.name_simple} · ${h.chapter.verses_count} āyāt`,
          arabic: h.chapter.name_arabic,
          preview: h.chapter.translated_name?.name,
        }));
      if (hits.length) out.push({ label: "Surahs", items: hits });
    }

    if (kinds.includes("segment") && segments.length) {
      const ql = query.toLowerCase();
      const hits = segments.filter((s) => s.label.toLowerCase().includes(ql)).slice(0, 6);
      if (hits.length) out.push({ label: "Segments", items: hits });
    }

    if (kinds.includes("ayah") && verses.length) {
      out.push({ label: "Āyāt", items: verses });
    }
    return out;
  }, [q, chapters, chapterById, verses, segments, kinds, nameFor]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Keep the highlighted row valid as results change under the cursor.
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    if (active >= flat.length) setActive(Math.max(0, flat.length - 1));
  }, [flat.length, active]);

  const choose = useCallback((t: SearchTarget) => {
    pushRecent(t);
    onSelect(t);
  }, [onSelect]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown")      { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter")     { e.preventDefault(); const t = flat[active]; if (t) choose(t); }
    else if (e.key === "Escape")    { e.preventDefault(); onCancel(); }
  };

  // Keep the active row in view during keyboard navigation.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let idx = -1;
  return (
    <div className="qs-panel" onMouseDown={(e) => e.preventDefault()}>
      <input
        ref={inputRef}
        className="qs-input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        dir="auto"
        aria-label="Search the Qurʾān"
      />

      <div className="qs-results" ref={listRef}>
        {groups.length === 0 && (
          <div className="qs-empty">
            {loading ? "Searching…"
             : q.trim().length >= 2 ? "No matches"
             : "Type a reference, a Surah name, or Arabic text"}
          </div>
        )}

        {groups.map((g) => (
          <div key={g.label} className="qs-group">
            <div className="qs-group-label">{g.label}</div>
            {g.items.map((t) => {
              idx += 1;
              const i = idx;
              return (
                <button
                  key={`${t.kind}-${t.id}`}
                  type="button"
                  data-idx={i}
                  className="qs-row"
                  data-active={i === active ? "true" : "false"}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(t)}
                >
                  <span className="qs-row-label">
                    <Marked text={t.label} query={q} />
                  </span>
                  {t.arabic && (
                    <span className="qs-row-arabic" dir="rtl">
                      <Marked text={t.arabic} query={q} />
                    </span>
                  )}
                  {t.preview && (
                    <span className="qs-row-preview">
                      <Marked text={t.preview} query={q} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {loading && groups.length > 0 && <div className="qs-loading">Searching…</div>}
      </div>
    </div>
  );
}
