"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAppStore } from "@/lib/store";

interface WordDetails {
  text: string;
  transliteration: { text: string };
  translation: { text: string };
}

interface VerseContext {
  text_uthmani: string;
  verse_key: string;
}

export default function WordPanel() {
  const { wordPanel, closeWordPanel } = useAppStore();
  const { wordKey } = wordPanel;
  const open = !!wordKey;

  const [loading, setLoading] = useState(false);
  const [word, setWord] = useState<WordDetails | null>(null);
  const [verse, setVerse] = useState<VerseContext | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!wordKey) return;
    setLoading(true);
    setWord(null);
    setVerse(null);
    // "1:1:1" → "1_1_1"
    const urlKey = wordKey.replace(/:/g, "_");
    fetch(`/api/word/${urlKey}`)
      .then((r) => r.json())
      .then((data) => {
        setWord(data.word ?? null);
        setVerse(data.verse ?? null);
        setNoteContent(data.note?.content ?? "");
      })
      .finally(() => setLoading(false));
  }, [wordKey]);

  const saveNote = async () => {
    if (!wordKey) return;
    setSaving(true);
    const urlKey = wordKey.replace(/:/g, "_");
    await fetch(`/api/word/${urlKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: noteContent }),
    });
    setTimeout(() => setSaving(false), 700);
  };

  return (
    <div className="word-panel" data-open={open ? "true" : "false"} style={{ zIndex: 50 }}>
      <div className="word-panel-head">
        <button className="tb-icon" onClick={closeWordPanel} title="Close">
          <X size={16} />
        </button>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Word Study</div>
      </div>

      <div className="word-panel-body scroll">
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-4)", fontSize: 13 }}>
            Loading…
          </div>
        )}

        {!loading && word && (
          <>
            <div className="word-panel-arabic">{word.text}</div>
            <div className="word-panel-translit">{word.transliteration?.text}</div>
            <div className="word-panel-meaning">{word.translation?.text}</div>

            {verse && (
              <>
                <div className="word-panel-section" style={{ marginTop: 20 }}>Verse Context</div>
                <div style={{
                  fontFamily: "var(--font-arabic)",
                  fontSize: 18,
                  direction: "rtl",
                  textAlign: "right",
                  lineHeight: 2,
                  padding: "12px 16px",
                  background: "var(--panel)",
                  borderRadius: "var(--radius)",
                  color: "var(--ink-2)",
                  marginBottom: 20,
                }}>
                  {verse.text_uthmani}
                </div>
              </>
            )}

            <div className="word-panel-section">Notes</div>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write notes about this word…"
              style={{
                width: "100%",
                minHeight: 120,
                padding: "10px 12px",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                background: "var(--bg-elev)",
                color: "var(--ink)",
                fontSize: 13,
                fontFamily: "inherit",
                lineHeight: 1.7,
                resize: "vertical",
                outline: "none",
              }}
            />
            <button
              onClick={saveNote}
              style={{
                marginTop: 8,
                padding: "6px 18px",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {saving ? "Saving…" : "Save Note"}
            </button>
          </>
        )}

        {!loading && !word && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--ink-4)", fontSize: 13 }}>
            Click any Arabic word to study it.
          </div>
        )}
      </div>
    </div>
  );
}
