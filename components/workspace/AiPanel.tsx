"use client";

/**
 * Lab AI — the assistant, docked beside what you are reading.
 *
 * The point of it living here rather than on its own page is context. It knows
 * which sūrah and page you have open and what you have selected, so "what are
 * the main themes here?" has a referent, and it searches your own notes as
 * well as the tafsīr — the two things a standalone chat box cannot do.
 *
 * Laid out as a conversation, not a results page: your message sits in a
 * bubble on the right, the answer arrives on the left behind an avatar, and
 * the retrieval trace collapses into a single line you can open. The earlier
 * version put the trace, the answer and the passages in three equal stacked
 * slabs, which read as a report rather than a reply.
 *
 * Notes are retrieved and cited as "Your note", never as a source. A reader's
 * half-formed thought must not acquire a commentary's authority by appearing
 * in the same numbered list.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles, ArrowUp, X, SquarePen, ChevronDown, AlertCircle,
  Search, BookOpen,
} from "lucide-react";
import { useOverlayMotion } from "@/lib/use-overlay-motion";

interface CiteRef { n: number; sourceName: string; verseKey: string }
interface Step { step: string; detail: string; state?: string }
interface HitRef { sourceName: string; verseKey: string; via: string; rank: number }

interface Turn {
  id: string;
  question: string;
  steps: Step[];
  hits: HitRef[];
  cites: CiteRef[];
  text: string;
  sentences: { text: string; sourceName: string; verseKey: string }[];
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

/* ── Markdown ──────────────────────────────────────────────────────────────
   The model writes markdown — headings, bold, bullet lists — and without this
   the reader just sees the asterisks. Hand-written rather than a library for
   one reason: the output has to interleave with citation chips, so a renderer
   returning opaque HTML would have to be unpicked to put them back. The
   accepted subset is small and entirely known, because we write the prompt
   that produces it. */

type CiteMap = Map<number, CiteRef>;

function inline(text: string, by: CiteMap, k: { i: number }): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  // Bold before italic, so `**x**` is never read as an empty italic pair.
  const re = /\*\*([^*]+?)\*\*|\*([^*\n]+?)\*|`([^`]+?)`|\[(\d{1,2})\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined)      out.push(<strong key={k.i++}>{m[1]}</strong>);
    else if (m[2] !== undefined) out.push(<em key={k.i++}>{m[2]}</em>);
    else if (m[3] !== undefined) out.push(<code key={k.i++}>{m[3]}</code>);
    else {
      const n = Number(m[4]);
      const c = by.get(n);
      out.push(c
        ? <span key={k.i++} className="as-cite"
                title={`${c.sourceName}${c.verseKey ? " — " + c.verseKey : ""}`}>{n}</span>
        : <span key={k.i++} className="as-cite as-cite--bad"
                title="No such passage was retrieved">{m[0]}</span>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function renderMarkdown(text: string, cites: CiteRef[]): React.ReactNode[] {
  const by: CiteMap = new Map(cites.map((c) => [c.n, c]));
  const k = { i: 0 };
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushPara = () => {
    if (!para.length) return;
    blocks.push(<p key={k.i++}>{inline(para.join(" "), by, k)}</p>);
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const items = list.items.map((t) => <li key={k.i++}>{inline(t, by, k)}</li>);
    blocks.push(list.ordered
      ? <ol key={k.i++}>{items}</ol>
      : <ul key={k.i++}>{items}</ul>);
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara(); flushList();
      /* Clamped to h3–h5. This is a panel beside a page that has its own
         title; an h1 in here would out-shout the thing being studied. */
      const level = Math.min(5, heading[1].length + 2);
      const Tag = (`h${level}`) as "h3" | "h4" | "h5";
      blocks.push(<Tag key={k.i++}>{inline(heading[2], by, k)}</Tag>);
      continue;
    }

    // The space after the marker separates a bullet from *italics* opening a
    // line, and from `**Bold:**` opening one.
    const bullet  = /^\s*[*-]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || ordered) {
      flushPara();
      const isOrdered = ordered !== null;
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((bullet ? bullet[1] : ordered![1]).trim());
      continue;
    }

    flushList();
    para.push(line.trim());
  }
  flushPara();
  flushList();
  return blocks;
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AiPanel({ pageId, surahNumber, surahName, onClose }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const busy = turns.some((t) => t.running);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      sentences: [], running: true, openTrace: false,
    }]);
    setQ("");

    const res = await fetch("/api/assistant", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question, history,
        // What you have open. The server treats this as a default that a
        // reference inside the question can override.
        surah: surahNumber,
        surahName,
        pageId,
        includeNotes: true,
      }),
    }).catch(() => null);

    if (!res?.ok || !res.body) {
      patch(id, (t) => ({ ...t, running: false, error: "Could not reach Lab AI." }));
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
            next.running = false;
            if (typeof ev.note === "string") next.note = ev.note;
          }
          return next;
        });
      }
    }
    patch(id, (t) => (t.running ? { ...t, running: false } : t));
  }, [q, busy, turns, surahNumber, surahName, pageId, patch]);

  /* Prompts that only make sense because the panel knows what is open. A
     generic "ask me anything" would not need a page to sit beside. */
  const SUGGESTIONS = [
    `What are the main themes in ${surahName}?`,
    "Summarise my notes on this page",
    "Explain this passage simply",
  ];

  return (
    <aside className="lab" aria-label="Lab AI">
      <header className="lab-head">
        <span className="lab-brand">Lab AI</span>
        <span className="lab-chip" title="What Lab AI is looking at">
          <BookOpen size={11} aria-hidden /> {surahName}
        </span>
        <span className="lab-head-sp" />
        <button className="lab-icon" onClick={() => setTurns([])}
                title="New chat" aria-label="New chat">
          <SquarePen size={15} />
        </button>
        <button className="lab-icon" onClick={onClose} title="Close" aria-label="Close Lab AI">
          <X size={16} />
        </button>
      </header>

      <div className="lab-body">
        {turns.length === 0 && (
          <div className="lab-empty">
            <span className="lab-empty-mark" aria-hidden><Sparkles size={22} /></span>
            <p className="lab-empty-title">Lab AI</p>
            <p className="lab-empty-sub">
              Ask about any verse or search your notes. Every answer is drawn from
              the tafsīr in your library and cites what it used.
            </p>
            <div className="lab-suggest">
              {SUGGESTIONS.map((sg, i) => (
                <button key={sg} style={{ animationDelay: `${90 + i * 60}ms` }}
                        onClick={() => ask(sg)}>{sg}</button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t) => (
          <article key={t.id} className="lab-turn">
            <div className="lab-row lab-row--you">
              <p className="lab-bubble lab-bubble--you">{t.question}</p>
            </div>

            <div className="lab-row lab-row--ai">
              <span className="lab-avatar" aria-hidden><Sparkles size={14} /></span>

              <div className="lab-said">
                {t.running && !t.text && t.sentences.length === 0 ? (
                  <div className="lab-bubble lab-thinking" role="status">
                    <span className="lab-dots" aria-hidden><i /><i /><i /></span>
                    <span>Thinking…</span>
                  </div>
                ) : (
                  <>
                    {(t.hits.length > 0 || t.steps.length > 0) && (
                      <Trace turn={t} onToggle={() =>
                        patch(t.id, (x) => ({ ...x, openTrace: !x.openTrace }))} />
                    )}

                    {t.error && (
                      <p className="lab-bubble lab-error">
                        <AlertCircle size={14} aria-hidden /> {t.error}
                      </p>
                    )}

                    {t.text && (
                      <div className="lab-bubble lab-answer">
                        {renderMarkdown(t.text, t.cites)}
                        {t.running && <span className="as-caret" aria-hidden />}
                      </div>
                    )}

                    {t.sentences.length > 0 && (
                      <div className="lab-bubble lab-answer">
                        {t.sentences.map((s, i) => (
                          <blockquote key={i} className="as-quote" dir="auto">
                            <p>{s.text}</p>
                            <cite>{s.sourceName} · {s.verseKey}</cite>
                          </blockquote>
                        ))}
                      </div>
                    )}

                    {t.warning && (
                      <p className="lab-warn">
                        <AlertCircle size={13} aria-hidden /> {t.warning}
                      </p>
                    )}
                    {t.note && <p className="lab-note">{t.note}</p>}
                  </>
                )}
              </div>
            </div>
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <div className="lab-composer">
        <textarea
          ref={inputRef}
          className="lab-input"
          rows={1}
          placeholder="Ask about the Qur'an, or search your notes…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            // Grow with the question, up to a point — a long paste should not
            // push the conversation off screen.
            const el = e.target;
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 132) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); }
          }}
          aria-label="Ask Lab AI"
        />
        <button
          className="lab-send" onClick={() => ask()}
          disabled={busy || !q.trim()} aria-label="Send"
        >
          <ArrowUp size={15} aria-hidden />
        </button>
      </div>
    </aside>
  );
}

/** The retrieval trace: one line by default, the working underneath if asked. */
function Trace({ turn, onToggle }: { turn: Turn; onToggle: () => void }) {
  const { mounted, state } = useOverlayMotion(turn.openTrace, 160);
  return (
    <div className="lab-trace" data-open={turn.openTrace ? "true" : "false"}>
      <button className="lab-trace-head" onClick={onToggle} aria-expanded={turn.openTrace}>
        <Search size={12} aria-hidden />
        <span>
          {/* Three states, not two. A greeting retrieves nothing and finishes,
              so "Searching…" with no count left the line reading as though it
              were still working long after the answer had arrived. */}
          {turn.hits.length > 0
            ? `Searched ${turn.hits.length} source${turn.hits.length === 1 ? "" : "s"}`
            : turn.running
              ? "Searching…"
              : "Answered without sources"}
        </span>
        <ChevronDown size={13} aria-hidden className="lab-trace-chev" />
      </button>
      {mounted && (
        <div className="lab-trace-body" data-state={state}>
          <ol className="lab-steps">
            {turn.steps.map((s, i) => (
              <li key={i} data-state={s.state ?? "ok"}>{s.detail}</li>
            ))}
          </ol>
          {turn.hits.length > 0 && (
            <ul className="lab-hits">
              {turn.hits.slice(0, 8).map((h, i) => (
                <li key={i}>
                  <span className="lab-hit-rank">{h.rank}</span>
                  <span className="lab-hit-src">{h.sourceName}</span>
                  <span className="lab-hit-verse">{h.verseKey}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
