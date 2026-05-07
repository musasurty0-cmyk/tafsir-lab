"use client";

/**
 * MushafCard — continuous Mushaf page display for Mode B.
 *
 * Layout mirrors a printed Quran page:
 *   • Surah header: Arabic name badge + basmala (if bismillah_pre)
 *   • All verses flow inline as one continuous RTL block, fully justified
 *   • Ayah-end markers use U+06DD (Arabic End of Ayah) + Arabic-Indic digits
 *     so Amiri Quran renders the authentic ornamental roundel
 *
 * Interaction:
 *   Click any Arabic word  → onOpenFocus(verseKey, wordPos)
 *   Click ‎ ayah-end marker → onOpenFocus(verseKey, null)
 */

import { useCallback } from "react";
import type { Verse, Chapter } from "@/lib/types";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert a western integer to Arabic-Indic digit string (٠١٢٣…). */
function toArabicIndic(n: number): string {
  return String(n)
    .split("")
    .map((d) => String.fromCharCode(0x0660 + parseInt(d)))
    .join("");
}

// Props ──────────────────────────────────────────────────────────────────────

interface Props {
  verses:            Verse[];
  chapter:           Chapter;
  pageNumber?:       number;   // Mushaf page number shown in footer
  cardRef:           React.RefObject<HTMLDivElement | null>;
  onRegisterAyahRef: (ayahNum: number, el: HTMLElement | null) => void;
  onRegisterWordRef: (ayahNum: number, wordPos: number, el: HTMLElement | null) => void;
  /** Called immediately on word/ayah click — no popup shown. */
  onOpenFocus:       (verseKey: string, wordPos: number | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function MushafCard({
  verses, chapter, pageNumber, cardRef,
  onRegisterAyahRef, onRegisterWordRef,
  onOpenFocus,
}: Props) {
  const handleWordClick = useCallback(
    (e: React.MouseEvent, ayahNum: number, wordPos: number, verseKey: string) => {
      e.stopPropagation();
      onOpenFocus(verseKey, wordPos);
    },
    [onOpenFocus],
  );

  const handleAyahEndClick = useCallback(
    (e: React.MouseEvent, verseKey: string) => {
      e.stopPropagation();
      onOpenFocus(verseKey, null);
    },
    [onOpenFocus],
  );

  return (
    <div ref={cardRef} className="mushaf-card" onMouseDown={(e) => e.stopPropagation()}>

      {/* ── Surah header ── */}
      <div className="mushaf-surah-header">
        {/* Arabic name badge */}
        <span className="mushaf-surah-name" dir="rtl">{chapter.name_arabic}</span>

        {/* Basmala — shown for every surah except At-Tawbah (surah 9) */}
        {chapter.bismillah_pre && (
          <div className="mushaf-basmala" dir="rtl">
            بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ
          </div>
        )}
      </div>

      {/* ── Continuous flowing text ── */}
      <div className="mushaf-text" dir="rtl">
        {verses.map((verse) => {
          const ayahNum = Number(verse.verse_key.split(":")[1]);

          return (
            <span key={verse.verse_key} className="mushaf-verse">
              {/* Invisible anchor for the note anchor engine */}
              <span
                ref={(el) => onRegisterAyahRef(ayahNum, el)}
                className="mushaf-ayah-anchor"
                aria-hidden="true"
              />

              {verse.words.map((word) => {
                if (word.char_type_name === "word") {
                  return (
                    <span
                      key={`${verse.verse_key}:${word.position}`}
                      ref={(el) => onRegisterWordRef(ayahNum, word.position, el)}
                      className="mushaf-word"
                      title={word.translation?.text ?? ""}
                      onClick={(e) => handleWordClick(e, ayahNum, word.position, verse.verse_key)}
                    >
                      {word.text}{" "}
                    </span>
                  );
                }

                if (word.char_type_name === "end") {
                  return (
                    <span
                      key={`end-${verse.verse_key}`}
                      className="mushaf-ayah-end"
                      title={`Ayah ${ayahNum} — click to annotate`}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleAyahEndClick(e, verse.verse_key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAyahEndClick(e as unknown as React.MouseEvent, verse.verse_key);
                      }}
                      aria-label={`End of ayah ${ayahNum}`}
                    >
                      {/* U+06DD + Arabic-Indic digits → Amiri Quran renders the
                          authentic ornamental ayah-end roundel automatically */}
                      {"۝"}{toArabicIndic(ayahNum)}{" "}
                    </span>
                  );
                }

                return (
                  <span key={`tok-${verse.verse_key}:${word.position}`} className="mushaf-token">
                    {word.text}{" "}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>

      {/* ── Page number footer ── */}
      {pageNumber !== undefined && (
        <div className="mushaf-page-number">
          {pageNumber}
        </div>
      )}
    </div>
  );
}
