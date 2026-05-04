"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "tl-tutorial-done";

const STEPS = [
  {
    icon: "📖",
    title: "Welcome to TafsirLab",
    body: "TafsirLab is your personal and collaborative Qur'an study desk. Take notes, embed verses, and study with others — all in one place.",
  },
  {
    icon: "🗂️",
    title: "Workspaces",
    body: "A workspace is your study notebook. Create one for a course, a personal study project, or a group — then invite others with a single invite code.",
  },
  {
    icon: "📋",
    title: "Surahs & pages",
    body: "Inside each workspace, navigate by surah. Each surah has pages — think of them like chapters in your notes. Create as many pages as you need.",
  },
  {
    icon: "✍️",
    title: "The editor",
    body: "Pages use a rich text editor. Type normally, or press / to open the command palette for headings, bullet lists, dividers, and more.",
  },
  {
    icon: "⌨️",
    title: "Slash commands",
    body: (
      <span>
        Two powerful commands to know:
        <br /><br />
        <code className="tut-code">/ayah 2:255</code> — embeds the verse with Arabic text and translation.
        <br /><br />
        <code className="tut-code">/tafsir 2:255</code> — embeds Ibn Kathīr's commentary on that verse.
      </span>
    ),
  },
  {
    icon: "👥",
    title: "Collaboration",
    body: "Share a workspace with your study group using the invite code found in workspace settings. Collaborators can add their own notes and you'll see each other's cursors live.",
  },
];

export default function TutorialOverlay() {
  const [visible, setVisible] = useState(false);
  const [step,    setStep]    = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    setLeaving(true);
    setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, "1");
      setVisible(false);
    }, 250);
  }

  function next() {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else dismiss();
  }

  function prev() {
    if (step > 0) setStep((s) => s - 1);
  }

  if (!visible) return null;

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  return (
    <div className={`tut-backdrop${leaving ? " tut-backdrop--out" : ""}`}>
      <div className={`tut-card${leaving ? " tut-card--out" : ""}`}>

        {/* Skip */}
        <button className="tut-skip" onClick={dismiss}>Skip</button>

        {/* Icon */}
        <div className="tut-icon">{current.icon}</div>

        {/* Content */}
        <h2 className="tut-title">{current.title}</h2>
        <p className="tut-body">{current.body}</p>

        {/* Dots */}
        <div className="tut-dots">
          {STEPS.map((_, i) => (
            <button
              key={i}
              className={`tut-dot${i === step ? " tut-dot--active" : ""}`}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Nav */}
        <div className="tut-nav">
          <button
            className="tut-btn tut-btn--ghost"
            onClick={prev}
            disabled={step === 0}
          >
            Back
          </button>
          <button className="tut-btn tut-btn--primary" onClick={next}>
            {isLast ? "Get started" : "Next"}
          </button>
        </div>

      </div>
    </div>
  );
}
