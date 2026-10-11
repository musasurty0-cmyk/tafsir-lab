"use client";

/**
 * The ten questions, as something you work through rather than read.
 *
 * Choose a module, step through the questions one at a time, read how to
 * research each, and mark it explored. The ring fills as you go, and the
 * journey tile for that module fills with it (both read the same store).
 * Progress is the student's own and stays on their device.
 */

import { useRef, useState } from "react";
import { useLocal, exploredKey } from "./useLocal";

type Q = { n: number; label: string; q: string; how: string };
type M = { n: number; surah: number; surahEn: string };

export function Ring({ value, max, size = 56, stroke = 5, label }: {
  value: number; max: number; size?: number; stroke?: number; label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = max ? value / max : 0;
  return (
    <span className="y-ring" style={{ width: size, height: size }} aria-label={label ?? `${value} of ${max}`} role="img">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} className="y-ring-track" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} className="y-ring-fill" strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c * (1 - done)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="y-ring-n">{value}</span>
    </span>
  );
}

export default function QuestionExplorer({ questions, modules, current }: {
  questions: Q[]; modules: M[]; current: number;
}) {
  const [mod, setMod] = useState(current);
  const [qn, setQn]   = useState(1);
  const [explored, setExplored] = useLocal<number[]>(exploredKey(mod), []);
  const listRef = useRef<HTMLOListElement>(null);

  const m = modules.find((x) => x.n === mod) ?? modules[0];
  const q = questions.find((x) => x.n === qn) ?? questions[0];
  const isDone = explored.includes(qn);
  const mi = modules.findIndex((x) => x.n === mod);

  function toggle() {
    setExplored(isDone ? explored.filter((x) => x !== qn) : [...explored, qn].sort((a, b) => a - b));
  }
  function go(n: number) {
    const next = Math.min(questions.length, Math.max(1, n));
    setQn(next);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-q="${next}"]`)?.focus();
  }

  return (
    <div className="qx">
      <div className="qx-top">
        <div className="qx-seg" role="radiogroup" aria-label="Module" style={{ "--i": mi, "--n": modules.length } as React.CSSProperties}>
          <span className="qx-seg-thumb" aria-hidden />
          {modules.map((x) => (
            <button
              key={x.n} role="radio" aria-checked={x.n === mod}
              onClick={() => setMod(x.n)}
            >
              {x.surahEn}
            </button>
          ))}
        </div>
        <div className="qx-progress">
          <Ring value={explored.length} max={questions.length} label={`${explored.length} of ${questions.length} questions explored for ${m.surahEn}`} />
          <span><strong>{explored.length} of {questions.length}</strong> explored<br />for {m.surahEn}</span>
        </div>
      </div>

      <div className="qx-body">
        <ol
          ref={listRef}
          className="qx-list" role="tablist" aria-orientation="vertical" aria-label="The ten questions"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); go(qn + 1); }
            if (e.key === "ArrowUp")   { e.preventDefault(); go(qn - 1); }
          }}
        >
          {questions.map((x) => (
            <li key={x.n}>
              <button
                role="tab" data-q={x.n}
                aria-selected={x.n === qn} tabIndex={x.n === qn ? 0 : -1}
                aria-controls="qx-panel"
                onClick={() => setQn(x.n)}
              >
                <span className="qx-li-n">{x.n}</span>
                <span className="qx-li-l">{x.label}</span>
                <span className="qx-li-done" data-on={explored.includes(x.n) ? "" : undefined} aria-label={explored.includes(x.n) ? "explored" : undefined} />
              </button>
            </li>
          ))}
        </ol>

        <div id="qx-panel" role="tabpanel" className="qx-panel" key={`${mod}-${qn}`}>
          <span className="qx-n">{String(q.n).padStart(2, "0")}</span>
          <h3 className="qx-label">{q.label}</h3>
          <p className="qx-q">{q.q}</p>
          <p className="qx-how-h">How to research it</p>
          <p className="qx-how">{q.how}</p>
          <div className="qx-actions">
            <button className="qx-mark" data-on={isDone ? "" : undefined} onClick={toggle} aria-pressed={isDone}>
              <span className="qx-mark-tick" aria-hidden />
              {isDone ? "Explored" : "Mark as explored"}
            </button>
            <a className="y-more y-more--light" href={`/youth-majlis/open/${m.surah}`}>Open {m.surahEn} in TafsirLab</a>
          </div>
          <div className="qx-step">
            <button onClick={() => go(qn - 1)} disabled={qn === 1} aria-label="Previous question">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button onClick={() => go(qn + 1)} disabled={qn === questions.length} aria-label="Next question">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
