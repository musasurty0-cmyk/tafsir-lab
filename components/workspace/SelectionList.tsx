"use client";

/**
 * The saved-Selection browser, opened with Ctrl+X from the Mushaf.
 *
 * Lists Selections for the current surah by verse range, since that is how
 * they are found — a reader remembers "the bit near the end", not the name
 * they chose weeks ago. The name sits alongside as the reminder.
 *
 * Contains Selections only. Connections are a different object with a
 * different browser; mixing them would make this list unusable for either.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface SelectionRow {
  id: string;
  title: string;
  startAyah: number;
  endAyah: number;
  color?: string | null;
}

interface Props {
  rows: SelectionRow[];
  surahName: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}

const ARROW = "–";

export default function SelectionList({ rows, surahName, onOpen, onClose }: Props) {
  const [q, setQ]         = useState("");
  const [active, setActive] = useState(0);
  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef  = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [onClose]);

  /** Search by name, by a single verse number, or by a range. */
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;

    // "3-5" or "3–5" → ranges overlapping it; "4" → ranges containing it.
    const asRange = query.match(/^(\d{1,3})\s*[-–—:]\s*(\d{1,3})$/);
    if (asRange) {
      const a = Number(asRange[1]), b = Number(asRange[2]);
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return rows.filter((r) => r.startAyah <= hi && r.endAyah >= lo);
    }
    const asNum = query.match(/^\d{1,3}$/);
    if (asNum) {
      const n = Number(asNum[0]);
      return rows.filter((r) => n >= r.startAyah && n <= r.endAyah);
    }
    return rows.filter((r) => (r.title || "").toLowerCase().includes(query));
  }, [rows, q]);

  // Default order is Qurʾānic order, which is how the page reads.
  const ordered = useMemo(
    () => [...filtered].sort((a, b) => a.startAyah - b.startAyah || a.endAyah - b.endAyah),
    [filtered],
  );

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown")    { e.preventDefault(); setActive((i) => Math.min(i + 1, ordered.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter")   { e.preventDefault(); const r = ordered[active]; if (r) onOpen(r.id); }
  }, [ordered, active, onOpen]);

  return (
    <div className="sellist-scrim">
      <div className="sellist" ref={ref} role="dialog" aria-modal="true" aria-label="Selections">
        <div className="sellist-head">Selections</div>
        <input
          ref={inputRef}
          className="sellist-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search by name or verse…"
          dir="auto"
          aria-label="Search Selections"
        />
        <div className="sellist-rows" ref={listRef}>
          {ordered.length === 0 && (
            <div className="sellist-empty">
              {rows.length === 0
                ? "No Selections in this Surah yet"
                : "No Selection matches"}
            </div>
          )}
          {ordered.map((r, i) => (
            <button
              key={r.id}
              type="button"
              data-idx={i}
              className="sellist-row"
              data-active={i === active ? "true" : "false"}
              onMouseEnter={() => setActive(i)}
              onClick={() => onOpen(r.id)}
            >
              <span
                className="sellist-dot"
                style={{ background: r.color || "var(--accent)" }}
                aria-hidden
              />
              <span className="sellist-text">
                <span className="sellist-range">
                  {surahName} {r.startAyah}
                  {r.startAyah !== r.endAyah && <>{ARROW}{r.endAyah}</>}
                </span>
                <span className="sellist-name">{r.title || "Unnamed Selection"}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
