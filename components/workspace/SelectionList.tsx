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
  /** Heading. Overridden when this is disambiguating a tap on overlaps. */
  title?: string;
  onOpen: (id: string) => void;
  onClose: () => void;
  /** Management. Omitted by the overlap chooser, which is only a question. */
  onRename?:  (id: string, name: string) => void;
  onRecolour?: (id: string, color: string) => void;
  onDelete?:  (id: string) => void;
}

/** Same family as the note palette and the in-session picker. */
const COLORS = [
  "oklch(0.55 0.11 155)",
  "oklch(0.62 0.11 70)",
  "oklch(0.52 0.14 290)",
  "oklch(0.52 0.15 240)",
  "oklch(0.55 0.15 15)",
];

const ARROW = "–";

export default function SelectionList({
  rows, surahName, title = "Selections", onOpen, onClose,
  onRename, onRecolour, onDelete,
}: Props) {
  /* Which row is being managed, and whether it is confirming deletion.
     Editing happens INSIDE the row so the list never navigates away from
     what the user is looking at. */
  const [editing,  setEditing]  = useState<string | null>(null);
  const [draft,    setDraft]    = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const manageable = !!(onRename || onRecolour || onDelete);
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
        <div className="sellist-head">{title}</div>
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
            <div key={r.id} className="sellist-item">
              <button
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
                {manageable && (
                  <span
                    className="sellist-edit"
                    role="button"
                    tabIndex={0}
                    title="Edit this Selection"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing((v) => (v === r.id ? null : r.id));
                      setDraft(r.title || "");
                      setDeleting(null);
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setEditing(r.id); setDraft(r.title || ""); } }}
                  >
                    ⋯
                  </span>
                )}
              </button>

              {editing === r.id && (
                <div className="sellist-manage">
                  {deleting === r.id ? (
                    <div className="sellist-confirm">
                      <span>Delete this Selection and its whiteboard?</span>
                      <div className="sellist-confirm-actions">
                        <button className="sellist-mini" onClick={() => setDeleting(null)}>Keep</button>
                        <button
                          className="sellist-mini sellist-mini--danger"
                          onClick={() => { onDelete?.(r.id); setDeleting(null); setEditing(null); }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <input
                        className="sellist-rename"
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter" && draft.trim()) {
                            onRename?.(r.id, draft.trim());
                            setEditing(null);
                          }
                        }}
                        placeholder="Selection name"
                        dir="auto"
                        aria-label="Rename Selection"
                      />
                      <div className="sellist-swatches">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            className="sellist-swatch"
                            style={{ background: c }}
                            data-active={r.color === c ? "true" : "false"}
                            onClick={() => onRecolour?.(r.id, c)}
                            title="Colour"
                          />
                        ))}
                        <button
                          className="sellist-mini sellist-mini--danger"
                          onClick={() => setDeleting(r.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
