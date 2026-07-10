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

import { useCallback, useEffect, useState } from "react";
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

export default function QCFMushafPage({
  verses, pageNumber, chapter, loading = false,
  cardRef, onRegisterAyahRef, onRegisterWordRef, onOpenFocus,
  notedWordColors,
  selectedWordKey,
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

  // ── Build line map ────────────────────────────────────────────────────────

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

  const sortedLines = [...lineMap.entries()].sort(([a], [b]) => a - b);

  const showHeader = verses.some((v) => {
    const [sId, vNum] = v.verse_key.split(":").map(Number);
    return sId === chapter.id && vNum === 1;
  });

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
      dir="rtl"
    >
      {/* ── Surah header ── */}
      {showHeader && (
        <div className="qcf-surah-header">
          <div className="qcf-surah-ornament">
            <span className="qcf-surah-name">{chapter.name_arabic}</span>
          </div>
          {chapter.bismillah_pre && (
            <div className="qcf-basmala">
              بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ
            </div>
          )}
        </div>
      )}

      {/* ── Page lines ── */}
      <div className="qcf-lines">
        {sortedLines.map(([lineKey, words]) => {
          // All words on a Mushaf line share the same v2_page font.
          // We only reach here after fontReady=true, so the font IS loaded.
          const v2page = words[0]?.v2_page ?? pageNumber;

          return (
            <div key={lineKey} className="qcf-line">
              {words.map((word) => {
                const isWord  = word.char_type_name === "word";
                const isEnd   = word.char_type_name === "end";
                const wordKey = `${word.ayahNum}:${word.position}`;
                const noted   = isWord ? notedWordColors?.get(wordKey) : undefined;
                const selected = isWord && selectedWordKey === `${word.verseKey}:${word.position}`;

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
                    onClick={
                      isWord
                        ? (e) => { e.stopPropagation(); onOpenFocus(word.verseKey, word.position); }
                        : isEnd
                        ? (e) => { e.stopPropagation(); onOpenFocus(word.verseKey, null); }
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
              })}
            </div>
          );
        })}
      </div>

      {/* ── Page number footer ── */}
      <div className="qcf-page-num" dir="ltr">{pageNumber}</div>
    </div>
  );
}
