"use client";

/**
 * Scrolling the Qurʾān one sūrah at a time.
 *
 * The grid is right for "show me everything" — 114 cards, scan, pick. It is
 * wrong for "walk me through", where you want one thing at a time and the
 * neighbours visible enough to know where you are. This is the other half of
 * that: a single sūrah held in the middle of the screen, its neighbours
 * receding above and below.
 *
 * It FLICKS. A finger throws the column and it carries on under its own
 * momentum, decelerating, travelling as far as the throw deserves — then
 * settles on whichever sūrah it came to rest nearest. This used to snap one
 * row per gesture, which read as a list that fought you when what the hand
 * expects from a column of names is a wheel that spins.
 *
 * The position is a CONTINUOUS row offset, driven imperatively — one
 * transform write per frame — rather than through React state. Rendering a
 * fractional position through state would reconcile all 114 rows every frame
 * of a flick; the committed index reaches React only when the motion settles,
 * so a spin costs one style write per frame and nothing else. The fade of the
 * neighbours is a CSS mask for the same reason: it was a per-row opacity
 * computed from the centre, which does not survive a position that changes
 * sixty times a second.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronUp, ChevronDown, LayoutGrid } from "lucide-react";
import type { Chapter } from "@/lib/types";

/** Row height in px. Mirrored in the stylesheet — see .spot-row. */
const ROW = 56;
/** Rows drawn either side of the centre. Enough to place yourself, not a list. */
const WINGS = 3;
/** A wheel gesture quieter than this is drift, not an intent to move. */
const WHEEL_THRESHOLD = 14;
/** Below this (rows/ms) a release is a placement, not a throw. */
const FLICK_MIN = 0.0016;
/** How long the throw keeps paying out. Higher = longer glide. */
const GLIDE_MS = 340;
/** No single flick may cross more than this — 114 sūrahs of runaway scroll is
 *  not navigation, it is a slot machine. */
const MAX_FLICK_ROWS = 28;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
/** Decelerating approach — fast out of the hand, easing to rest. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

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
  const found = chapters.findIndex((c) => c.id === initialId);
  const startAt = found === -1 ? 0 : found;
  const last = chapters.length - 1;

  /** The committed selection. Always an integer, and only updated when the
   *  column comes to rest — everything mid-flight lives in the ref below. */
  const [i, setI] = useState(startAt);
  const boxRef   = useRef<HTMLDivElement | null>(null);
  const listRef  = useRef<HTMLDivElement | null>(null);
  const countRef = useRef<HTMLParagraphElement | null>(null);

  /** Live position in rows, fractional while moving. The source of truth. */
  const pos = useRef(startAt);
  /** The row currently wearing the highlight, so it can be moved rather than
   *  every row re-tested each frame. */
  const litRef = useRef<Element | null>(null);
  const rafRef = useRef<number | null>(null);

  /** Paint the current position: one transform, one highlight swap. */
  const paint = useCallback(() => {
    const p = pos.current;
    if (listRef.current) {
      listRef.current.style.transform = `translateY(${-p * ROW}px)`;
    }
    const n = clamp(Math.round(p), 0, last);
    const row = listRef.current?.children[n];
    if (row && row !== litRef.current) {
      litRef.current?.setAttribute("data-current", "false");
      row.setAttribute("data-current", "true");
      litRef.current = row;
      /* The counter tracks the spin. It is one text node, so it is cheap
         where re-rendering the list would not be. */
      if (countRef.current) {
        countRef.current.textContent = `Sūrah ${chapters[n].id} of ${chapters.length}`;
      }
    }
  }, [last, chapters]);

  const stopAnim = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  /** Glide to a row and commit it. The flick, the keys and the arrows all
   *  come through here, so every route into a new sūrah decelerates alike. */
  const glideTo = useCallback((target: number, ms: number) => {
    stopAnim();
    const from = pos.current;
    const to = clamp(Math.round(target), 0, last);
    if (Math.abs(to - from) < 0.001) {
      pos.current = to; paint(); setI(to); return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / ms);
      pos.current = from + (to - from) * easeOut(t);
      paint();
      if (t < 1) { rafRef.current = requestAnimationFrame(step); return; }
      rafRef.current = null;
      pos.current = to;
      paint();
      setI(to);            // React learns the answer once, at rest
    };
    rafRef.current = requestAnimationFrame(step);
  }, [last, paint, stopAnim]);

  const move = useCallback((by: number) => {
    glideTo(clamp(Math.round(pos.current) + by, 0, last), Math.abs(by) > 1 ? 320 : 190);
  }, [glideTo, last]);

  /* Focus the box on open so the arrow keys work without a click first —
     the whole point of this view is that it is driven from the keyboard. */
  useEffect(() => { boxRef.current?.focus(); }, []);
  /* After EVERY render, not just on mount. The transform and the highlight
     are written imperatively, but React owns these nodes: any re-render
     recreates the rows with data-current="false" and replaces the element
     litRef points at, so the position has to be re-asserted or the column
     silently loses its highlight until the next move. */
  useEffect(() => { paint(); });
  useEffect(() => stopAnim, [stopAnim]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown": e.preventDefault(); move(1); break;
        case "ArrowUp":   e.preventDefault(); move(-1); break;
        case "PageDown":  e.preventDefault(); move(10); break;
        case "PageUp":    e.preventDefault(); move(-10); break;
        case "Home":      e.preventDefault(); glideTo(0, 420); break;
        case "End":       e.preventDefault(); glideTo(last, 420); break;
        case "Enter":
          e.preventDefault();
          onPick(chapters[clamp(Math.round(pos.current), 0, last)]);
          break;
        case "Escape":    e.preventDefault(); onClose(); break;
        default: return;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [last, move, glideTo, onPick, onClose, chapters]);

  /* Wheel deltas vary wildly between a mouse notch and a trackpad glide, so
     they are accumulated and spent one step at a time. A trackpad's own
     inertia already arrives as a stream of events, so this needs no momentum
     of its own — the hardware supplies it. */
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

  /* Touch/pen/mouse drag with a throw at the end. Pointer events rather than
     touch events so one path serves all three, and `setPointerCapture` keeps
     the gesture alive when the finger leaves the stage mid-drag. */
  const drag = useRef<{ y: number; from: number } | null>(null);
  const dragged = useRef(false);
  /** Recent samples, newest last. Velocity comes from the END of the gesture
   *  rather than its average, so a swipe that slows to a halt lands where it
   *  stopped instead of flying off on speed it no longer has. */
  const trail = useRef<{ t: number; y: number }[]>([]);

  function onPointerDown(e: React.PointerEvent) {
    /* Not the arrows or the open button — they are their own gesture. */
    if ((e.target as HTMLElement).closest("button")) return;
    stopAnim();                       // catching a spinning column stops it
    drag.current = { y: e.clientY, from: pos.current };
    dragged.current = false;
    trail.current = [{ t: performance.now(), y: e.clientY }];
    /* Best-effort: throws NotFoundError if the pointer is already gone by
       the time the handler runs. Capture is a convenience — the drag works
       without it — so it must never take the gesture down with it. */
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* fine */ }
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    /* A few pixels of slack, so a tap that trembles still opens a sūrah
       instead of being read as a drag. */
    if (!dragged.current && Math.abs(dy) < 4) return;
    dragged.current = true;
    trail.current.push({ t: performance.now(), y: e.clientY });
    if (trail.current.length > 5) trail.current.shift();
    /* Rubber band past the ends rather than a hard stop: the column gives,
       which says "there is nothing beyond this" without feeling broken. */
    const raw = d.from - dy / ROW;
    pos.current = raw < 0 ? raw / 3 : raw > last ? last + (raw - last) / 3 : raw;
    paint();
  }

  function endDrag(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch { /* the pointer was already released */ }
    if (!dragged.current) return;     // a tap; the row handles it

    /* Velocity over the tail of the gesture, in rows per millisecond. */
    const pts = trail.current;
    const a = pts[0], b = pts[pts.length - 1];
    const dt = a && b ? b.t - a.t : 0;
    const vel = dt > 0 ? -((b.y - a.y) / dt) / ROW : 0;

    if (Math.abs(vel) < FLICK_MIN) {
      glideTo(pos.current, 190);      // placed, not thrown — settle where it is
      return;
    }
    /* Distance is what the throw earned: velocity paid out over the glide,
       capped so one flick cannot cross the whole Qurʾān. */
    const travel = clamp(vel * GLIDE_MS, -MAX_FLICK_ROWS, MAX_FLICK_ROWS);
    const target = clamp(pos.current + travel, 0, last);
    /* Longer throws take longer to die, but never so long that the column
       feels like it is ignoring you. */
    const ms = clamp(260 + Math.abs(target - pos.current) * 46, 260, 900);
    glideTo(target, ms);
  }

  const current = chapters[i];

  /* Rendered once. Nothing here depends on the live position, which is what
     lets a flick cost one transform per frame instead of 114 diffs. */
  const rows = useMemo(() => chapters.map((ch, n) => (
    <div
      key={ch.id}
      id={`spot-opt-${ch.id}`}
      role="option"
      className="spot-row"
      data-current="false"
      style={{ height: ROW }}
      onClick={() => {
        if (dragged.current) return;  // that was a drag, not a tap
        const at = clamp(Math.round(pos.current), 0, last);
        if (n === at) onPick(ch); else glideTo(n, 260);
      }}
    >
      <span className="spot-num">{ch.id}</span>
      <span className="spot-name">{ch.name_simple}</span>
      <span className="spot-ar">{ch.name_arabic}</span>
    </div>
  )), [chapters, last, glideTo, onPick]);

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
            Swipe, or <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> for the grid
          </span>
          <button type="button" className="spot-alt" onClick={onClose}>
            <LayoutGrid size={14} aria-hidden /> {closeLabel}
          </button>
        </div>

        <p className="spot-count" ref={countRef} aria-live="polite">
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
              column so the live position lands there. Both come from ROW rather
              than the stylesheet so the geometry has a single source. */}
          <div className="spot-list" ref={listRef} style={{ top: ROW * WINGS }}>
            {rows}
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
