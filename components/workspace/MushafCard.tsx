"use client";

/**
 * MushafCard — flowing Mushaf Arabic text block for Mode B.
 *
 * Word interaction:
 *   Click any Arabic word     → calls onOpenFocus(verseKey, wordPos) immediately
 *   Click ﴿١﴾ ayah-end marker → calls onOpenFocus(verseKey, null) immediately
 *
 * Both open FocusAnnotation — a full-screen drawing canvas where the user
 * can annotate the focused word/ayah with freehand strokes.
 * No intermediate popup is shown.
 */

import { useCallback } from "react";
import type { Verse } from "@/lib/types";

// ── Props ──────────────────────────────────────────────────────────────────

interface Props {
  verses:            Verse[];
  cardRef:           React.RefObject<HTMLDivElement | null>;
  onRegisterAyahRef: (ayahNum: number, el: HTMLElement | null) => void;
  onRegisterWordRef: (ayahNum: number, wordPos: number, el: HTMLElement | null) => void;
  /** Called immediately on word/ayah click — no popup shown. */
  onOpenFocus:       (verseKey: string, wordPos: number | null) => void;
}

// ── Component ─────────────────────────────────────────────────────────────

export default function MushafCard({
  verses, cardRef,
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
    <div
      ref={cardRef}
      className="mushaf-card"
      onMouseDown={(e) => e.stopPropagation()}
    >
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
                      ﴿{ayahNum}﴾{" "}
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
    </div>
  );
}
