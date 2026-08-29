"use client";

/**
 * AiPanel — the assistant, docked beside what you are reading.
 *
 * The point of it living here rather than on its own page is context. It knows
 * which sūrah and page you have open and what you have selected, so "what are
 * the main themes here?" has a referent, and it searches your own notes as well
 * as the tafsīr — the two things a standalone chat box cannot do.
 *
 * Notes are retrieved and cited as "Your note", never as a source. A reader's
 * half-formed thought must not acquire a commentary's authority by appearing in
 * the same numbered list.
 *
 * There is no microphone or attachment button. Both would be decoration until
 * something is behind them, and a control that does nothing is worse than an
 * absent one.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles, Send, X, SquarePen, ChevronDown, AlertCircle, Loader2, BookOpen,
} from "lucide-react";

interface CiteRef { n: number; sourceName: string; verseKey: string }
interface Step { step: string; detail: string; state?: string }
interface HitRef { sourceName: string; verseKey: string; via: string; rank: number }
interface PassageOut {
  chunkId: string; sourceName: string; verseKey: string; language: string;
  content: string; translation: string | null;
}

interface Turn {
  id: string;
  question: string;
  steps: Step[];
  hits: HitRef[];
  cites: CiteRef[];
  text: string;
  sentences: { text: string; sourceName: string; verseKey: string }[];
  passages: PassageOut[];
  warning?: string;
  note?: string;
  error?: string;
  running: boolean;
  openTrace: boolean;
}

interface Props {
  workspaceId: string;
  pageId:      string | null;
  surahNumber: number;
  surahName:   string;
  onClose:     () => void;
}

/** Turn "[1]" into a chip naming its source. A bare number tells you nothing. */
function withCitations(text: string, cites: CiteRef[]) {
  const by = new Map(cites.map((c) => [c.n, c]));
  const out: React.ReactNode[] = [];
  let last = 0, key = 0;
  for (const m of text.matchAll(/\[(\d{1,2})\]/g)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    const c = by.get(Number(m[1]));
    out.push(c
      ? <span key={key++} className="as-cite" title={`${c.sourceName}${c.verseKey ? " — " + c.verseKey : ""}`}>{m[1]}</span>
      : <span key={key++} className="as-cite as-cite--bad" title="No such passage was retrieved">{m[0]}</span>);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function AiPanel({ pageId, surahNumber, surahName, onClose }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const busy = turns.some((t) => t.running);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  const patch = useCallback((id: string, fn: (t: Turn) => Turn) => {
    setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));
  }, []);

  const ask = useCallback(async (raw?: string) => {
    const question = (raw ?? q).trim();
    if (!question || busy) return;

    const history = turns.flatMap((t) => {
      const a = t.text || t.sentences.map((s) => s.text).join(" ");
      return a
        ? [{ role: "user" as const, content: t.question },
           { role: "assistant" as const, content: a }]
        : [];
    }).slice(-6);

    const id = crypto.randomUUID();
    setTurns((ts) => [...ts, {
      id, question, steps: [], hits: [], cites: [], text: "",
      sentences: [], passages: [], running: true, openTrace: true,
    }]);
    setQ("");

    const res = await fetch("/api/assistant", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question, history,
        // What you have open. The server treats this as a default a reference
        // in the question can override.
        surah: surahNumber,
        pageId,
        includeNotes: true,
      }),
    }).catch(() => null);

    if (!res?.ok || !res.body) {
      patch(id, (t) => ({ ...t, running: false, openTrace: false,
        error: "Could not reach the assistant." }));
      return;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let ev: Record<string, unknown>;
        try { ev = JSON.parse(line); } catch { continue; }

        patch(id, (t) => {
          const next = { ...t };
          if (typeof ev.step === "string") next.steps = [...next.steps, ev as unknown as Step];
          if (ev.sources) next.hits = (ev.sources as { hits: HitRef[] }).hits;
          if (ev.answerStart) {
            const a = ev.answerStart as { cites: CiteRef[] };
            next.cites = a.cites; next.text = "";
          }
          if (typeof ev.token === "string") next.text = next.text + ev.token;
          if (ev.answer) {
            next.sentences = (ev.answer as { sentences: Turn["sentences"] }).sentences;
          }
          if (ev.answerEnd) {
            const a = ev.answerEnd as { warning?: string };
            if (a.warning) next.warning = a.warning;
          }
          if (ev.error) next.error = String(ev.error);
          if (ev.done) {
            next.running = false; next.openTrace = false;
            if (typeof ev.note === "string") next.note = ev.note;
          }
          return next;
        });
      }
    }
    patch(id, (t) => (t.running ? { ...t, running: false, openTrace: false } : t));
  }, [q, busy, turns, surahNumber, pageId, patch]);

  /* Prompts that only make sense because the panel knows what is open. A
     generic "ask me anything" would not need a page to sit beside. */
  const SUGGESTIONS = [
    "Summarise my notes on this page",
    `What are the main themes in ${surahName}?`,
    "Explain this passage simply",
  ];

  return (
    <aside className="aip" aria-label="AI study assistant">
      <header className="aip-head">
        <span className="aip-title"><Sparkles size={15} aria-hidden /> AI Study</span>
        <span className="aip-context" title="What the assistant is looking at">
          <BookOpen size={12} aria-hidden /> {surahName}
        </span>
        <button className="aip-icon" onClick={() => setTurns([])} title="New chat" aria-label="New chat">
          <SquarePen size={15} />
        </button>
        <button className="aip-icon" onClick={onClose} title="Close" aria-label="Close assistant">
          <X size={16} />
        </button>
      </header>

      <div className="aip-body">
        {turns.length === 0 && (
          <div className="aip-empty">
            <span className="aip-empty-icon" aria-hidden><Sparkles size={26} /></span>
            <p className="aip-empty-title">AI Study Assistant</p>
            <p className="aip-empty-sub">
              Ask about any verse or search your notes. Every answer is drawn from
              the tafsīr in your library and cites what it used.
            </p>
            <div className="aip-suggest">
              {SUGGESTIONS.map((sg) => (
                <button key={sg} onClick={() => ask(sg)}>{sg}</button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t) => (
          <article key={t.id} className="aip-turn">
            <p className="aip-q">{t.question}</p>

            <div className="as-trace" data-open={t.openTrace ? "true" : "false"}>
              <button
                className="as-trace-head"
                onClick={() => patch(t.id, (x) => ({ ...x, openTrace: !x.openTrace }))}
                aria-expanded={t.openTrace}
              >
                {t.running
                  ? <Loader2 size={14} className="rec-spin" aria-hidden />
                  : <ChevronDown size={14} aria-hidden className="as-trace-chev" />}
                <span>{t.running ? "Working…" : `${t.hits.length} passages`}</span>
              </button>
              {t.openTrace && (
                <div className="as-trace-body">
                  <ol className="as-steps">
                    {t.steps.map((s, i) => (
                      <li key={i} data-state={s.state ?? "ok"}>{s.detail}</li>
                    ))}
                  </ol>
                  {t.hits.length > 0 && (
                    <ul className="as-hits">
                      {t.hits.slice(0, 8).map((h, i) => (
                        <li key={i}>
                          <span className="as-hit-rank">{h.rank}</span>
                          <span className="as-hit-src">{h.sourceName}</span>
                          <span className="as-hit-verse">{h.verseKey}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {t.error && <p className="as-error"><AlertCircle size={14} aria-hidden /> {t.error}</p>}

            {t.text && (
              <div className="aip-answer">
                {withCitations(t.text, t.cites)}
                {t.running && <span className="as-caret" aria-hidden />}
              </div>
            )}

            {t.sentences.length > 0 && (
              <div className="aip-answer">
                {t.sentences.map((s, i) => (
                  <blockquote key={i} className="as-quote" dir="auto">
                    <p>{s.text}</p>
                    <cite>{s.sourceName} · {s.verseKey}</cite>
                  </blockquote>
                ))}
              </div>
            )}

            {t.warning && <p className="as-warn"><AlertCircle size={14} aria-hidden /> {t.warning}</p>}
            {t.note && <p className="aip-note">{t.note}</p>}
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <div className="aip-composer">
        <input
          ref={inputRef}
          className="aip-input"
          placeholder="Ask about the Qur'an, or search your notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); ask(); } }}
          aria-label="Ask the assistant"
        />
        <button
          className="aip-send" onClick={() => ask()}
          disabled={busy || !q.trim()} aria-label="Send"
        >
          {busy ? <Loader2 size={15} className="rec-spin" aria-hidden /> : <Send size={15} aria-hidden />}
        </button>
      </div>
    </aside>
  );
}
