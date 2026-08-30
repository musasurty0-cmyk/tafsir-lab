"use client";

/**
 * ScriptView — the sūrah in a chosen mushaf script.
 *
 * Segments are rendered as elements, never as innerHTML: the route returns
 * plain text (see /api/quran/script), so
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

export default function ScriptView({ surah, onVerseClick }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let live = true;
    setState({ kind: "loading" });
    fetch(`/api/quran/script?surah=${surah}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { verses?: ScriptVerse[]; scripts?: ScriptDef[] } | null) => {
        if (!live) return;
        if (!d?.verses) { setState({ kind: "error" }); return; }
        setState({ kind: "ready", verses: d.verses });
      })
      .catch(() => { if (live) setState({ kind: "error" }); });
    return () => { live = false; };
  }, [surah]);

  return (
    <div className="sv">
      {state.kind === "loading" && (
        <p className="sv-status"><Loader2 size={16} className="rec-spin" aria-hidden /> Loading…</p>
      )}

      {state.kind === "error" && (
        <p className="sv-status sv-status--err">
          The text could not be loaded. Try again in a moment.
        </p>
      )}

      {state.kind === "ready" && (
        <div className="sv-verses" dir="rtl">
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

    </div>
  );
}
