"use client";

/**
 * AyahBlockView — React NodeView for embedded Qur'anic verse blocks.
 *
 * Responsibilities:
 *   - Fetch Arabic text + translation on first render (if not cached in attrs).
 *   - Toggle translation visibility (persisted in node attrs → TipTap doc → DB).
 *   - Open Tafsīr drawer via EditorContext callback.
 *   - Show/create notes for this specific ayah (from EditorContext).
 *   - Show progress controls on demand.
 *   - Delete the block.
 *   - A selection ("/a 2:1-5", endAyah set) shows the run as one passage; the
 *     per-āyah controls (progress, a new note) stay with single blocks.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { qcfFamily, loadQCFFontsFor } from "@/lib/qcf-font";
import { qcfWords } from "@/lib/qcf-words";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEditorCtx } from "./EditorContext";
import NoteCard from "../NoteCard";
import NoteCreator from "../NoteCreator";
import ProgressControl from "../ProgressControl";

// ── Icons ──────────────────────────────────────────────────────────────────

const BookOpenIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const TranslateIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
    <path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>
  </svg>
);
const ProgressIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="9"/>
  </svg>
);
const PlusIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
  </svg>
);

// ── Selections ────────────────────────────────────────────────────────────

interface RunVerse { ayah: number; ar: string; tr: string }

/* One request per surah for every selection in it, shared by blocks that mount
   together; a failure is dropped from the cache so a later mount retries. */
const surahRows = new Map<number, Promise<{ ayah: number; arabic: string; translation?: string }[]>>();
function loadSurahRows(surah: number) {
  let p = surahRows.get(surah);
  if (!p) {
    p = fetch(`/api/quran/surah/${surah}/verses`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then((d) => (d.verses ?? []) as { ayah: number; arabic: string; translation?: string }[])
      .catch((e) => { surahRows.delete(surah); throw e; });
    surahRows.set(surah, p);
  }
  return p;
}

/** Past this many āyāt the muṣḥaf glyphs (a request per verse) are not worth
 *  it; the passage stays in the Uthmani text face, which needs none. */
const RUN_GLYPH_MAX = 40;

/** Translation HTML as plain text. Footnote markers go first, whole: they are
 *  <sup> numbers, and stripping only the tags left "Allāh1" in the sentence. */
const plain = (html: string | undefined) =>
  (html ?? "").replace(/<sup[^>]*>.*?<\/sup>/g, "").replace(/<[^>]+>/g, "").trim();

const arabicDigits = (n: number) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

// ── Component ─────────────────────────────────────────────────────────────

/** Smaller than this and the Arabic wraps to shreds; the floor is the point
 *  at which a verse is still readable rather than merely present. */
const MIN_W = 260;
const MIN_H = 120;

export default function AyahBlockView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
}: NodeViewProps) {
  const [hovered, setHovered] = useState(false);
  const {
    verseKey,
    surahNumber,
    ayahNumber,
    arabicText,
    translationText,
    showTranslation,
  } = node.attrs as {
    verseKey: string;
    surahNumber: number;
    ayahNumber: number;
    arabicText: string;
    translationText: string;
    showTranslation: boolean;
  };
  const endAyah = (node.attrs.endAyah as number | null) ?? null;
  const isRun   = endAyah != null && endAyah > ayahNumber;
  const label   = isRun ? `${verseKey}–${endAyah}` : verseKey;

  const ctx = useEditorCtx();

  /* ── A selection's verses ──────────────────────────────────────────────
     Read whole rather than per verse: the sūrah being studied is already
     loaded, and any other sūrah is one request for the lot. The joined text
     is written back to the node so export and copy carry the passage. */
  const [run, setRun]             = useState<RunVerse[] | null>(null);
  const [runError, setRunError]   = useState(false);
  const [runRetry, setRunRetry]   = useState(0);
  const [runGlyphs, setRunGlyphs] = useState<{ code: string; page: number }[][] | null>(null);
  const runKeys = useMemo(
    () => (isRun ? Array.from({ length: endAyah! - ayahNumber + 1 }, (_, i) => `${surahNumber}:${ayahNumber + i}`) : []),
    [isRun, surahNumber, ayahNumber, endAyah],
  );

  useEffect(() => {
    if (!isRun) return;
    let live = true;
    setRunError(false);
    const done = (verses: RunVerse[]) => {
      if (!live) return;
      setRun(verses);
      if (!arabicText && verses.length) {
        updateAttributes({
          arabicText:      verses.map((v) => `${v.ar} ﴿${arabicDigits(v.ayah)}﴾`).join(" "),
          translationText: verses.map((v) => `(${v.ayah}) ${v.tr}`).join(" "),
        });
      }
    };
    const pre = runKeys.map((k) => ctx.verses.find((v) => v.verse_key === k));
    if (pre.every(Boolean)) {
      done(pre.map((v, i) => ({
        ayah: ayahNumber + i,
        ar:   v!.text_uthmani.trim(),
        tr:   plain(v!.translations?.[0]?.text),
      })));
    } else {
      loadSurahRows(surahNumber)
        .then((rows) => done(rows
          .filter((r) => r.ayah >= ayahNumber && r.ayah <= endAyah!)
          .map((r) => ({ ayah: r.ayah, ar: r.arabic.trim(), tr: r.translation ?? "" }))))
        .catch(() => { if (live) setRunError(true); });
    }
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRun, runKeys, runRetry]);

  useEffect(() => {
    if (!isRun || runKeys.length > RUN_GLYPH_MAX) return;
    let live = true;
    Promise.all(runKeys.map((k) => qcfWords(k, ctx.verses)))
      .then(async (all) => {
        // All or nothing, as for one āyah: a passage half in each face is worse.
        if (!live || all.some((w) => !w.length)) return;
        await loadQCFFontsFor(all.flat().map((w) => w.page));
        if (live) setRunGlyphs(all);
      })
      .catch(() => { /* stay with the text face */ });
    return () => { live = false; };
  }, [isRun, runKeys, ctx.verses]);

  // Local display state — updated immediately on fetch, independent of
  // TipTap's async attr propagation (which can lag by one render cycle).
  const [displayArabic,      setDisplayArabic]      = useState(arabicText      || "");
  const [displayTranslation, setDisplayTranslation] = useState(translationText || "");

  // Start in "fetching" state when there is no cached text so the very first
  // render already shows the spinner (not an empty block).
  const [fetching, setFetching]         = useState(() => !arabicText);
  const [fetchError, setFetchError]     = useState<string | null>(null);
  // Incrementing this triggers a retry without changing verseKey.
  const [retryKey, setRetryKey]         = useState(0);
  /* The muṣḥaf glyphs, when they are available.
     Kept out of the node's attributes on purpose: they are derivable from the
     verse key, they would bloat every saved document, and a doc written before
     this existed must keep working. So the block renders `displayArabic` as it
     always did and swaps to the glyphs once the page font has loaded — which
     also means a reader on a slow link sees the verse rather than nothing. */
  const [glyphs, setGlyphs] = useState<{ code: string; page: number }[] | null>(null);
  const [noteCreatorOpen, setNoteCreatorOpen] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  /* Glyph codes + their page fonts.
     Runs whatever the cache holds, because the text attribute says nothing
     about whether the codes were ever fetched. `qcfWords` memoises per verse
     across every block in the document, so a page of āyah blocks makes one
     request per distinct verse rather than one per block. */
  useEffect(() => {
    if (isRun) return; // a selection loads its own, verse by verse
    let live = true;
    qcfWords(verseKey, ctx.verses)
      .then(async (words) => {
        if (!live || !words.length) return;
        await loadQCFFontsFor(words.map((w) => w.page));
        if (live) setGlyphs(words);
      })
      /* No glyphs is not an error the reader needs to hear about — the verse
         is already on screen in the fallback face. */
      .catch(() => { /* stay with displayArabic */ });
    return () => { live = false; };
  }, [verseKey, ctx.verses, isRun]);

  // ── Fetch verse data if not yet cached ────────────────────────────────
  useEffect(() => {
    if (isRun) return;      // a selection reads its verses above
    if (arabicText) return; // already populated — nothing to do
    setFetching(true);
    setFetchError(null);

    // Check the pre-loaded verses for the current surah first (instant).
    const preloaded = ctx.verses.find((v) => v.verse_key === verseKey);
    if (preloaded) {
      const ar = preloaded.text_uthmani;
      const tr = plain(preloaded.translations?.[0]?.text);
      // Update local display state immediately (synchronous, no TipTap lag).
      setDisplayArabic(ar);
      setDisplayTranslation(tr);
      // Persist into TipTap attrs for future renders / DB save (async, that's fine).
      updateAttributes({ arabicText: ar, translationText: tr });
      setFetching(false);
      return;
    }

    /* Cross-surah verse: fetch from the server proxy.

       `live` guards updateAttributes() in particular. This is a TipTap node
       view, and the success path writes back into the document — if the block
       was deleted, or the reader navigated away, while the request was in
       flight, that write targets a node position that no longer exists. A
       display-only stale update would merely look wrong; this one throws. */
    let live = true;
    const urlKey = verseKey.replace(":", "_");
    fetch(`/api/ayah/${urlKey}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then(({ verse }) => {
        if (!live) return;
        const ar = verse.text_uthmani as string;
        const tr = plain(verse.translations?.[0]?.text as string | undefined);
        setDisplayArabic(ar);
        setDisplayTranslation(tr);
        updateAttributes({ arabicText: ar, translationText: tr });
      })
      .catch(() => { if (live) setFetchError("Could not load this verse."); })
      .finally(() => { if (live) setFetching(false); });
    return () => { live = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verseKey, retryKey]);

  // ── Notes for this ayah ───────────────────────────────────────────────
  const ayahNotes = ctx.notes.filter(
    (n) =>
      n.anchorType  === "ayah" &&
      n.surahNumber === surahNumber &&
      n.ayahNumber  != null &&
      n.ayahNumber  >= ayahNumber &&
      n.ayahNumber  <= (isRun ? endAyah! : ayahNumber)
  );

  const progressKey    = `${surahNumber}:${ayahNumber}`;
  const personalStatus = ctx.personalProgress[progressKey] ?? null;
  const groupEntry     = ctx.groupProgress[progressKey]    ?? null;

  /* Corner resize. Both axes move together from whichever corner is grabbed,
     so the block resizes the way the pointer does rather than only widening.
     Divided by the live zoom: on a scaled canvas a 100px pointer move is not
     a 100px change to the block, and without this the block ran away from the
     cursor at anything other than 100%. */
  const startResize = useCallback((corner: string) => (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!editor.isEditable) return;
    e.preventDefault(); e.stopPropagation();
    const handle = e.currentTarget;
    const el = handle.closest(".ayah-block-node") as HTMLElement | null;
    if (!el) return;

    handle.setPointerCapture(e.pointerId);
    const r0 = el.getBoundingClientRect();
    const startX = e.clientX, startY = e.clientY;
    /* Read the rendered scale from the element itself rather than threading
       zoom state in: the canvas applies it as a CSS transform on an ancestor,
       so the ratio of the painted box to its layout box IS the zoom. */
    const scale = r0.width / (el.offsetWidth || r0.width) || 1;
    const west = corner.includes("w"), north = corner.includes("n");
    const maxW = (el.parentElement?.getBoundingClientRect().width ?? r0.width) / scale;
    let w = Math.round(r0.width / scale), h = Math.round(r0.height / scale);

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale * (west ? -1 : 1);
      const dy = (ev.clientY - startY) / scale * (north ? -1 : 1);
      w = Math.round(Math.min(maxW, Math.max(MIN_W, r0.width  / scale + dx)));
      h = Math.round(Math.max(MIN_H,                 r0.height / scale + dy));
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;
    };
    const end = () => {
      handle.releasePointerCapture(e.pointerId);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", end);
      handle.removeEventListener("pointercancel", end);
      el.style.width = ""; el.style.height = "";
      /* Full width stores null so the block stays fluid if the sheet changes;
         a height at the floor likewise falls back to content height. */
      updateAttributes({
        width:  w >= maxW - 2 ? null : w,
        height: h <= MIN_H     ? null : h,
      });
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", end);
    handle.addEventListener("pointercancel", end);
  }, [editor, updateAttributes]);

  /** Double-click any handle restores the default — a drag is never one-way. */
  const resetSize = useCallback(() => {
    if (editor.isEditable) updateAttributes({ width: null, height: null });
  }, [editor, updateAttributes]);

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <NodeViewWrapper>
      <div
        className="ayah-block-node"
        data-selected={selected ? "true" : "false"}
        contentEditable={false}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...(node.attrs.width  ? { width:  `${node.attrs.width}px`  } : {}),
          ...(node.attrs.height ? { height: `${node.attrs.height}px` } : {}),
        }}
      >
        {/* Corner handles. Shown when the node is selected OR hovered: the
            block is contentEditable={false}, so clicking inside it never
            produces a NodeSelection and `selected` alone stayed false — the
            grips existed but were unreachable. */}
        {(selected || hovered) && editor.isEditable && (["nw", "ne", "sw", "se"] as const).map((c) => (
          <span
            key={c}
            className="ayah-block-grip"
            data-corner={c}
            role="separator"
            aria-label={`Resize āyah block (${c})`}
            title="Drag to resize · double-click to reset"
            onPointerDown={startResize(c)}
            onDoubleClick={resetSize}
          />
        ))}
        {/* ── Drag handle ── */}
        <div className="ayah-block-drag" data-drag-handle title="Drag to reorder">
          ⠿
        </div>

        {/* ── Main content ── */}
        <div className="ayah-block-inner">

          {/* Header row */}
          <div className="ayah-block-head">
            <span className="ayah-block-ref">{label}</span>
            <div className="ayah-block-toolbar">
              <button
                className="ayah-block-tool"
                onClick={() => updateAttributes({ showTranslation: !showTranslation })}
                title={showTranslation ? "Hide translation" : "Show translation"}
                data-active={showTranslation ? "true" : "false"}
              >
                <TranslateIcon />
              </button>
              <button
                className="ayah-block-tool"
                onClick={() => ctx.onOpenTafsir(verseKey)}
                title="Open Tafsīr"
              >
                <BookOpenIcon />
              </button>
              {/* Progress and a new note belong to ONE āyah; on a selection
                  there is no single verse for them to mean. */}
              {!isRun && (
                <button
                  className="ayah-block-tool"
                  onClick={() => setShowProgress((s) => !s)}
                  title="Progress"
                  data-active={showProgress ? "true" : "false"}
                >
                  <ProgressIcon />
                </button>
              )}
              {!isRun && (
                <button
                  className="ayah-block-tool"
                  onClick={() => setNoteCreatorOpen((o) => !o)}
                  title="Add note"
                  data-active={noteCreatorOpen ? "true" : "false"}
                >
                  <PlusIcon />
                </button>
              )}
              <button
                className="ayah-block-tool ayah-block-tool--danger"
                onClick={deleteNode}
                title={isRun ? "Remove this selection from the document" : "Remove this ayah block from the document"}
              >
                <TrashIcon />
              </button>
            </div>
          </div>

          {/* Selection body */}
          {isRun && !run && !runError && (
            <div className="ayah-block-skeleton">
              <div className="ayah-skeleton-arabic" />
              <div className="ayah-skeleton-trans" />
            </div>
          )}
          {isRun && runError && (
            <div className="ayah-block-error">
              <span>⚠ Could not load {label}</span>
              <button className="ayah-block-retry" onClick={() => setRunRetry((k) => k + 1)}>
                Retry
              </button>
            </div>
          )}
          {isRun && run && (
            <>
              <div className="ayah-block-arabic" dir="rtl" data-qcf={runGlyphs ? "true" : "false"}>
                {runGlyphs
                  ? runGlyphs.flatMap((words, v) => words.map((w, i) => (
                      /* Each verse's own words end with its number glyph, so
                         the passage is marked without adding anything. */
                      <span key={`${v}-${i}`} style={{ fontFamily: qcfFamily(w.page) }}>{w.code}</span>
                    )))
                  : run.map((v) => (
                      <span key={v.ayah}>
                        {v.ar}
                        <span className="ayah-block-mark">﴿{arabicDigits(v.ayah)}﴾</span>{" "}
                      </span>
                    ))}
              </div>
              {showTranslation && (
                <div className="ayah-block-translation ayah-block-translation--run">
                  {run.map((v) => (
                    <p key={v.ayah}><sup>{v.ayah}</sup>{v.tr}</p>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Verse body */}
          {!isRun && fetching && (
            <div className="ayah-block-skeleton">
              <div className="ayah-skeleton-arabic" />
              <div className="ayah-skeleton-trans" />
            </div>
          )}

          {!isRun && !fetching && fetchError && (
            <div className="ayah-block-error">
              <span>⚠ Could not load {verseKey}</span>
              <span className="ayah-block-error-detail">{fetchError}</span>
              <button
                className="ayah-block-retry"
                onClick={() => setRetryKey((k) => k + 1)}
              >
                Retry
              </button>
            </div>
          )}

          {!isRun && !fetching && !fetchError && displayArabic && (
            <>
              <div className="ayah-block-arabic" dir="rtl" data-qcf={glyphs ? "true" : "false"}>
                {glyphs
                  ? glyphs.map((w, i) => (
                      /* Word by word, each in the font for ITS page: a verse
                         that straddles a page boundary needs both, and the
                         codes are only valid in their own page's face. */
                      <span key={i} style={{ fontFamily: qcfFamily(w.page) }}>{w.code}</span>
                    ))
                  : displayArabic}
              </div>
              {showTranslation && displayTranslation && (
                <div className="ayah-block-translation">{displayTranslation}</div>
              )}
            </>
          )}

          {/* Text not yet available — show skeleton */}
          {!isRun && !fetching && !fetchError && !displayArabic && (
            <div className="ayah-block-skeleton">
              <div className="ayah-skeleton-arabic" />
              <div className="ayah-skeleton-trans" />
            </div>
          )}

          {/* Progress controls */}
          {showProgress && (
            <ProgressControl
              surahNumber={surahNumber}
              ayahNumber={ayahNumber}
              personalStatus={personalStatus}
              groupEntry={groupEntry}
              role={ctx.role}
              onPersonalChange={(s) => ctx.onProgressChange("personal", surahNumber, ayahNumber, s)}
              onGroupChange={(s)    => ctx.onProgressChange("group",    surahNumber, ayahNumber, s)}
            />
          )}

          {/* Notes */}
          {ayahNotes.length > 0 && (
            <div className="ayah-block-notes">
              {ayahNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onUpdated={ctx.onNoteUpdated}
                  onDeleted={ctx.onNoteDeleted}
                />
              ))}
            </div>
          )}

          {/* Note creator */}
          {noteCreatorOpen && (
            <NoteCreator
              pageId={ctx.pageId}
              surahNumber={surahNumber}
              ayahNumber={ayahNumber}
              onCreated={(note) => {
                ctx.onNoteCreated(note);
                setNoteCreatorOpen(false);
              }}
              onClose={() => setNoteCreatorOpen(false)}
            />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}
