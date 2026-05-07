"use client";

/**
 * QCFMushafPage — renders one Mushaf page using Quran Foundation QCF v2 fonts.
 *
 * Visual model: Quran.com page mode.
 *
 * How QCF rendering works:
 *   • Each page (1–604) has a dedicated font file at:
 *       https://verses.quran.foundation/fonts/quran/hafs/v2/woff2/p{N}.woff2
 *   • The font family name is  p{N}-v2  (e.g. "p2-v2").
 *   • Each word's  code_v2  field is a short glyph-mapped string.
 *     When rendered inside a <span> styled with that font, the browser
 *     resolves the glyphs to the correct, beautifully-typeset Arabic.
 *   • Words are grouped by  line_number  and rendered as RTL flex rows
 *     with space-between so every line fills the full page width —
 *     identical to how Quran.com achieves the justified, printed-Quran look.
 *   • While the font is loading we fall back to  text_qpc_hafs  rendered
 *     with Amiri Quran (already loaded in the app).
 *
 * Interactions (identical to MushafCard):
 *   Click word      → onOpenFocus(verseKey, wordPos)
 *   Click ayah-end  → onOpenFocus(verseKey, null)
 *   Refs registered → onRegisterAyahRef / onRegisterWordRef
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { QCFVerse, Chapter } from "@/lib/types";

// ── Font loading ────────────────────────────────────────────────────────────

const FONT_CDN   = "https://verses.quran.foundation/fonts/quran/hafs/v2/woff2";
const fontLoaded = new Set<number>();          // module-level cache across renders

async function loadQCFFont(pageNum: number): Promise<void> {
  if (fontLoaded.has(pageNum)) return;

  const family = `p${pageNum}-v2`;

  // Check if the browser already has this font registered (hot reload, etc.)
  for (const ff of document.fonts.values()) {
    const name = ff.family.replace(/^"|"$/g, ""); // strip quotes Chrome adds
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

// ── Word entry type (word + verse metadata collapsed for line grouping) ─────

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

  // Load all unique page-font files required by words on this page.
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

    Promise.all([...pageNums].map((p) => loadQCFFont(p).catch(() => {/* non-fatal */})))
      .then(() => { if (!cancelled) setFontReady(true); });

    return () => { cancelled = true; };
  }, [pageNumber, verses]);

  // ── Build line map ──────────────────────────────────────────────────────

  const lineMap = new Map<number, WordEntry[]>();
  let lineCounter = 0; // fallback line key when line_number absent

  for (const verse of verses) {
    let firstInVerse = true;
    for (const word of verse.words) {
      // When line_number is present use it; otherwise each verse is its own line
      const lineKey = (word.line_number != null)
        ? word.line_number
        : --lineCounter; // unique negative key per verse

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

  // ── Surah header: show when verse 1 of this chapter appears on the page ──
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

      {/* ── Page text (line by line) ── */}
      <div className="qcf-lines">
        {sortedLines.map(([lineKey, words]) => {
          const isSingleWord = words.length === 1;
          return (
            <div
              key={lineKey}
              className="qcf-line"
              data-single={isSingleWord ? "true" : undefined}
            >
              {words.map((word) => {
                const isWord = word.char_type_name === "word";
                const isEnd  = word.char_type_name === "end";

                const fontFamily = fontReady
                  ? `p${word.v2_page}-v2`
                  : "var(--font-arabic)";

                // Use glyph code once font is ready; Unicode fallback until then.
                const glyphText = (fontReady && word.code_v2)
                  ? word.code_v2
                  : word.text_qpc_hafs;

                return (
                  <span
                    key={`${word.verseKey}:${word.position}`}
                    ref={(el) => {
                      // Register word ref for all words
                      if (isWord) onRegisterWordRef(word.ayahNum, word.position, el);
                      // The first word of each verse acts as the ayah anchor
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
                    // Safe: data from Quran Foundation API only (no user input)
                    dangerouslySetInnerHTML={{ __html: glyphText }}
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
