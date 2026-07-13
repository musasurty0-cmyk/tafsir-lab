"use client";

/**
 * TafsirVersePicker — small popover shown when a tafsir slash command is
 * chosen WITHOUT a verse key (e.g. "/tabari"). The surah is fixed to the one
 * being studied; the user only picks the āyah. Choosing a different surah is
 * done by typing the full key in the command itself ("/tabari 23:2").
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  surah:       number;
  sourceName:  string;
  /** Anchor rect of the "/" caret, for positioning. */
  rect:        DOMRect;
  /** Āyah numbers present on the current page (quick-pick chips). */
  ayahsOnPage: number[];
  onConfirm:   (verseKey: string) => void;
  onCancel:    () => void;
}

export default function TafsirVersePicker({
  surah, sourceName, rect, ayahsOnPage, onConfirm, onCancel,
}: Props) {
  const [ayah, setAyah] = useState(String(ayahsOnPage[0] ?? 1));
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // Tap-outside dismiss
  useEffect(() => {
    function onDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onCancel();
    }
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onCancel]);

  function confirm() {
    const n = parseInt(ayah, 10);
    if (Number.isFinite(n) && n >= 1) onConfirm(`${surah}:${n}`);
  }

  // Position: below the caret, clamped on-screen (visualViewport-aware).
  const MIN_W = 300;
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  const visBottom = vv ? vv.offsetTop + vv.height : (typeof window !== "undefined" ? window.innerHeight : 800);
  const vw = vv ? vv.offsetLeft + vv.width : (typeof window !== "undefined" ? window.innerWidth : 1200);
  const left = Math.max(8, Math.min(rect.left, vw - MIN_W - 12));
  const openUp = (visBottom - rect.bottom) < 220;
  const pos: React.CSSProperties = openUp
    ? { position: "fixed", bottom: (typeof window !== "undefined" ? window.innerHeight : 800) - rect.top + 6, left, zIndex: 9999 }
    : { position: "fixed", top: rect.bottom + 6, left, zIndex: 9999 };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div ref={rootRef} className="verse-picker" style={pos}>
      <div className="verse-picker-head">{sourceName} — pick a verse</div>
      <div className="verse-picker-row">
        <span className="verse-picker-surah">{surah}:</span>
        <input
          ref={inputRef}
          className="verse-picker-input"
          inputMode="numeric"
          value={ayah}
          onChange={(e) => setAyah(e.target.value.replace(/[^0-9]/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Enter")  { e.preventDefault(); confirm(); }
            if (e.key === "Escape") { e.preventDefault(); onCancel(); }
          }}
          placeholder="āyah #"
        />
        <button
          className="verse-picker-go"
          onMouseDown={(e) => { e.preventDefault(); confirm(); }}
        >
          Insert →
        </button>
      </div>
      {ayahsOnPage.length > 0 && (
        <>
          <div className="verse-picker-label">On this page</div>
          <div className="verse-picker-chips">
            {ayahsOnPage.map((a) => (
              <button
                key={a}
                className="verse-picker-chip"
                onMouseDown={(e) => { e.preventDefault(); onConfirm(`${surah}:${a}`); }}
              >
                {surah}:{a}
              </button>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
