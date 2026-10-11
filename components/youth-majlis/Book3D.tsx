"use client";

/**
 * Kamali's "Principles of Islamic Jurisprudence", as an object rather than a
 * picture: a CSS 3D box with its cream cover, interlaced border, spine and a
 * block of pages, so it can be turned. Drag (or use the arrow keys) to turn
 * it; left alone it settles back to the three-quarter view of the cover and
 * breathes slightly, the way a book on a stand catches the light.
 *
 * Built from the cover's design rather than a photograph so it stays sharp at
 * any size and in either theme.
 *
 * A tap (a press that does not travel) opens the cover on its spine to the
 * first page; another closes it. While open it turns to face you, so the
 * page can be read.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const REST = { x: -6, y: -28 };
const OPEN = { x: -4, y: -8 };

export default function Book3D({ compact = false }: { compact?: boolean }) {
  const [rot, setRot] = useState(REST);
  const [dragging, setDragging] = useState(false);
  const [open, setOpen] = useState(false);
  const start = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(false);

  const scheduleSettle = useCallback(() => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => setRot(openRef.current ? OPEN : REST), 2600);
  }, []);
  function setOpenTo(v: boolean) {
    openRef.current = v;
    setOpen(v);
    setRot(v ? OPEN : REST);
  }
  useEffect(() => () => { if (settle.current) clearTimeout(settle.current); }, []);

  function onDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, x: rot.x, y: rot.y, moved: false };
    setDragging(true);
    if (settle.current) clearTimeout(settle.current);
  }
  function onMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.px, e.clientY - s.py) < 5) return;
    s.moved = true;
    setRot({
      x: Math.max(-40, Math.min(40, s.x - (e.clientY - s.py) * 0.35)),
      y: s.y + (e.clientX - s.px) * 0.45,
    });
  }
  function onUp() {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (s && !s.moved) { setOpenTo(!openRef.current); return; }
    scheduleSettle();
  }
  function onKey(e: React.KeyboardEvent) {
    const step = 15;
    if (e.key === "ArrowLeft")  setRot((r) => ({ ...r, y: r.y - step }));
    else if (e.key === "ArrowRight") setRot((r) => ({ ...r, y: r.y + step }));
    else if (e.key === "ArrowUp")    setRot((r) => ({ ...r, x: Math.min(40, r.x + step) }));
    else if (e.key === "ArrowDown")  setRot((r) => ({ ...r, x: Math.max(-40, r.x - step) }));
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenTo(!openRef.current); return; }
    else return;
    e.preventDefault();
    scheduleSettle();
  }

  return (
    <div
      className={`bk-stage${compact ? " bk-stage--compact" : ""}`}
      role="button"
      aria-pressed={open}
      aria-label={`Principles of Islamic Jurisprudence by Mohammad Hashim Kamali. ${open ? "Open at the first page" : "Closed"}. Tap to ${open ? "close" : "open"} it; drag or use the arrow keys to turn it.`}
      tabIndex={0}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onKeyDown={onKey}
      data-dragging={dragging ? "true" : undefined}
      data-open={open ? "" : undefined}
    >
      <div className="bk-float">
        <div
          className="bk"
          style={{ transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}
        >
          {/* The first page, under the cover. */}
          <div className="bk-face bk-firstpage" aria-hidden>
            <span className="bk-fp-bism" lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>
            <span className="bk-fp-ch">Chapter One</span>
            <span className="bk-fp-title">Introduction to Uṣūl al-Fiqh</span>
            <span className="bk-fp-rule" />
            <span className="bk-fp-note">Read before the first session</span>
          </div>
          {/* The cover hinges on the spine: outside and endpaper back to back. */}
          <div className="bk-face bk-front">
            <div className="bk-cover-out"><Cover /></div>
            <div className="bk-cover-in" />
          </div>
          <div className="bk-face bk-back"><span className="bk-back-mark">ʿIlmī · Youth Majlis</span></div>
          <div className="bk-face bk-spine">
            <span className="bk-spine-title">PRINCIPLES OF ISLAMIC JURISPRUDENCE</span>
            <span className="bk-spine-author">Kamali</span>
          </div>
          <div className="bk-face bk-pages bk-pages--side" />
          <div className="bk-face bk-pages bk-pages--top" />
          <div className="bk-face bk-pages bk-pages--bottom" />
        </div>
      </div>
      <div className="bk-shadow" aria-hidden />
    </div>
  );
}

/** The front cover: an interlaced border, the title, a rule, the author in
 *  spaced capitals, and the palm emblem in its roundel. */
function Cover() {
  return (
    <svg className="bk-cover" viewBox="0 0 300 440" aria-hidden>
      <defs>
        {/* Overlapping rings read as an interlaced chain at this size. */}
        <pattern id="bk-knot" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="4.5" cy="4.5" r="5.6" fill="none" stroke="#2c2721" strokeWidth="1.05" />
        </pattern>
        <linearGradient id="bk-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      <rect width="300" height="440" fill="#ebe5d3" />
      {/* the border band: outer rect minus inner rect, filled with the knot */}
      <path
        d="M14 14H286V426H14Z M30 30V410H270V30Z"
        fill="url(#bk-knot)" fillRule="evenodd"
      />
      <rect x="14" y="14" width="272" height="412" fill="none" stroke="#2c2721" strokeWidth="1.6" />
      <rect x="30" y="30" width="240" height="380" fill="none" stroke="#2c2721" strokeWidth="1.6" />
      <rect x="36" y="36" width="228" height="368" fill="none" stroke="#2c2721" strokeWidth="0.7" />

      <g fill="#1f1b17" fontFamily="'Source Serif 4', Georgia, serif" textAnchor="middle">
        <text x="150" y="98"  fontSize="27">Principles of</text>
        <text x="150" y="132" fontSize="27">Islamic</text>
        <text x="150" y="166" fontSize="27">Jurisprudence</text>
      </g>
      <line x1="36" y1="196" x2="264" y2="196" stroke="#2c2721" strokeWidth="0.8" />
      <g fill="#1f1b17" fontFamily="'Source Serif 4', Georgia, serif" textAnchor="middle" letterSpacing="2.4">
        <text x="150" y="232" fontSize="17">MOHAMMAD</text>
        <text x="150" y="258" fontSize="17">HASHIM</text>
        <text x="150" y="284" fontSize="17">KAMALI</text>
      </g>
      <line x1="36" y1="308" x2="264" y2="308" stroke="#2c2721" strokeWidth="0.8" />

      {/* the roundel with its palm */}
      <g transform="translate(150 356)" fill="none" stroke="#2c2721" strokeWidth="1.2" strokeLinecap="round">
        <circle r="24" />
        <path d="M0 16 C0 6 1 -2 0 -10" />
        <path d="M0 -10 C-6 -14 -12 -12 -15 -6" />
        <path d="M0 -10 C6 -14 12 -12 15 -6" />
        <path d="M0 -10 C-3 -16 -9 -18 -12 -16" />
        <path d="M0 -10 C3 -16 9 -18 12 -16" />
        <path d="M-10 16 H10" />
      </g>

      <rect width="300" height="440" fill="url(#bk-sheen)" />
    </svg>
  );
}
