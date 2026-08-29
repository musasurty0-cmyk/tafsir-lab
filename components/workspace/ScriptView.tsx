"use client";

/**
 * ScriptView — the sūrah in a chosen mushaf script.
 *
 * Segments are rendered as elements, never as innerHTML. The tajweed markup
 * upstream returns is parsed server-side into data (see /api/quran/script), so
 * there is no path by which a string from another service becomes HTML in this
 * app — which is the whole reason the parse happens there rather than here.
 *
 * This does not replace the QCF page renderer. That one reproduces the Madīnah
 * muṣḥaf line for line, which is what page-anchored annotation depends on;
 * this is for reading a sūrah in a different hand, where the line breaks are
 * not load-bearing.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export interface Segment { text: string; rule?: string }
export interface ScriptVerse { verseKey: string; segments: Segment[] }
interface ScriptDef { id: string; label: string; note: string }

interface Props {
  surah:      number;
  /** Clicking a verse — the reader uses this to open tafsīr on it. */
  onVerseClick?: (verseKey: string) => void;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; verses: ScriptVerse[] }
  | { kind: "error" };

const KEY = "tl-script";

export default function ScriptView({ surah, onVerseClick }: Props) {
  const [script, setScript] = useState("uthmani");
  const [scripts, setScripts] = useState<ScriptDef[]>([]);
  const [state, setState]   = useState<State>({ kind: "loading" });

  // The chosen script is a reading preference, so it persists across sūrahs
  // and sessions. Read in an effect for the usual hydration reason.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setScript(saved);
    } catch { /* ignore */ }
  }, []);

  const choose = useCallback((id: string) => {
    setScript(id);
    try { localStorage.setItem(KEY, id); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    fetch(`/api/quran/script?surah=${surah}&script=${script}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { verses?: ScriptVerse[]; scripts?: ScriptDef[] } | null) => {
        if (!live) return;
        if (!d?.verses) { setState({ kind: "error" }); return; }
        if (d.scripts) setScripts(d.scripts);
        setState({ kind: "ready", verses: d.verses });
      })
      .catch(() => { if (live) setState({ kind: "error" }); });
    return () => { live = false; };
  }, [surah, script]);

  return (
    <div className="sv">
      <div className="sv-picker" role="group" aria-label="Script">
        {(scripts.length ? scripts : [{ id: "uthmani", label: "Uthmani", note: "" }]).map((s) => (
          <button
            key={s.id}
            className="sv-chip"
            data-active={script === s.id ? "true" : "false"}
            onClick={() => choose(s.id)}
            title={s.note}
          >
            {s.label}
          </button>
        ))}
      </div>

      {state.kind === "loading" && (
        <p className="sv-status"><Loader2 size={16} className="rec-spin" aria-hidden /> Loading…</p>
      )}

      {state.kind === "error" && (
        <p className="sv-status sv-status--err">
          That script could not be loaded. The Uthmani text is still available.
        </p>
      )}

      {state.kind === "ready" && (
        <div className="sv-verses" dir="rtl" data-script={script}>
          {state.verses.map((v) => (
            <p
              key={v.verseKey}
              className="sv-verse"
              onClick={() => onVerseClick?.(v.verseKey)}
              role={onVerseClick ? "button" : undefined}
              tabIndex={onVerseClick ? 0 : undefined}
              onKeyDown={(e) => { if (onVerseClick && e.key === "Enter") onVerseClick(v.verseKey); }}
            >
              {v.segments.map((s, i) =>
                s.rule
                  ? <span key={i} className="sv-rule" data-rule={s.rule}>{s.text}</span>
                  : <span key={i}>{s.text}</span>,
              )}
              <span className="sv-num" dir="ltr">{v.verseKey.split(":")[1]}</span>
            </p>
          ))}
        </div>
      )}

      {script === "tajweed" && state.kind === "ready" && (
        <ul className="sv-legend" aria-label="Tajweed rules">
          {[
            ["ghunnah", "Ghunnah"], ["ikhafa", "Ikhfāʾ"], ["idgham_ghunnah", "Idghām"],
            ["qalaqah", "Qalqalah"], ["iqlab", "Iqlāb"], ["madda_obligatory", "Madd"],
            ["ham_wasl", "Hamzat al-waṣl"], ["laam_shamsiyah", "Lām shamsiyyah"],
            ["slnt", "Silent"],
          ].map(([rule, label]) => (
            <li key={rule}><span className="sv-swatch" data-rule={rule} aria-hidden /> {label}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
