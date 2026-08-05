"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, BookMarked } from "lucide-react";
import type { Chapter, Verse } from "@/lib/types";

interface Props {
  chapter: Chapter;
  verses: Verse[];
  onVerseClick: (verseKey: string) => void;
}

export default function MushafPanel({ chapter, verses, onVerseClick }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleVerse = (key: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div
      className="quran-reader scroll"
      style={{ flex: "0 0 420px", borderRight: "1px solid var(--line)" }}
    >
      <div className="quran-reader-inner">
        {/* Surah header */}
        <div style={{ textAlign: "center", padding: "24px 0 16px", borderBottom: "1px solid var(--line)", marginBottom: 8 }}>
          <div style={{ fontFamily: "var(--font-arabic)", fontSize: 26, direction: "rtl", color: "var(--ink)" }}>
            {chapter.name_arabic}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>
            {chapter.name_simple} · {chapter.translated_name.name} · {chapter.verses_count} verses
          </div>
        </div>

        {/* Bismillah */}
        {chapter.bismillah_pre && (
          <div style={{
            fontFamily: "var(--font-arabic)",
            fontSize: 24,
            direction: "rtl",
            textAlign: "center",
            padding: "16px 0",
            borderBottom: "1px solid var(--line)",
            color: "var(--ink-2)",
            marginBottom: 8,
          }}>
            بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
          </div>
        )}

        {verses.map((verse) => {
          const isCollapsed = collapsed.has(verse.verse_key);
          const words = verse.words.filter((w) => w.char_type_name === "word");
          const translation = verse.translations?.[0]?.text ?? "";

          return (
            <div key={verse.id} className="verse-block">
              {/* Verse row header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <button
                  onClick={() => onVerseClick(verse.verse_key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: "none", border: "none", cursor: "pointer",
                    padding: 0,
                  }}
                  title="View tafsir for this verse"
                >
                  <span className="verse-num">{verse.verse_number}</span>
                  <BookMarked size={12} style={{ color: "var(--ink-4)" }} />
                </button>
                <button
                  className="tb-icon"
                  onClick={() => toggleVerse(verse.verse_key)}
                  title={isCollapsed ? "Expand verse" : "Collapse verse"}
                >
                  {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                </button>
              </div>

              {/* Word chips + translation */}
              {!isCollapsed && (
                <>
                  <div className="word-chips">
                    {/* Not a button. These opened a word panel that was never
                        mounted, against an endpoint that does not exist, so
                        every word was a focus stop and a click target that did
                        nothing — a whole verse of them to tab through. */}
                    {words.map((word) => (
                      <div key={word.id} className="word-chip">
                        <span className="word-chip-ar">{word.text}</span>
                        <span className="word-chip-tr">{word.transliteration?.text}</span>
                        <span className="word-chip-en">{word.translation?.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="verse-translation">{translation}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
