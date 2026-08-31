"use client";

/**
 * Scrolling the Qurʾān one sūrah at a time.
 *
 * The grid is right for "show me everything" — 114 cards, scan, pick. It is
 * wrong for "walk me through", where you want one thing at a time and the
 * neighbours visible enough to know where you are. This is the other half of
 * that: a single sūrah held in the middle of the screen, its neighbours
 * receding above and below, and one keystroke to move.
 *
 * The list does not scroll. Every sūrah is laid out at a fixed row height and
 * the whole column is translated so the current one sits on the centre line,
 * which is what makes the movement land on exactly one sūrah every time rather
 * than wherever momentum stopped. Wheel gestures are quantised to one step for
 * the same reason: a trackpad flick that jumps eleven sūrahs is precisely the
 * behaviour the grid already has.
 *
 * A finger DRAGS that column directly. Because the list is translated rather
 * than scrolled, there was nothing for touch to grab: no scroll container, and
 * a finger raises no wheel event, so on an iPad the only way through 114
 * sūrahs was tapping the arrow once per sūrah. The drag follows the finger
 * live and then snaps to the nearest row on release — direct to touch, and
 * still landing on exactly one sūrah, which is the whole point of this view.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, LayoutGrid } from "lucide-react";
import type { Chapter } from "@/lib/types";

/** Row height in px. Mirrored in the stylesheet — see .spot-row. */
const ROW = 56;
/** Rows drawn either side of the centre. Enough to place yourself, not a list. */
const WINGS = 3;
/** A wheel gesture quieter than this is drift, not an intent to move. */
const WHEEL_THRESHOLD = 14;

interface Props {
  chapters: Chapter[];
  /** Where to open. Defaults to the first sūrah. */
  initialId?: number;
  onPick: (chapter: Chapter) => void;
  /** Leaving this view. It is the default one, so this goes to the grid. */
  onClose: () => void;
  /** Label for that exit, since "close" is not what it does any more. */
  closeLabel?: string;
}

export default function SurahSpotlight({
  chapters, initialId, onPick, onClose, closeLabel = "Close",
}: Props) {
  const startAt = Math.max(0, chapters.findIndex((c) => c.id === initialId));
  const [i, setI] = useState(startAt === -1 ? 0 : startAt);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const last = chapters.length - 1;
  const move = useCallback((by: number) => {
    setI((n) => Math.min(last, Math.max(0, n + by)));
  }, [last]);

  /* Focus the box on open so the arrow keys work without a click first —
     the whole point of this view is that it is driven from the keyboard. */
  useEffect(() => { boxRef.current?.focus(); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown": e.preventDefault(); move(1); break;
        case "ArrowUp":   e.preventDefault(); move(-1); break;
        case "PageDown":  e.preventDefault(); move(10); break;
        case "PageUp":    e.preventDefault(); move(-10); break;
        case "Home":      e.preventDefault(); setI(0); break;
        case "End":       e.preventDefault(); setI(last); break;
        case "Enter":     e.preventDefault(); onPick(chapters[i]); break;
        case "Escape":    e.preventDefault(); onClose(); break;
        default: return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, last, move, onPick, onClose, chapters]);

  /* Wheel deltas vary wildly between a mouse notch and a trackpad glide, so
     they are accumulated and spent one step at a time rather than mapped to
     distance. */
  const wheelAcc = useRef(0);
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    wheelAcc.current += e.deltaY;
    while (Math.abs(wheelAcc.current) >= WHEEL_THRESHOLD) {
      const dir = wheelAcc.current > 0 ? 1 : -1;
      wheelAcc.current -= dir * WHEEL_THRESHOLD;
      move(dir);
    }
  }

  /* Touch/pen/mouse drag. Pointer events rather than touch events so one
     path serves all three, and `setPointerCapture` keeps the gesture alive
     when the finger leaves the stage mid-drag. */
  const dragFrom = useRef<{ y: number; i: number } | null>(null);
  const dragged  = useRef(false);
  const [dragBy, setDragBy] = useState(0);

  function onPointerDown(e: React.PointerEvent) {
    /* Not the arrows or the open button — they are their own gesture. */
    if ((e.target as HTMLElement).closest("button")) return;
    dragFrom.current = { y: e.clientY, i };
    dragged.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const from = dragFrom.current;
    if (!from) return;
    const dy = e.clientY - from.y;
    /* A few pixels of slack, so a tap that trembles still opens a sūrah
       instead of being read as a drag. */
    if (!dragged.current && Math.abs(dy) < 4) return;
    dragged.current = true;
    /* Clamped to the ends: the column cannot be pulled into empty space,
       which would otherwise leave a blank stage under the centre line. */
    setDragBy(Math.max(-(last - from.i) * ROW, Math.min(from.i * ROW, dy)));
  }

  function endDrag(e: React.PointerEvent) {
    const from = dragFrom.current;
    if (!from) return;
    dragFrom.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    /* Snap to whichever row the finger left nearest the centre line. No
       momentum: this view exists to stop on a chosen sūrah. */
    setI(Math.min(last, Math.max(0, from.i - Math.round(dragBy / ROW))));
    setDragBy(0);
  }

  const current = chapters[i];
  /* Where the column sits right now, in rows — fractional mid-drag. */
  const shown = i - dragBy / ROW;
  if (!current) return null;

  return (
    <div className="spot-scrim" onClick={onClose} role="presentation">
      <div
        className="spot"
        ref={boxRef}
        tabIndex={-1}
        role="listbox"
        aria-label="Scroll through the Qur'an"
        aria-activedescendant={`spot-opt-${current.id}`}
        onClick={(e) => e.stopPropagation()}
        onWheel={onWheel}
      >
        <div className="spot-head">
          <span className="spot-keys">
            Use <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> for the grid
          </span>
          <button type="button" className="spot-alt" onClick={onClose}>
            <LayoutGrid size={14} aria-hidden /> {closeLabel}
          </button>
        </div>

        <p className="spot-count" aria-live="polite">
          Sūrah {current.id} of {chapters.length}
        </p>

        <button
          type="button"
          className="spot-step spot-step--up"
          onClick={() => move(-1)}
          disabled={i === 0}
          aria-label="Previous sūrah"
        >
          <ChevronUp size={18} aria-hidden />
        </button>

        <div
          className="spot-stage"
          style={{ height: ROW * (WINGS * 2 + 1) }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* `top` puts row 0 on the centre line; the transform then slides the
              column so row `i` lands there. Both come from ROW rather than the
              stylesheet so the geometry has a single source. */}
          <div
            className="spot-list"
            style={{
              top: ROW * WINGS,
              transform: `translateY(${-i * ROW + dragBy}px)`,
              /* The eased transition is what makes a keypress land softly;
                 under a finger it would lag behind the touch. */
              transition: dragFrom.current ? "none" : undefined,
            }}
          >
            {chapters.map((ch, n) => {
              /* Measured from where the column actually IS, not from the
                 committed index, so under a finger the dimming and the
                 highlight travel with the drag rather than snapping at the
                 end of it. They agree exactly once dragBy is 0. */
              const away = Math.abs(n - shown);
              /* Rows beyond the wings exist in the DOM but are never seen; not
                 rendering them would make the column jump as it re-windowed. */
              return (
                <div
                  key={ch.id}
                  id={`spot-opt-${ch.id}`}
                  role="option"
                  aria-selected={n === i}
                  className="spot-row"
                  data-current={n === Math.round(shown) ? "true" : "false"}
                  style={{ height: ROW, opacity: away > WINGS ? 0 : 1 - away * 0.26 }}
                  onClick={() => {
                    if (dragged.current) return;   // that was a drag, not a tap
                    return n === i ? onPick(ch) : setI(n);
                  }}
                >
                  <span className="spot-num">{ch.id}</span>
                  <span className="spot-name">{ch.name_simple}</span>
                  <span className="spot-ar">{ch.name_arabic}</span>
                </div>
              );
            })}
          </div>

        </div>

        <button
          type="button"
          className="spot-step spot-step--down"
          onClick={() => move(1)}
          disabled={i === last}
          aria-label="Next sūrah"
        >
          <ChevronDown size={18} aria-hidden />
        </button>

        <button type="button" className="spot-open" onClick={() => onPick(current)}>
          Open {current.name_simple}
        </button>
      </div>
    </div>
  );
}
