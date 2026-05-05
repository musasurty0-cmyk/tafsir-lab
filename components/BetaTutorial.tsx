"use client";

/**
 * BetaTutorial — interactive product tour at /beta
 *
 * Four hands-on steps:
 *   01  Write  — live TipTap editor (no API, no persistence)
 *   02  Draw   — freehand canvas over an Al-Fatiha Mushaf mockup
 *   03  Live   — animated demo of two collaborators writing in real time
 *   04  Begin  — CTA → /login
 *
 * Navigation: "Next →" footer button advances steps with a slide transition.
 * Step hints tell the user what to try before pressing Next.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TOTAL = 4;

const SWATCH_COLORS = [
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
];

const FATIHA_LINES = [
  "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
  "ٱلْحَمْدُ لِلَّهِ رَبِّ ٱلْعَٰلَمِينَ",
  "ٱلرَّحْمَٰنِ ٱلرَّحِيمِ",
  "مَٰلِكِ يَوْمِ ٱلدِّينِ",
  "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
  "ٱهْدِنَا ٱلصِّرَٰطَ ٱلْمُسْتَقِيمَ",
  "صِرَٰطَ ٱلَّذِينَ أَنْعَمْتَ عَلَيْهِمْ",
];

const YASMIN_TEXT =
  "The opening verse speaks to the universality of divine mercy — it establishes the tone for the entire Qurʾān.";
const AHMED_TEXT =
  "Both ar-Raḥmān and ar-Raḥīm derive from r-ḥ-m. The former is the vast mercy poured over all creation; the latter, the specific mercy directed at the believers.";

const STEP_HINTS = [
  "Try writing something above, then press Next when you're done →",
  "Try drawing on the Mushaf, then press Next when you're done →",
  "Watch the live collaboration demo, then press Next →",
];

// ─────────────────────────────────────────────────────────────────────────────
// Shared shell — sidebar label + interactive area
// ─────────────────────────────────────────────────────────────────────────────

function StepShell({
  n,
  title,
  desc,
  extra,
  children,
}: {
  n: string;
  title: string;
  desc: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bt-shell">
      <aside className="bt-sidebar">
        <span className="bt-step-n">{n}</span>
        <h2 className="bt-step-title">{title}</h2>
        <p className="bt-step-desc">{desc}</p>
        {extra && <div className="bt-sidebar-extra">{extra}</div>}
      </aside>
      <div className="bt-demo-area">{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 01 — Write
// ─────────────────────────────────────────────────────────────────────────────

function WriteStep() {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          "Start writing here — try a reflection on a verse you are studying…",
      }),
    ],
    content: "",
  });

  useEffect(() => () => { editor?.destroy(); }, [editor]);

  return (
    <StepShell
      n="01"
      title="Write your tafsir"
      desc="This is your writing space. Type reflections, commentary, or study notes on any verse. Use headings, lists, or blockquotes to structure your work. Press '/' to see all commands."
    >
      <div className="bt-editor-frame">
        <div className="bt-editor-bar">
          <span className="bt-bar-pill">B</span>
          <span className="bt-bar-pill">I</span>
          <span className="bt-bar-pill">H₁</span>
          <div className="bt-bar-flex" />
          <span className="bt-bar-hint">/ commands</span>
        </div>
        <EditorContent editor={editor} className="bt-editor-body" />
      </div>
    </StepShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 02 — Annotate
// ─────────────────────────────────────────────────────────────────────────────

function AnnotateStep() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDown    = useRef(false);
  const lastPt    = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(SWATCH_COLORS[0]);
  const colorRef = useRef(color);
  useEffect(() => { colorRef.current = color; }, [color]);

  function toCanvasXY(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (c.width  / r.width),
      y: (e.clientY - r.top)  * (c.height / r.height),
    };
  }

  function onDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    isDown.current = true;
    lastPt.current = toCanvasXY(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDown.current || !lastPt.current) return;
    const c   = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    const p   = toCanvasXY(e);
    ctx.beginPath();
    ctx.moveTo(lastPt.current.x, lastPt.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth   = 3.5;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";
    ctx.stroke();
    lastPt.current = p;
  }

  function onUp() {
    isDown.current = false;
    lastPt.current = null;
  }

  function clearCanvas() {
    const c = canvasRef.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
  }

  return (
    <StepShell
      n="02"
      title="Annotate the Mushaf"
      desc="Draw directly on the Quranic text. Circle a word, underline a verse, or highlight as you study. Your marks are saved and shared with your workspace."
      extra={
        <div className="bt-anno-controls">
          <div className="bt-swatches">
            {SWATCH_COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Color ${c}`}
                className={`bt-swatch${color === c ? " bt-swatch--on" : ""}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <button className="bt-clear-btn" onClick={clearCanvas}>
            Clear
          </button>
        </div>
      }
    >
      <div className="bt-mushaf-frame">
        {/* Paper background with Al-Fatiha */}
        <div className="bt-mushaf-paper">
          {FATIHA_LINES.map((line, i) => (
            <p key={i} className="bt-ar-line">
              {line}
            </p>
          ))}
        </div>
        {/* Transparent drawing canvas on top */}
        <canvas
          ref={canvasRef}
          width={700}
          height={420}
          className="bt-draw-canvas"
          style={{ touchAction: "none" }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
        />
      </div>
    </StepShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 03 — Live collaboration demo
// ─────────────────────────────────────────────────────────────────────────────

function LiveStep() {
  const [yt, setYt] = useState(0); // chars of Yasmin's text shown
  const [at, setAt] = useState(0); // chars of Ahmed's text shown

  useEffect(() => {
    let yi = 0, ai = 0;
    const yasminTimer = setInterval(() => {
      yi++;
      setYt(yi);
      if (yi >= YASMIN_TEXT.length) clearInterval(yasminTimer);
    }, 28);

    const ahmedDelay = setTimeout(() => {
      const ahmedTimer = setInterval(() => {
        ai++;
        setAt(ai);
        if (ai >= AHMED_TEXT.length) clearInterval(ahmedTimer);
      }, 22);
      return () => clearInterval(ahmedTimer);
    }, 700);

    return () => {
      clearInterval(yasminTimer);
      clearTimeout(ahmedDelay);
    };
  }, []);

  return (
    <StepShell
      n="03"
      title="Study together, live"
      desc="Invite your teacher, class, or study circle. Everyone's cursor appears in real time. Watch Yasmin and Ahmed writing their tafsir simultaneously — the same way it looks in the real app."
    >
      <div className="bt-collab-frame">
        {/* Top bar with presence */}
        <div className="bt-collab-bar">
          <span className="bt-collab-title">Sūrah Al-Fātiḥah · Tafsir Notes</span>
          <div className="bt-presence-row">
            {[
              { name: "Yasmin", color: "#4285F4" },
              { name: "Ahmed",  color: "#FF6D00" },
              { name: "You",    color: "#10b981" },
            ].map((u) => (
              <span
                key={u.name}
                className="bt-presence-pill"
                style={{ "--pc": u.color } as React.CSSProperties}
              >
                <span className="bt-presence-dot" />
                {u.name}
              </span>
            ))}
          </div>
        </div>

        {/* Document body */}
        <div className="bt-collab-doc">
          {/* Yasmin's block */}
          <div className="bt-collab-block">
            <span
              className="bt-collab-author"
              style={{ color: "#4285F4" }}
            >
              Yasmin
            </span>
            <p className="bt-collab-para">
              {YASMIN_TEXT.slice(0, yt)}
              {yt < YASMIN_TEXT.length && (
                <span
                  className="bt-fake-caret"
                  style={{ "--cc": "#4285F4" } as React.CSSProperties}
                />
              )}
            </p>
          </div>

          {/* Ahmed's block */}
          <div className="bt-collab-block">
            <span
              className="bt-collab-author"
              style={{ color: "#FF6D00" }}
            >
              Ahmed
            </span>
            <p className="bt-collab-para">
              {at === 0 ? (
                <span className="bt-collab-waiting">starting to type…</span>
              ) : (
                <>
                  {AHMED_TEXT.slice(0, at)}
                  {at < AHMED_TEXT.length && (
                    <span
                      className="bt-fake-caret"
                      style={{ "--cc": "#FF6D00" } as React.CSSProperties}
                    />
                  )}
                </>
              )}
            </p>
          </div>

          {/* Your empty block — invitation */}
          <div className="bt-collab-block bt-collab-block--you">
            <span className="bt-collab-author" style={{ color: "#10b981" }}>
              You
            </span>
            <p className="bt-collab-para bt-collab-para--empty">
              Your notes will appear here…
            </p>
          </div>
        </div>
      </div>
    </StepShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 04 — Begin
// ─────────────────────────────────────────────────────────────────────────────

function BeginStep({ onReplay }: { onReplay: () => void }) {
  return (
    <div className="bt-begin">
      <span className="bt-begin-n">04</span>
      <h2 className="bt-begin-title">
        Begin your study <em>today.</em>
      </h2>
      <p className="bt-begin-desc">
        Create a workspace, open any surah, and start writing. Your notes
        save automatically, and you can invite your circle any time.
      </p>
      <div className="bt-begin-actions">
        <Link href="/login" className="bt-cta-primary">
          Create account →
        </Link>
        <Link href="/login" className="bt-cta-ghost">
          I already have an account
        </Link>
      </div>
      <button className="bt-replay-btn" onClick={onReplay}>
        ↩ Watch again
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export default function BetaTutorial() {
  const [step, setStep]       = useState(0);
  const [leaving, setLeaving] = useState(false);

  /* Fonts + body background */
  useEffect(() => {
    if (!document.getElementById("lp-fonts")) {
      const link = document.createElement("link");
      link.id    = "lp-fonts";
      link.rel   = "stylesheet";
      link.href  =
        "https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;1,300;1,400&family=Sora:wght@300;400;500&family=Scheherazade+New:wght@400;700&display=swap";
      document.head.appendChild(link);
    }
    const prev = document.body.style.background;
    document.body.style.background = "oklch(0.11 0.008 80)";
    return () => { document.body.style.background = prev; };
  }, []);

  const next = useCallback(() => {
    if (step >= TOTAL - 1) return;
    setLeaving(true);
    setTimeout(() => {
      setStep((s) => s + 1);
      setLeaving(false);
    }, 260);
  }, [step]);

  const replay = useCallback(() => {
    setLeaving(true);
    setTimeout(() => {
      setStep(0);
      setLeaving(false);
    }, 260);
  }, []);

  return (
    <div className="bt">
      {/* ── Header ── */}
      <header className="bt-header">
        <span className="bt-logo">TafsirLab</span>
        <div className="bt-dots">
          {Array.from({ length: TOTAL }, (_, i) => (
            <span
              key={i}
              className={
                "bt-dot" +
                (i === step ? " bt-dot--cur" : i < step ? " bt-dot--done" : "")
              }
            />
          ))}
        </div>
        <span className="bt-step-counter">
          {step + 1} / {TOTAL}
        </span>
      </header>

      {/* ── Step body ── */}
      <div
        key={step}
        className={`bt-body${leaving ? " bt-body--leave" : " bt-body--enter"}`}
      >
        {step === 0 && <WriteStep />}
        {step === 1 && <AnnotateStep />}
        {step === 2 && <LiveStep />}
        {step === 3 && <BeginStep onReplay={replay} />}
      </div>

      {/* ── Footer nav ── */}
      {step < TOTAL - 1 && (
        <footer className="bt-footer">
          <span className="bt-footer-hint">{STEP_HINTS[step]}</span>
          <button className="bt-next-btn" onClick={next}>
            Next →
          </button>
        </footer>
      )}
    </div>
  );
}
