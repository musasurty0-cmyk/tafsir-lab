"use client";

/**
 * QCFMushafPage — renders one Mushaf page using Quran Foundation QCF v2 fonts.
 *
 * Rendering approach:
 *   • Each line's words are adjacent inline <span> elements inside a
 *     direction:rtl block.  React array children carry no whitespace text
 *     nodes, so the browser forms one continuous glyph run — visually
 *     identical to a concatenated string but with per-word interaction.
 *   • The QCF page font (p{N}-v2) handles all glyph shaping internally.
 *
 * Load states:
 *   data loading   → skeleton (qcfLoading prop = true)
 *   font loading   → skeleton (!fontReady && !fontError)
 *   font error     → error message + Retry button
 *   ready          → QCF glyph text
 *
 * IMPORTANT — font/code pairing:
 *   code_v2  must only be rendered with family  p{v2_page}-v2.
 *   Never mix v1 codes with v2 fonts or vice versa.
 *   Never render code_v2 before the matching font file is confirmed loaded.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QCFVerse, Chapter } from "@/lib/types";

// ── Font loading ────────────────────────────────────────────────────────────

const FONT_CDN   = "https://verses.quran.foundation/fonts/quran/hafs/v2/woff2";
const fontLoaded = new Set<number>();

/**
 * Load and register one QCF v2 page font.
 * Throws if the network request fails — callers must handle errors.
 */
async function loadQCFFont(pageNum: number): Promise<void> {
  if (fontLoaded.has(pageNum)) return;

  const family = `p${pageNum}-v2`;

  // Already registered and loaded in this browser session?
  for (const ff of document.fonts.values()) {
    const name = ff.family.replace(/^"|"$/g, "");
    if (name === family && ff.status === "loaded") {
      fontLoaded.add(pageNum);
      return;
    }
  }

  const ff = new FontFace(family, `url(${FONT_CDN}/p${pageNum}.woff2)`);
  // "block": text is invisible until the font loads — no flash of fallback glyphs.
  ff.display = "block";
  const loaded = await ff.load();  // throws on network/decode failure
  document.fonts.add(loaded);
  fontLoaded.add(pageNum);
}

// ── Props ───────────────────────────────────────────────────────────────────

interface Props {
  verses:            QCFVerse[];
  pageNumber:        number;
  chapter:           Chapter;
  loading?:          boolean;
  cardRef:           React.RefObject<HTMLDivElement | null>;
  onRegisterAyahRef: (ayahNum: number, el: HTMLElement | null) => void;
  onRegisterWordRef: (ayahNum: number, wordPos: number, el: HTMLElement | null) => void;
  onOpenFocus:       (verseKey: string, wordPos: number | null) => void;
  /** Words that have at least one note → soft translucent highlight colour.
   *  Key format: "${ayahNumber}:${wordPosition}" */
  notedWordColors?:  ReadonlyMap<string, string>;
  /** Word currently open in the note panel — gets the selection highlight */
  selectedWordKey?:  string | null;
  /** Ayāt with notes in their annotation layer → the whole ayah (words + end
   *  marker) is wrapped in ONE continuous wash. Keyed by ayah number. */
  notedAyahColors?:  ReadonlyMap<number, string>;
  /** Ayah whose annotation layer is open ("1:2" verseKey) */
  selectedEndKey?:   string | null;
  /** Reading Mode (false) leaves the page inert: words and ayah markers are
   *  not selectable, so the default experience is reading rather than
   *  annotating. The Mushaf itself renders identically in both modes. */
  studyMode?:        boolean;
  /** Reading Mode only — the surah title is the entry point into Study Mode. */
  onEnterStudy?:     () => void;
  /** Ayah range currently being selected, inclusive. Rendered as ONE
   *  continuous band across the whole range rather than per-ayah blocks. */
  rangeSelection?:   { start: number; end: number } | null;
  /** Fired continuously while dragging, and once more on release with
   *  `committed` set, so the caller can show a toolbar only when the gesture
   *  has finished. */
  onRangeChange?:    (sel: { start: number; end: number } | null, committed: boolean) => void;
  /** Saved segments covering this page — drawn as quiet margin markers. */
  segments?:         { id: string; name: string; startAyah: number; endAyah: number; color?: string | null }[];
  /** Segment whose notes are open — gets the stronger visual state. */
  activeSegmentId?:  string | null;
  /** Receives every Selection covering the tapped ayah, innermost last. More
   *  than one means the tap is ambiguous and the caller should ask. */
  onSegmentClick?:   (ids: string[]) => void;
}

/** Wash for the ayah whose annotation layer is currently open. */
const AYAH_ACTIVE_WASH = "oklch(0.85 0.1 250 / 0.5)";
/** Wash for a range being selected — lighter, because it is transient. */
const RANGE_WASH = "oklch(0.88 0.07 250 / 0.55)";
/** Pointer travel before a press becomes a range drag rather than a tap.
 *  Below this, a slightly unsteady tap would start selecting instead of
 *  opening the word note it was aimed at. */
const DRAG_PX = 6;
/** Touch must be held before it selects: a finger drag is a pan until proven
 *  otherwise, or the page could never be scrolled by touching the text. */
const LONG_PRESS_MS = 380;

/** Translucent tint for a saved selection. Kept low so the Qur'anic text
 *  stays dominant; the active one is only slightly stronger, never opaque. */
function segTint(
  sg: { id: string; color?: string | null },
  activeId: string | null,
): string {
  const base = sg.color || "oklch(0.55 0.11 155)";
  const pct  = sg.id === activeId ? 26 : 15;
  return `color-mix(in srgb, ${base} ${pct}%, transparent)`;
}

// ── Word entry collapsed for line grouping ──────────────────────────────────

interface WordEntry {
  id:             number;
  position:       number;
  v2_page:        number;
  code_v2:        string;
  text_qpc_hafs:  string;
  char_type_name: "word" | "end" | "pause";
  translation?:   { text: string; language_name: string };
  verseKey:       string;
  ayahNum:        number;
  isFirstInVerse: boolean;
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ cardRef }: { cardRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={cardRef} className="qcf-page qcf-page--loading">
      <div className="qcf-skeleton">
        {Array.from({ length: 15 }, (_, i) => (
          <div
            key={i}
            className="qcf-skeleton-line"
            style={{ width: `${90 - Math.abs(Math.sin(i * 0.9)) * 14}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

function QCFMushafPage({
  verses, pageNumber, chapter, loading = false,
  cardRef, onRegisterAyahRef, onRegisterWordRef, onOpenFocus,
  notedWordColors,
  selectedWordKey,
  notedAyahColors,
  selectedEndKey,
  studyMode = true,
  onEnterStudy,
  rangeSelection = null,
  onRangeChange,
  segments = [],
  activeSegmentId = null,
  onSegmentClick,
}: Props) {

  const [fontReady, setFontReady] = useState(false);
  const [fontError, setFontError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const retryLoad = useCallback(() => {
    setFontError(false);
    setFontReady(false);
    setRetryCount((n) => n + 1);
  }, []);

  useEffect(() => {
    if (verses.length === 0) return;

    let cancelled = false;
    setFontReady(false);
    setFontError(false);

    // Collect every unique v2_page referenced by the words on this canvas page.
    // All fonts must be loaded before we render any QCF glyphs — mixing a
    // loaded font with an unloaded one would still produce broken text.
    const pageNums = new Set<number>([pageNumber]);
    for (const v of verses) {
      for (const w of v.words) {
        if (w.v2_page) pageNums.add(w.v2_page);
      }
    }

    Promise.all([...pageNums].map(loadQCFFont))  // NOTE: errors propagate here
      .then(() => {
        if (!cancelled) setFontReady(true);
      })
      .catch(() => {
        // Font failed to load — do NOT set fontReady.
        // Rendering code_v2 with a missing font produces broken PUA glyphs.
        if (!cancelled) setFontError(true);
      });

    return () => { cancelled = true; };
  }, [pageNumber, verses, retryCount]);

  /* ── Range selection ────────────────────────────────────────────────────
     A press on a glyph is ambiguous until it moves: held still it is the
     existing tap that opens that word's notes, dragged it selects a range.
     Resolving it by TRAVEL rather than by a separate mode means no extra tool
     and no lost gesture — a tap keeps working exactly as before.

     Selection always snaps to whole ayat: the anchor and the glyph under the
     pointer contribute only their ayah numbers, so starting mid-ayah still
     includes all of it. */
  /** Set when a pointerup ended a real drag, so the click that follows is
   *  swallowed instead of opening a word note. */
  const dragEndedRef = useRef(false);
  const dragRef = useRef<{
    anchorAyah: number; x: number; y: number;
    active: boolean; pointerId: number; longPress?: number;
  } | null>(null);

  const endDrag = useCallback(() => {
    const d = dragRef.current;
    if (d?.longPress) window.clearTimeout(d.longPress);
    const wasActive = d?.active ?? false;
    dragRef.current = null;
    return wasActive;
  }, []);

  const beginDrag = useCallback((e: React.PointerEvent, ayahNum: number) => {
    if (!studyMode || !onRangeChange) return;
    const touch = e.pointerType === "touch";
    dragRef.current = {
      anchorAyah: ayahNum, x: e.clientX, y: e.clientY,
      active: false, pointerId: e.pointerId,
      // Touch commits to selecting only after a hold, so ordinary finger
      // panning over the text is unaffected.
      longPress: touch
        ? window.setTimeout(() => {
            const d = dragRef.current;
            if (!d) return;
            d.active = true;
            onRangeChange({ start: ayahNum, end: ayahNum }, false);
          }, LONG_PRESS_MS)
        : undefined,
    };
  }, [studyMode, onRangeChange]);

  const moveDrag = useCallback((e: React.PointerEvent, ayahNum: number) => {
    const d = dragRef.current;
    if (!d || !onRangeChange) return;
    if (!d.active) {
      // Mouse and pen start selecting once travel passes the threshold;
      // touch waits for its hold instead.
      if (e.pointerType === "touch") return;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_PX) return;
      d.active = true;
    }
    const start = Math.min(d.anchorAyah, ayahNum);
    const end   = Math.max(d.anchorAyah, ayahNum);
    onRangeChange({ start, end }, false);
  }, [onRangeChange]);

  const finishDrag = useCallback(() => {
    const d = dragRef.current;
    if (d?.active && onRangeChange) {
      // Re-emit the same range as committed so the caller can raise its
      // toolbar only once the gesture is over.
      onRangeChange(rangeSelection, true);
    }
    return endDrag();
  }, [onRangeChange, rangeSelection, endDrag]);

  // ── Build line map ────────────────────────────────────────────────────────
  // Memoised on the data it derives from. This allocates a Map plus one
  // object per word — several hundred per page — and it used to run on EVERY
  // render, including every frame of a zoom gesture, where none of its inputs
  // had changed.
  const { sortedLines, isSurahStart } = useMemo(() => {
    const lineMap = new Map<number, WordEntry[]>();
    let lineCounter = 0;

    for (const verse of verses) {
      let firstInVerse = true;
      for (const word of verse.words) {
        const lineKey = (word.line_number != null)
          ? word.line_number
          : --lineCounter;

        if (!lineMap.has(lineKey)) lineMap.set(lineKey, []);
        lineMap.get(lineKey)!.push({
          id:             word.id,
          position:       word.position,
          v2_page:        word.v2_page ?? pageNumber,
          code_v2:        word.code_v2 ?? "",
          text_qpc_hafs:  word.text_qpc_hafs ?? "",
          char_type_name: word.char_type_name,
          translation:    word.translation,
          verseKey:       verse.verse_key,
          ayahNum:        verse.verse_number,
          isFirstInVerse: firstInVerse,
        });
        firstInVerse = false;
      }
    }

    return {
      sortedLines: [...lineMap.entries()].sort(([a], [b]) => a - b),
      /* True only on the surah's OPENING page. The name label shows on every
         page; the basmala belongs to the surah's start, not to each sheet. */
      isSurahStart: verses.some((v) => {
        const [sId, vNum] = v.verse_key.split(":").map(Number);
        return sId === chapter.id && vNum === 1;
      }),
    };
  }, [verses, pageNumber, chapter.id]);

  // ── Gate 1: data still loading ────────────────────────────────────────────
  if (loading) {
    return <Skeleton cardRef={cardRef} />;
  }

  // ── Gate 2: font still loading (show skeleton, not fallback Arabic) ───────
  //
  // Rationale: code_v2 values are Private Use Area (PUA) characters that are
  // only meaningful with the correct QCF page font.  Rendering them before
  // the font is confirmed loaded causes the browser to substitute a fallback
  // font which maps PUA codepoints to blank boxes or wrong glyphs — producing
  // overlapping / broken text.  Showing the skeleton instead prevents any
  // flash of broken content.
  if (!fontReady && !fontError) {
    return <Skeleton cardRef={cardRef} />;
  }

  // ── Gate 3: font failed to load ───────────────────────────────────────────
  if (fontError) {
    return (
      <div ref={cardRef} className="qcf-page qcf-page--error">
        <div className="qcf-error">
          <p className="qcf-error-msg">Quran font failed to load.</p>
          <button className="qcf-error-retry" onClick={retryLoad}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Render (font confirmed loaded) ────────────────────────────────────────

  return (
    <div
      ref={cardRef}
      className="qcf-page"
      onMouseDown={(e) => e.stopPropagation()}
      onPointerLeave={() => { if (dragRef.current) endDrag(); }}
      dir="rtl"
    >
      {/* ── Surah header — on EVERY page, so you always know which surah you
             are reading. Only the basmala is limited to the opening page. ── */}
      <div className="qcf-surah-header">
          <div className="qcf-surah-ornament">
            {/* In Reading Mode the title is the door into Study Mode — it is
                the one affordance on an otherwise inert page. In Study Mode
                it is plain text again, since the workspace is already open. */}
            {studyMode ? (
              <span className="qcf-surah-name">
                {chapter.name_arabic}
                <span className="qcf-surah-name-en" dir="ltr">{chapter.name_simple}</span>
              </span>
            ) : (
              <button
                type="button"
                className="qcf-surah-name qcf-surah-name--btn"
                onClick={onEnterStudy}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                title="Open study notes"
              >
                {chapter.name_arabic}
                {/* dir="ltr" so the Latin name is not reordered by the RTL page. */}
                <span className="qcf-surah-name-en" dir="ltr">{chapter.name_simple}</span>
                <span className="qcf-surah-caret" aria-hidden>▾</span>
              </button>
            )}
          </div>
          {/* Reading Mode only: the surah name is the way in, but nothing says
              so. Sits under the heading, never over the text, and disappears
              the moment Study Mode opens. */}
          {!studyMode && (
            <div className="qcf-read-hint">Press the Surah name to start studying</div>
          )}
          {isSurahStart && chapter.bismillah_pre && (
            <div className="qcf-basmala">
              بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ
            </div>
          )}
      </div>

      {/* ── Page lines ── */}
      <div className="qcf-lines">
        {sortedLines.map(([lineKey, words]) => {
          // All words on a Mushaf line share the same v2_page font.
          // We only reach here after fontReady=true, so the font IS loaded.
          const v2page = words[0]?.v2_page ?? pageNumber;

          // ── Ayah wash runs ─────────────────────────────────────────────
          // Consecutive glyphs of the same washed ayah are grouped into ONE
          // wrapper span carrying the background, so the highlight reads as
          // a single continuous region — no per-word boxes, no gaps.
          interface Run { wash: string | null; ayahNum: number; entries: WordEntry[]; range: boolean }
          const runs: Run[] = [];
          for (const word of words) {
            // A range selection outranks note washes: it is the thing the
            // user is doing right now.
            const inRange = !!rangeSelection
              && word.ayahNum >= rangeSelection.start
              && word.ayahNum <= rangeSelection.end;
            /* A saved segment tints the ayat it actually covers, rather than
               being represented by a bar at the page edge that pointed at
               nothing. Translucent and BEHIND the glyphs, so the Arabic and
               the verse markers stay fully legible. Where segments overlap,
               the innermost (last listed) wins the wash and the rest remain
               reachable through the chooser. */
            const covering = segments.filter(
              (sg) => word.ayahNum >= sg.startAyah && word.ayahNum <= sg.endAyah);
            const segWash = covering.length
              ? segTint(covering[covering.length - 1], activeSegmentId)
              : null;
            const wash = inRange
              ? RANGE_WASH
              : selectedEndKey === word.verseKey
              ? AYAH_ACTIVE_WASH
              : segWash
              ?? (notedAyahColors?.get(word.ayahNum) ?? null);
            const prev = runs[runs.length - 1];
            /* Note washes break at every ayah boundary so each ayah reads as
               its own mark. A RANGE deliberately does not — it continues
               across boundaries so a multi-ayah selection is one unbroken
               band rather than a row of adjacent blocks. */
            /* Selections and ranges continue ACROSS ayah boundaries so the
               whole span reads as one region; note washes still break per
               ayah so each stays its own mark. */
            const spanning = inRange || segWash !== null;
            const continues = prev && prev.wash === wash &&
              (wash === null || (spanning && prev.range) || prev.ayahNum === word.ayahNum);
            if (continues) {
              prev!.entries.push(word);
            } else {
              runs.push({ wash, ayahNum: word.ayahNum, entries: [word], range: spanning });
            }
          }

          const renderGlyph = (word: WordEntry) => {
            // Words and ayah markers stay tappable in BOTH modes — tapping one
            // is how you reach its notes, and requiring a trip through the
            // surah menu first only adds a step. Reading Mode differs in what
            // is *shown* (no rail, no ink, no cards), not in what is reachable.
            const isWord  = word.char_type_name === "word";
            const isEnd   = word.char_type_name === "end";
            const wordKey = `${word.ayahNum}:${word.position}`;
            // Word-level note colour sits on top of any ayah run wash.
            const noted = isWord ? notedWordColors?.get(wordKey) : undefined;
            // Yellow selection highlight is ONLY for a specifically
            // selected word — a selected ayah lights up via its run wash.
            const selected =
              isWord && selectedWordKey === `${word.verseKey}:${word.position}`;

            return (
              <span
                key={`${word.verseKey}:${word.position}`}
                ref={(el) => {
                  if (isWord) onRegisterWordRef(word.ayahNum, word.position, el);
                  if (word.isFirstInVerse) onRegisterAyahRef(word.ayahNum, el);
                }}
                className={[
                  "qcf-glyph",
                  isWord ? "qcf-word" : "",
                  isEnd  ? "qcf-end"  : "",
                  noted    ? "qcf-word--noted"    : "",
                  selected ? "qcf-word--selected" : "",
                ].join(" ").trim()}
                // font-family per-span; noted words get their soft
                // translucent highlight colour inline (rotating palette).
                style={{
                  fontFamily: `p${v2page}-v2`,
                  ...(noted ? { background: noted } : {}),
                }}
                title={isWord ? (word.translation?.text ?? "") : undefined}
                role={isWord || isEnd ? "button" : undefined}
                tabIndex={isWord || isEnd ? 0 : undefined}
                onPointerDown={studyMode ? (e) => beginDrag(e, word.ayahNum) : undefined}
                onPointerEnter={studyMode ? (e) => moveDrag(e, word.ayahNum) : undefined}
                onPointerMove={studyMode ? (e) => moveDrag(e, word.ayahNum) : undefined}
                onPointerUp={studyMode ? () => { dragEndedRef.current = finishDrag(); } : undefined}
                onClick={
                  // A click that concluded a drag selected a range; it must not
                  // also open the note of whichever word it happened to end on.
                  isWord
                    ? (e) => {
                        e.stopPropagation();
                        if (dragEndedRef.current) { dragEndedRef.current = false; return; }
                        onOpenFocus(word.verseKey, word.position);
                      }
                    : isEnd
                    ? (e) => {
                        e.stopPropagation();
                        if (dragEndedRef.current) { dragEndedRef.current = false; return; }
                        // An ayah inside a saved Selection opens that Selection
                        // rather than its own note — the highlight IS the
                        // affordance, so clicking it must do what it looks like.
                        const cover = segments.filter(
                          (sg) => word.ayahNum >= sg.startAyah && word.ayahNum <= sg.endAyah);
                        if (cover.length && onSegmentClick) {
                          // Hand over ALL of them: with overlapping Selections
                          // the tap does not identify one, and silently
                          // choosing would open the wrong whiteboard.
                          onSegmentClick(cover.map((c) => c.id));
                          return;
                        }
                        onOpenFocus(word.verseKey, null);
                      }
                    : undefined
                }
                onKeyDown={
                  isWord || isEnd
                    ? (e) => {
                        if (e.key === "Enter") {
                          e.stopPropagation();
                          onOpenFocus(word.verseKey, isWord ? word.position : null);
                        }
                      }
                    : undefined
                }
                // Safe: Quran Foundation API data only — no user input
                dangerouslySetInnerHTML={{ __html: word.code_v2 }}
              />
            );
          };

          return (
            <div key={lineKey} className="qcf-line">
              {runs.map((run, ri) =>
                run.wash ? (
                  <span
                    key={`run-${lineKey}-${ri}`}
                    /* Only the ACTIVE ayah lifts; ayāt merely carrying notes
                       keep their flat wash. A multi-line ayah produces one run
                       per line and they all get the class, so they rise by the
                       same amount and read as a single selection. */
                    className={
                      run.wash === AYAH_ACTIVE_WASH
                        ? "qcf-ayah-run qcf-ayah-run--active"
                        : "qcf-ayah-run"
                    }
                    style={{ background: run.wash }}
                  >
                    {run.entries.map(renderGlyph)}
                  </span>
                ) : (
                  run.entries.map(renderGlyph)
                ),
              )}
            </div>
          );
        })}
      </div>

      {/* ── Page number footer ── */}
      <div className="qcf-page-num" dir="ltr">{pageNumber}</div>
    </div>
  );
}

/* Memoised. The parent re-renders on every viewport change — i.e. every frame
   of a pan or zoom — and without this the whole glyph tree (several hundred
   spans) reconciled each time, which is what made zooming lag. Every prop
   passed from ModeBPage is already stable (useCallback / useMemo), so the
   default shallow comparison holds. */
export default memo(QCFMushafPage);
