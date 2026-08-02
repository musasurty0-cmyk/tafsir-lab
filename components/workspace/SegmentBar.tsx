"use client";

/**
 * SegmentBar — the contextual toolbar for a selected āyah range, and the
 * inline form for turning that range into a Segment.
 *
 * Deliberately a compact popover rather than a modal: the selection it acts on
 * is on the page behind it, and a modal would cover the very thing being
 * named. The Mushaf stays visible and the range stays highlighted throughout.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface Range { start: number; end: number }

/** Colours a segment marker can take. Kept to the existing note palette so
 *  segments do not introduce a second colour language. */
const SEGMENT_COLORS = [
  { label: "Green",  value: "oklch(0.55 0.11 155)" },
  { label: "Amber",  value: "oklch(0.62 0.11 70)"  },
  { label: "Violet", value: "oklch(0.52 0.14 290)" },
  { label: "Blue",   value: "oklch(0.52 0.15 240)" },
  { label: "Rose",   value: "oklch(0.55 0.15 15)"  },
];

interface Props {
  range: Range;
  surahName: string;
  /** Viewport position to anchor to — normally the end of the selection. */
  at: { x: number; y: number };
  busy?: boolean;
  onCreate: (input: { title: string; description?: string; color?: string }) => void;
  onDismiss: () => void;
}

export default function SegmentBar({
  range, surahName, at, busy = false,
  onCreate, onDismiss,
}: Props) {
  const [mode, setMode]   = useState<"bar" | "form">("bar");
  const [title, setTitle] = useState("");
  const [desc, setDesc]   = useState("");
  const [color, setColor] = useState<string | undefined>();
  const wrapRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (mode === "form") inputRef.current?.focus(); }, [mode]);

  // Escape backs out one level rather than dismissing everything, so an
  // accidental "Create segment" does not throw the selection away too.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (mode === "form") setMode("bar");
      else onDismiss();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [mode, onDismiss]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onDismiss();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [onDismiss]);

  const submit = useCallback(() => {
    if (busy) return;
    onCreate({
      // An empty name is allowed; the service falls back to the range itself,
      // so a user who just wants the grouping is not forced to invent a title.
      title: title.trim(),
      description: desc.trim() || undefined,
      color,
    });
  }, [busy, title, desc, color, onCreate]);

  const label = range.start === range.end
    ? `${surahName} ${range.start}`
    : `${surahName} ${range.start}–${range.end}`;

  return (
    <div
      ref={wrapRef}
      className="segbar"
      style={{ top: at.y, left: at.x }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="segbar-range">{label}</div>

      {mode === "bar" ? (
        <div className="segbar-actions">
          {/* One action only. Add note, Tafsīr and Copy were a menu of
              unrelated study actions attached to a gesture that means one
              thing: "these verses belong together". */}
          <button className="segbar-btn segbar-btn--primary" onClick={() => setMode("form")}>
            Create Selection
          </button>
        </div>
      ) : (
        <form
          className="segbar-form"
          onSubmit={(e) => { e.preventDefault(); submit(); }}
        >
          <input
            ref={inputRef}
            className="segbar-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Selection name"
            dir="auto"
            maxLength={120}
          />
          <textarea
            className="segbar-textarea"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description (optional)"
            dir="auto"
            rows={2}
            maxLength={500}
          />
          <div className="segbar-colors" role="group" aria-label="Selection colour">
            {SEGMENT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                className="segbar-color"
                data-active={color === c.value ? "true" : "false"}
                style={{ background: c.value }}
                title={c.label}
                onClick={() => setColor((v) => (v === c.value ? undefined : c.value))}
              />
            ))}
          </div>
          <div className="segbar-form-actions">
            <button type="button" className="segbar-btn" onClick={() => setMode("bar")}>
              Back
            </button>
            <button type="submit" className="segbar-btn segbar-btn--primary" disabled={busy}>
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
