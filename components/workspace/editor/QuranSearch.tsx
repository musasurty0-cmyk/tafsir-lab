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
  /** Workspace Selections, for callers that accept them (/link). */
  selections?: SearchTarget[];
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
  selections = [],
  onSelect,
  onCancel,
  placeholder = "Search the Qurʾān…",
  autoFocus = true,
}: Props) {
  /* Stage two: a surah has been chosen and its ayat are being browsed. Kept
     as one piece of state so backing out restores stage one cleanly and no
     stale ayah list can survive a new search. */
  const [stage, setStage] = useState<{ surah: number; name: string } | null>(null);
  const [rows,  setRows]  = useState<{ ayah: number; arabic: string; translation?: string }[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  const [q, setQ]               = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [verses, setVerses]     = useState<SearchTarget[]>([]);
  const [loading, setLoading]   = useState(false);
  const [active, setActive]     = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef  = useRef<HTMLDivElement>(null);
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

    if (kinds.includes("selection") && selections.length) {
      /* Selections are searched by NAME or by verse — a reader remembers
         "the bit around ayah 6" as readily as the title they chose. */
      const ql = query.toLowerCase();
      const num = Number(query.replace(/[^0-9]/g, ""));
      const hits = selections.filter((s) => {
        if (s.label.toLowerCase().includes(ql)) return true;
        if (!Number.isFinite(num) || !query.match(/\d/)) return false;
        const m = (s.preview ?? "").match(/(\d+)\D+(\d+)/);
        if (!m) return false;
        return num >= Number(m[1]) && num <= Number(m[2]);
      }).slice(0, 6);
      if (hits.length) out.push({ label: "Selections", items: hits });
    }

    if (kinds.includes("ayah") && verses.length) {
      out.push({ label: "Āyāt", items: verses });
    }
    return out;
  }, [q, chapters, chapterById, verses, selections, kinds, nameFor]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  // Keep the highlighted row valid as results change under the cursor.
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    if (active >= flat.length) setActive(Math.max(0, flat.length - 1));
  }, [flat.length, active]);

  // Stage two data. Cleared whenever the stage changes so a previous surah's
  // list can never be shown under a new heading.
  useEffect(() => {
    if (!stage) { setRows([]); return; }
    let cancelled = false;
    setRowsLoading(true);
    setRows([]);
    fetch(`/api/quran/surah/${stage.surah}/verses`)
      .then((r) => (r.ok ? r.json() : { verses: [] }))
      .then((d) => { if (!cancelled) setRows(d.verses ?? []); })
      .catch(() => { if (!cancelled) setRows([]); })
      .finally(() => { if (!cancelled) setRowsLoading(false); });
    return () => { cancelled = true; };
  }, [stage]);

  /** Stage two rows, filtered by the ayah-number box. A bare number matches by
   *  PREFIX so typing 1 in a long surah offers 1, 1x, 1xx rather than only
   *  ayah 1; anything else falls back to matching the Arabic. */
  const filteredRows = useMemo(() => {
    const query = q.trim();
    if (!query) return rows;
    const digits = query.replace(/[^0-9٠-٩]/g, "");
    if (digits) {
      const norm = digits.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
      return rows.filter((r) => String(r.ayah).startsWith(norm));
    }
    const nq = query;
    return rows.filter((r) => (findMatchRange(r.arabic, nq) !== null)
                           || (r.translation ? r.translation.toLowerCase().includes(nq.toLowerCase()) : false));
  }, [rows, q]);

  const choose = useCallback((t: SearchTarget) => {
    /* Choosing a SURAH is not a final answer for /ayah — it opens that surah's
       ayah list instead. Previously this fell through to insertion, which is
       how "I know the surah but not the number" ended up inserting the wrong
       verse. Callers that genuinely want a surah target (/link) say so by not
       listing "ayah" among their kinds. */
    if (t.kind === "surah" && kinds.includes("ayah") && t.surah) {
      setStage({ surah: t.surah, name: t.label.split(" · ")[0] });
      setQ("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    pushRecent(t);
    onSelect(t);
  }, [onSelect, kinds]);

  const chooseAyah = useCallback((ayah: number) => {
    if (!stage) return;
    const t: SearchTarget = {
      kind: "ayah", id: verseKey(stage.surah, ayah),
      surah: stage.surah, ayah,
      label: `${stage.name} ${stage.surah}:${ayah}`,
    };
    pushRecent(t);
    onSelect(t);
  }, [stage, onSelect]);

  const back = useCallback(() => { setStage(null); setQ(""); setActive(0);
    requestAnimationFrame(() => inputRef.current?.focus()); }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const len = stage ? filteredRows.length : flat.length;
    if (e.key === "ArrowDown")      { e.preventDefault(); setActive((i) => Math.min(i + 1, len - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (stage) { const r = filteredRows[active]; if (r) chooseAyah(r.ayah); }
      else       { const t = flat[active];         if (t) choose(t); }
    }
    else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      // Escape backs out one stage before closing, so reaching the wrong surah
      // does not throw the whole search away.
      if (stage) back(); else onCancel();
    }
    else if (e.key === "Backspace" && stage && q === "") {
      e.preventDefault(); back();
    }
  };

  // Keep the active row in view during keyboard navigation.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  /* ── Dismissal ──────────────────────────────────────────────────────────
     THE BUG THIS FIXES: Escape used to be handled only by the input's own
     onKeyDown, and there was no outside-click handling at all. Click anywhere
     else and the input lost focus, so Escape no longer reached the handler and
     nothing else could close the panel — it stayed mounted until the page was
     reloaded.

     Both listeners now live on the document and run in the CAPTURE phase, so
     they fire wherever focus happens to be. */
  useEffect(() => {
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    };
    const onDocDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("keydown", onDocKey, true);
    document.addEventListener("pointerdown", onDocDown, true);
    return () => {
      document.removeEventListener("keydown", onDocKey, true);
      document.removeEventListener("pointerdown", onDocDown, true);
    };
  }, [onCancel]);

  let idx = -1;

  // ── Stage two: pick an ayah within the chosen surah ──────────────────────
  if (stage) {
    return (
      <div className="qs-panel" ref={rootRef} onMouseDown={(e) => e.preventDefault()}>
        <div className="qs-stage-head">
          <button type="button" className="qs-back" onClick={back} title="Back to search">
            ‹
          </button>
          <span className="qs-stage-name">{stage.name}</span>
        </div>
        <input
          ref={inputRef}
          className="qs-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search āyah number…"
          inputMode="numeric"
          dir="auto"
          aria-label="Search āyah number"
        />
        <div className="qs-results" ref={listRef}>
          {rowsLoading && <div className="qs-empty">Loading āyāt…</div>}
          {!rowsLoading && filteredRows.length === 0 && (
            <div className="qs-empty">No āyah matches</div>
          )}
          {filteredRows.map((r, i) => (
            <button
              key={r.ayah}
              type="button"
              data-idx={i}
              className="qs-row qs-row--ayah"
              data-active={i === active ? "true" : "false"}
              onMouseEnter={() => setActive(i)}
              onClick={() => chooseAyah(r.ayah)}
            >
              <span className="qs-ayah-num">{r.ayah}</span>
              <span className="qs-ayah-body">
                <span className="qs-row-arabic" dir="rtl">{r.arabic}</span>
                {r.translation && <span className="qs-row-preview">{r.translation}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Stage one: find a surah, a reference, or verse text ──────────────────
  return (
    <div className="qs-panel" ref={rootRef} onMouseDown={(e) => e.preventDefault()}>
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
