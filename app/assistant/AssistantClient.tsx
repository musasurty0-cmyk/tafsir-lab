"use client";

/**
 * AssistantClient — the chat, and the visible reasoning behind each answer.
 *
 * The thinking panel is collapsible and shows what actually happened: which
 * step ran, whether the embedding service answered, which editions were
 * searched, and which passage each quoted sentence came from. It is built from
 * the same stream the answer is, so it cannot describe work that did not
 * happen — which is the only way a trace is worth showing.
 *
 * Every sentence in an answer is a quotation. There is no paraphrase anywhere
 * in this component, and the citation beside a sentence is the source it was
 * literally taken from.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown, Sparkles, Send, BookOpen, Search as SearchIcon,
  Languages, Filter, AlertCircle, Loader2,
} from "lucide-react";
import AppShell, { type ShellStreak } from "@/components/AppShell";
import type { SidebarUser } from "@/components/AppSidebar";

interface SourceRow {
  slug: string; name: string; language: string; chunks: number; verses: number;
}

interface Props {
  user:    SidebarUser | null;
  sources: SourceRow[];
  streak:  ShellStreak;
}

// ── Stream shapes ──────────────────────────────────────────────────────────

interface Step { step: string; detail: string; state?: string; pinned?: string[] }
interface HitRef {
  sourceName: string; sourceSlug: string; verseKey: string;
  via: string; rank: number; language: string;
}
interface Sentence { text: string; sourceName: string; sourceSlug: string; verseKey: string }
interface PassageOut {
  chunkId: string; sourceName: string; sourceSlug: string; language: string;
  verseKey: string; content: string; translation: string | null; via: string; rank: number;
}

interface Turn {
  id:        string;
  question:  string;
  pinned:    string[];
  steps:     Step[];
  searched:  string[];
  hits:      HitRef[];
  sentences: Sentence[];
  passages:  PassageOut[];
  note?:     string;
  error?:    string;
  running:   boolean;
  openTrace: boolean;
}

const STEP_ICON: Record<string, typeof BookOpen> = {
  understand: BookOpen,
  embed:      Sparkles,
  search:     SearchIcon,
  select:     Filter,
  translate:  Languages,
  answer:     BookOpen,
};

export default function AssistantClient({ user, sources, streak }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ]         = useState("");
  const [pinned, setPinned] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const busy = turns.some((t) => t.running);

  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [turns]);

  const patch = useCallback((id: string, fn: (t: Turn) => Turn) => {
    setTurns((ts) => ts.map((t) => (t.id === id ? fn(t) : t)));
  }, []);

  const ask = useCallback(async () => {
    const question = q.trim();
    if (!question || busy) return;

    const id = crypto.randomUUID();
    setTurns((ts) => [...ts, {
      id, question, pinned: [...pinned], steps: [], searched: [], hits: [],
      sentences: [], passages: [], running: true,
      // Open while it works, so you can watch; collapsed once the answer is
      // there, so the answer is what you read.
      openTrace: true,
    }]);
    setQ("");

    const res = await fetch("/api/assistant", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, sources: pinned.length ? pinned : undefined }),
    }).catch(() => null);

    if (!res?.ok || !res.body) {
      patch(id, (t) => ({ ...t, running: false, openTrace: false,
        error: "Could not reach the assistant." }));
      return;
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";

    // NDJSON: a chunk can split a line, so hold the remainder until a newline.
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
          if (typeof ev.step === "string") {
            next.steps = [...next.steps, ev as unknown as Step];
          }
          if (ev.sources) {
            const s = ev.sources as { searched: string[]; hits: HitRef[] };
            next.searched = s.searched; next.hits = s.hits;
          }
          if (ev.answer) {
            next.sentences = (ev.answer as { sentences: Sentence[] }).sentences;
          }
          // Array.isArray, not truthiness: a scalar under this key must never
          // be able to replace the list.
          if (Array.isArray(ev.passages)) next.passages = ev.passages as PassageOut[];
          if (ev.error)  next.error = String(ev.error);
          if (ev.done) {
            next.running = false;
            next.openTrace = false;
            if (typeof ev.note === "string") next.note = ev.note;
          }
          return next;
        });
      }
    }

    patch(id, (t) => (t.running ? { ...t, running: false, openTrace: false } : t));
  }, [q, busy, pinned, patch]);

  const togglePin = (slug: string) =>
    setPinned((p) => (p.includes(slug) ? p.filter((x) => x !== slug) : [...p, slug]));

  const ready = sources.length > 0;

  return (
    <AppShell user={user} streak={streak}>
      <section className="as-head">
        <h1 className="as-title"><Sparkles size={22} aria-hidden /> Study with AI</h1>
        <p className="an-muted">
          Every answer is quoted from the tafsīr in this library. It cannot use the
          web, and it will say it found nothing rather than invent.
        </p>

        <div className="as-pin">
          <button className="an-btn an-btn--ghost an-btn--sm" onClick={() => setPickerOpen((v) => !v)}>
            <Filter size={14} aria-hidden />
            {pinned.length ? `${pinned.length} source${pinned.length === 1 ? "" : "s"} pinned` : "All sources"}
          </button>
          {pinned.length > 0 && (
            <button className="an-link" onClick={() => setPinned([])}>Clear</button>
          )}
        </div>

        {pickerOpen && (
          <div className="as-picker">
            {!ready && (
              <p className="an-muted">
                Nothing is indexed yet. Ingest the tafsīr and run the embedding
                job, and the editions will appear here.
              </p>
            )}
            {sources.map((s) => (
              <button
                key={s.slug} className="as-src"
                data-on={pinned.includes(s.slug) ? "true" : "false"}
                onClick={() => togglePin(s.slug)}
              >
                <span className="as-src-name">{s.name}</span>
                <span className="as-src-meta">
                  {s.language.toUpperCase()} · {s.verses.toLocaleString()} verses
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="as-thread">
        {turns.length === 0 && (
          <div className="an-empty">
            <p className="an-empty-title">Ask about a verse, a theme, or a scholar</p>
            <p className="an-muted">
              &ldquo;What does al-Qurṭubī say about 2:255?&rdquo; · &ldquo;patience in hardship&rdquo; ·
              &ldquo;why was Mūsā given the tablets?&rdquo;
            </p>
          </div>
        )}

        {turns.map((t) => (
          <article key={t.id} className="as-turn">
            <p className="as-q">{t.question}</p>
            {t.pinned.length > 0 && (
              <p className="as-q-pin">Limited to {t.pinned.length} pinned source(s)</p>
            )}

            {/* ── The thinking, collapsible ───────────────────────────── */}
            <div className="as-trace" data-open={t.openTrace ? "true" : "false"}>
              <button
                className="as-trace-head"
                onClick={() => patch(t.id, (x) => ({ ...x, openTrace: !x.openTrace }))}
                aria-expanded={t.openTrace}
              >
                {t.running
                  ? <Loader2 size={15} className="rec-spin" aria-hidden />
                  : <ChevronDown size={15} aria-hidden className="as-trace-chev" />}
                <span>
                  {t.running ? "Working…" : `Searched ${t.searched.length || 0} source${t.searched.length === 1 ? "" : "s"}`}
                </span>
                {!t.running && t.hits.length > 0 && (
                  <span className="as-trace-count">{t.hits.length} passages</span>
                )}
              </button>

              {t.openTrace && (
                <div className="as-trace-body">
                  <ol className="as-steps">
                    {t.steps.map((s, i) => {
                      const Icon = STEP_ICON[s.step] ?? BookOpen;
                      return (
                        <li key={i} data-state={s.state ?? "ok"}>
                          <Icon size={14} aria-hidden />
                          <span>{s.detail}</span>
                        </li>
                      );
                    })}
                  </ol>

                  {t.hits.length > 0 && (
                    <>
                      <p className="as-trace-label">Pulled from</p>
                      <ul className="as-hits">
                        {t.hits.map((h, i) => (
                          <li key={i}>
                            <span className="as-hit-rank">{h.rank}</span>
                            <span className="as-hit-src">{h.sourceName}</span>
                            <span className="as-hit-verse">{h.verseKey}</span>
                            <span className="as-hit-via" data-via={h.via}>{h.via}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>

            {t.error && (
              <p className="as-error"><AlertCircle size={16} aria-hidden /> {t.error}</p>
            )}

            {/* ── The answer: quotations, never paraphrase ────────────── */}
            {t.sentences.length > 0 && (
              <div className="as-answer">
                {t.sentences.map((s, i) => (
                  <blockquote key={i} className="as-quote" dir="auto">
                    <p>{s.text}</p>
                    <cite>{s.sourceName} · {s.verseKey}</cite>
                  </blockquote>
                ))}
              </div>
            )}

            {/* ── Full passages, with translation ─────────────────────── */}
            {t.passages.length > 0 && (
              <details className="as-passages">
                <summary>Full passages ({t.passages.length})</summary>
                {t.passages.map((p) => (
                  <div key={p.chunkId} className="as-passage">
                    <p className="as-passage-head">
                      <strong>{p.sourceName}</strong> · {p.verseKey}
                      <span className="as-hit-via" data-via={p.via}>{p.via}</span>
                    </p>
                    <p className="as-passage-text" dir={p.language === "ar" ? "rtl" : "ltr"}
                       lang={p.language}>
                      {p.content}
                    </p>
                    {p.translation && (
                      <p className="as-passage-tr">
                        <Languages size={13} aria-hidden /> {p.translation}
                      </p>
                    )}
                    {p.language === "ar" && !p.translation && (
                      <p className="as-passage-tr as-passage-tr--none">
                        Translation unavailable — the translation service did not respond.
                      </p>
                    )}
                  </div>
                ))}
              </details>
            )}

            {t.note && <p className="as-note">{t.note}</p>}
          </article>
        ))}
        <div ref={endRef} />
      </div>

      <div className="as-composer">
        <input
          className="as-input"
          placeholder={ready ? "Ask about a verse or a theme…" : "Nothing is indexed yet"}
          value={q}
          disabled={!ready}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(); } }}
          aria-label="Your question"
        />
        <button className="an-btn" onClick={ask} disabled={busy || !q.trim() || !ready}>
          {busy ? <Loader2 size={16} className="rec-spin" aria-hidden /> : <Send size={16} aria-hidden />}
          {busy ? "Thinking" : "Ask"}
        </button>
      </div>
    </AppShell>
  );
}
