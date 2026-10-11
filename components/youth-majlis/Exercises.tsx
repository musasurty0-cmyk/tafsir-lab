"use client";

/**
 * A module's exercises, each with somewhere to answer it. Tap "Reflect" and a
 * writing space opens under the question; it saves as you type, to the
 * student's TafsirLab account (or this device, if they are not signed in).
 * Some of these are deeply personal; nobody else can see them, and the page
 * says so.
 */

import { useEffect, useRef, useState } from "react";
import { useLocal } from "./useLocal";
import SyncNote from "./SyncNote";

function Exercise({ moduleN, i, q }: { moduleN: number; i: number; q: string }) {
  const [text, setText] = useLocal<string>(`reflect:${moduleN}:${i}`, "");
  const [open, setOpen] = useState(false);
  /* null until you type: until then the box shows what is saved, so a value
     that loads from storage after the first render needs no copying across. */
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (open) area.current?.focus(); }, [open]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function change(v: string) {
    setDraft(v);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { setText(v); setSaved(true); }, 450);
  }

  const shown = draft ?? text;
  const words = shown.trim() ? shown.trim().split(/\s+/).length : 0;

  return (
    <div className="y-ex" data-open={open ? "" : undefined}>
      <p className="y-exercise-q">{q}</p>
      <button className="y-ex-toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "Close" : text ? "Continue your reflection" : "Reflect"}
      </button>
      <div className="y-ex-space">
        <div>
          <textarea
            ref={area}
            value={shown}
            onChange={(e) => change(e.target.value)}
            placeholder="Write freely. Only you can see this."
            rows={5}
            aria-label={`Your reflection: ${q}`}
            tabIndex={open ? 0 : -1}
          />
          <p className="y-ex-meta">
            <span>Private to you. <SyncNote /></span>
            <span>{words ? `${words} word${words === 1 ? "" : "s"}` : ""}{saved && words ? " · Saved" : ""}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Exercises({ moduleN, exercises }: { moduleN: number; exercises: string[] }) {
  return (
    <div className="y-exercise" data-reveal>
      <p className="y-exercise-h">Exercises</p>
      {exercises.map((q, i) => <Exercise key={q} moduleN={moduleN} i={i} q={q} />)}
    </div>
  );
}
