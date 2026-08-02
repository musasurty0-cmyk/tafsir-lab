"use client";

/**
 * The two decision points in a Selection's life.
 *
 * OpenSelectionPrompt — shown the moment a verse range is committed. It asks
 * one question and offers two answers, because that is the only decision at
 * that point. Naming, colour and description all belong later: the user has
 * not seen the verses in a study surface yet, so asking them to name the thing
 * first is asking before they know.
 *
 * NameSelectionPrompt — shown when a NEW Selection is closed for the first
 * time. By then the work exists, so naming it is a summary rather than a
 * guess. Existing Selections never see this screen again.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface Range { start: number; end: number }

const ARROW = "–"; // en dash, for verse ranges

/* ── Open? ─────────────────────────────────────────────────────────────── */

export function OpenSelectionPrompt({
  range, surahName, busy = false, onCancel, onOpen,
}: {
  range: Range; surahName: string; busy?: boolean;
  onCancel: () => void; onOpen: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCancel(); }
      if (e.key === "Enter")  { e.preventDefault(); e.stopPropagation(); onOpen(); }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCancel();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onCancel, onOpen]);

  const verses = range.start === range.end
    ? `Āyah ${range.start}`
    : `Āyāt ${range.start}${ARROW}${range.end}`;

  return (
    <div className="seldlg-scrim">
      <div className="seldlg" ref={ref} role="dialog" aria-modal="true">
        <h2 className="seldlg-title">Open these verses as a Selection?</h2>
        <div className="seldlg-context">
          <div className="seldlg-surah">Surah {surahName}</div>
          <div className="seldlg-range">{verses}</div>
        </div>
        <p className="seldlg-note">
          A Selection gives these verses their own study space. You can name it when you close it.
        </p>
        <div className="seldlg-actions">
          <button className="seldlg-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="seldlg-btn seldlg-btn--primary" onClick={onOpen} disabled={busy}>
            {busy ? "Opening…" : "Open Selection"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Name it ───────────────────────────────────────────────────────────── */

export function NameSelectionPrompt({
  range, surahName, busy = false, onBack, onSave, onDiscard,
}: {
  range: Range; surahName: string; busy?: boolean;
  onBack: () => void;
  onSave: (name: string) => void;
  onDiscard: () => void;
}) {
  const [name, setName]       = useState("");
  const [confirming, setConf] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  /* Escape returns to the whiteboard rather than closing. Closing here would
     be the one path that loses work, so it is not reachable by accident. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault(); e.stopPropagation();
      if (confirming) setConf(false); else onBack();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onBack, confirming]);

  const save = useCallback(() => {
    const n = name.trim();
    if (!n || busy) return;
    onSave(n);
  }, [name, busy, onSave]);

  const verses = range.start === range.end
    ? `${range.start}` : `${range.start}${ARROW}${range.end}`;

  return (
    <div className="seldlg-scrim">
      <div className="seldlg" role="dialog" aria-modal="true">
        {confirming ? (
          <>
            <h2 className="seldlg-title">Discard this Selection?</h2>
            <p className="seldlg-note">
              Everything on its whiteboard will be lost. This cannot be undone.
            </p>
            <div className="seldlg-actions">
              <button className="seldlg-btn" onClick={() => setConf(false)}>Keep editing</button>
              <button className="seldlg-btn seldlg-btn--danger" onClick={onDiscard}>
                Discard
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="seldlg-title">Name this Selection</h2>
            <div className="seldlg-context">
              <div className="seldlg-surah">Surah {surahName}</div>
              <div className="seldlg-range">Āyāt {verses}</div>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); save(); }}>
              <input
                ref={inputRef}
                className="seldlg-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Āyāt of hope"
                dir="auto"
                maxLength={120}
                aria-label="Selection name"
              />
              <div className="seldlg-actions">
                <button type="button" className="seldlg-btn" onClick={onBack} disabled={busy}>
                  Back to Selection
                </button>
                <button
                  type="submit"
                  className="seldlg-btn seldlg-btn--primary"
                  disabled={busy || !name.trim()}
                >
                  {busy ? "Saving…" : "Save and Close"}
                </button>
              </div>
            </form>
            <button className="seldlg-discard" onClick={() => setConf(true)} disabled={busy}>
              Discard instead
            </button>
          </>
        )}
      </div>
    </div>
  );
}
