"use client";

import { Tldraw } from "tldraw";
import "tldraw/tldraw.css";
import { useState } from "react";
import { ChevronLeft, ChevronRight, BookMarked } from "lucide-react";
import type { Chapter, Verse } from "@/lib/types";

interface Props {
  chapter: Chapter;
  verses: Verse[];
  onVerseClick: (verseKey: string) => void;
}

export default function TldrawCanvas({ chapter, verses, onVerseClick }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [panelOpen, setPanelOpen] = useState(true);

  const toggleVerse = (key: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* tldraw fills the canvas area */}
      <Tldraw inferDarkMode />

      {/* Floating Mushaf panel overlaid on the canvas */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: panelOpen ? 380 : 40,
          background: "var(--bg-elev)",
          borderRight: "1px solid var(--line-strong)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.2s ease",
          zIndex: 200,
          overflow: "hidden",
          boxShadow: "2px 0 12px rgba(0,0,0,0.08)",
        }}
      >
        {/* Panel toggle handle */}
        <button
          onClick={() => setPanelOpen((o) => !o)}
          style={{
            position: "absolute",
            right: -12,
            top: "50%",
            transform: "translateY(-50%)",
            width: 24,
            height: 48,
            background: "var(--bg-elev)",
            border: "1px solid var(--line-strong)",
            borderRadius: "0 6px 6px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "var(--ink-3)",
            zIndex: 201,
          }}
          title={panelOpen ? "Hide Mushaf" : "Show Mushaf"}
        >
          {panelOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {panelOpen && (
          <>
            {/* Panel header */}
            <div style={{
              padding: "10px 14px",
              borderBottom: "1px solid var(--line)",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}>
              <div style={{ fontFamily: "var(--font-arabic)", fontSize: 18, direction: "rtl", color: "var(--ink)" }}>
                {chapter.name_arabic}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {chapter.name_simple}
              </div>
            </div>

            {/* Scrollable verse list */}
            <div
              className="scroll"
              style={{ flex: 1, padding: "8px 14px", overflowY: "auto" }}
            >
              {chapter.bismillah_pre && (
                <div style={{
                  fontFamily: "var(--font-arabic)",
                  fontSize: 18,
                  direction: "rtl",
                  textAlign: "center",
                  padding: "10px 0",
                  borderBottom: "1px solid var(--line)",
                  marginBottom: 6,
                  color: "var(--ink-2)",
                }}>
                  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                </div>
              )}

              {verses.map((verse) => {
                const isCollapsed = collapsed.has(verse.verse_key);
                const words = verse.words.filter((w) => w.char_type_name === "word");
                const translation = verse.translations?.[0]?.text ?? "";

                return (
                  <div
                    key={verse.id}
                    style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <button
                        onClick={() => onVerseClick(verse.verse_key)}
                        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        title="View tafsir"
                      >
                        <span className="verse-num" style={{ width: 20, height: 20, fontSize: 10 }}>
                          {verse.verse_number}
                        </span>
                        <BookMarked size={11} style={{ color: "var(--ink-4)" }} />
                      </button>
                      <button
                        className="tb-icon"
                        onClick={() => toggleVerse(verse.verse_key)}
                        style={{ width: 24, height: 24 }}
                      >
                        {isCollapsed ? "▼" : "▲"}
                      </button>
                    </div>

                    {!isCollapsed && (
                      <>
                        <div className="word-chips" style={{ gap: 4 }}>
                          {words.map((word) => (
                            <div
                              key={word.id}
                              className="word-chip"
                              style={{ padding: "4px 7px" }}
                            >
                              <span className="word-chip-ar" style={{ fontSize: 17 }}>{word.text}</span>
                              <span className="word-chip-tr" style={{ fontSize: 10 }}>{word.transliteration?.text}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.6, marginTop: 6 }}>
                          {translation}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
