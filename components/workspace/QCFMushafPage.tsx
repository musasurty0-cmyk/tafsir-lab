"use client";

/**
 * QCFMushafPage — renders one Mushaf page using Quran Foundation QCF v2 fonts.
 *
 * Rendering approach:
 *   • Each line's words are rendered as adjacent inline <span> elements
 *     inside a direction:rtl block container.
 *   • React array children have NO whitespace text nodes between them,
 *     so the browser treats them as one continuous glyph run — visually
 *     identical to a concatenated string, but each word is individually
 *     clickable.
 *   • The QCF page font (p{N}-v2) handles all glyph shaping and spacing.
 *     No manual justification or flex distribution.
 *
 * Interaction:
 *   • Click word      → onOpenFocus(verseKey, wordPos)
 *   • Click ayah-end  → onOpenFocus(verseKey, null)
 *   • Hover word      → amber highlight via CSS
 *   • Refs registered → onRegisterAyahRef / onRegisterWordRef
 */

import { useEffect, useState } from "react";
import type { QCFVerse, Chapter } from "@/lib/types";

// ── Font loading ────────────────────────────────────────────────────────────

const FONT_CDN   = "https://verses.quran.foundation/fonts/quran/hafs/v2/woff2";
const fontLoaded = new Set<number>();

async function loadQCFFont(pageNum: number): Promise<void> {
  if (fontLoaded.has(pageNum)) return;

  const family = `p${pageNum}-v2`;

  for (const ff of document.fonts.values()) {
    const name = ff.family.replace(/^"|"$/g, "");
    if (name === family && ff.status === "loaded") {
      fontLoaded.add(pageNum);
      return;
    }
  }

  const ff = new FontFace(family, `url(${FONT_CDN}/p${pageNum}.woff2)`);
  ff.display = "block";
  const loaded = await ff.load();
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

// ── Component ───────────────────────────────────────────────────────────────

export default function QCFMushafPage({
  verses, pageNumber, chapter, loading = false,
  cardRef, onRegisterAyahRef, onRegisterWordRef, onOpenFocus,
}: Props) {

  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    if (verses.length === 0) return;

    let cancelled = false;
    setFontReady(false);

    const pageNums = new Set<number>([pageNumber]);
    for (const v of verses) {
      for (const w of v.words) {
        if (w.v2_page) pageNums.add(w.v2_page);
      }
    }

    Promise.all([...pageNums].map((p) => loadQCFFont(p).catch(() => {})))
      .then(() => { if (!cancelled) setFontReady(true); });

    return () => { cancelled = true; };
  }, [pageNumber, verses]);

  // ── Build line map ──────────────────────────────────────────────────────

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

  // ── Surah header ────────────────────────────────────────────────────────

  const showHeader = verses.some((v) => {
    const [sId, vNum] = v.verse_key.split(":").map(Number);
    return sId === chapter.id && vNum === 1;
  });

  // ── Loading skeleton ────────────────────────────────────────────────────

  if (loading) {
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

  // ── Main render ─────────────────────────────────────────────────────────

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
          // All words on a Mushaf line share the same font file
          const v2page     = words[0]?.v2_page ?? pageNumber;
          const fontFamily = fontReady ? `p${v2page}-v2` : "var(--font-arabic)";

          return (
            /*
             * The line container is display:block direction:rtl.
             * Children are display:inline — adjacent with no DOM whitespace
             * between them, so the browser renders them as one continuous
             * right-to-left glyph run.  Visually identical to a concatenated
             * string, but each word span is individually interactive.
             */
            <div key={lineKey} className="qcf-line">
              {words.map((word) => {
                const isWord = word.char_type_name === "word";
                const isEnd  = word.char_type_name === "end";

                // Use QCF glyph once font is ready; Unicode fallback until then
                const glyph = (fontReady && word.code_v2)
                  ? word.code_v2
                  : word.text_qpc_hafs;

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
                    ].join(" ").trim()}
                    style={{ fontFamily }}
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
                    dangerouslySetInnerHTML={{ __html: glyph }}
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
