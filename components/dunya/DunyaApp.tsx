"use client";

/**
 * Dunya — the A-level subjects, their papers, and how each one went.
 *
 * Pick a subject from the tiles; each paper opens to its downloads, a form
 * to log a score, the date it was done and a traffic-light confidence, and
 * every attempt so far. A paper's colour is its latest attempt's confidence,
 * so a subject's bar shows at a glance what is still red.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import {
  CONFIDENCE, type Attempt, type Catalog, type Confidence, type Paper, type Progress, type Subject,
} from "@/lib/dunya/catalog";

const today = () => new Date().toLocaleDateString("en-CA");
const pct = (a: Attempt) => Math.round((a.score / a.marks) * 100);
const dateLabel = (d: string) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const latest = (list: Attempt[] | undefined) => list?.length ? list[list.length - 1] : undefined;
const labelOf = (c: Confidence) => CONFIDENCE.find((x) => x.value === c)!.label;
const fileHref = (key: string) => `/api/dunya/file?key=${encodeURIComponent(key)}`;
const minutes = (m: number) => m % 60 === 0 && m >= 120 ? `${m / 60} hours` : `${m} min`;

function summary(s: Subject, attempts: Progress["attempts"]) {
  const papers = s.groups.flatMap((g) => g.papers);
  const last = papers.map((p) => latest(attempts[p.id])).filter((a): a is Attempt => !!a);
  const count = (c: Confidence) => last.filter((a) => a.confidence === c).length;
  return {
    total: papers.length,
    done: last.length,
    average: last.length ? Math.round(last.reduce((n, a) => n + pct(a), 0) / last.length) : null,
    green: count("green"), amber: count("amber"), red: count("red"),
  };
}

export default function DunyaApp({ catalog, progress }: { catalog: Catalog; progress: Progress }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(progress.attempts);
  const [subjectId, setSubjectId] = useState(catalog.subjects[0]?.id ?? "");
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    // The subject you last had open, kept in this browser.
    try {
      const s = localStorage.getItem("tl-dunya-subject");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (s && catalog.subjects.some((x) => x.id === s)) setSubjectId(s);
    } catch { /* private mode */ }
  }, [catalog.subjects]);
  const pick = (id: string) => {
    setSubjectId(id);
    try { localStorage.setItem("tl-dunya-subject", id); } catch { /* private mode */ }
  };

  const subject = catalog.subjects.find((s) => s.id === subjectId) ?? catalog.subjects[0];
  const sums = useMemo(
    () => new Map(catalog.subjects.map((s) => [s.id, summary(s, attempts)])),
    [catalog.subjects, attempts],
  );

  async function lock() {
    await fetch("/api/dunya/unlock", { method: "DELETE" }).catch(() => null);
    router.refresh();
  }

  async function log(paper: Paper, input: { score: number; date: string; confidence: Confidence }) {
    const r = await fetch("/api/dunya/attempts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId: paper.id, ...input }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => null) as { attempt?: Attempt; error?: string } | null : null;
    if (!r?.ok || !d?.attempt) {
      setToast({ msg: d?.error ?? "Couldn’t save that. Check your connection.", tone: "error" });
      return false;
    }
    setAttempts((m) => ({
      ...m, [paper.id]: [...(m[paper.id] ?? []), d.attempt!].sort((a, b) => a.date.localeCompare(b.date)),
    }));
    setToast({ msg: `Logged ${d.attempt.score}/${d.attempt.marks} for ${paper.title}.`, tone: "success" });
    return true;
  }

  async function remove(paper: Paper, a: Attempt) {
    const r = await fetch("/api/dunya/attempts", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paperId: paper.id, id: a.id }),
    }).catch(() => null);
    if (!r?.ok) { setToast({ msg: "Couldn’t remove that. Check your connection.", tone: "error" }); return; }
    setAttempts((m) => ({ ...m, [paper.id]: (m[paper.id] ?? []).filter((x) => x.id !== a.id) }));
  }

  return (
    <>
      <header className="dn-nav">
        <span className="dn-brand"><span className="dn-mark" aria-hidden="true">T</span>Dunya</span>
        <button type="button" className="dn-link" onClick={lock}>Lock</button>
      </header>

      <main className="dn-main">
        <section className="dn-hero">
          <h1 className="dn-display">A levels.</h1>
          <p className="dn-sub">Biology, Chemistry and Maths. Every paper, its answers, and how it went.</p>
        </section>

        <nav className="dn-subjects" aria-label="Subjects">
          {catalog.subjects.map((s) => {
            const m = sums.get(s.id)!;
            return (
              <button
                key={s.id} type="button" className="dn-subject" aria-pressed={s.id === subject?.id}
                onClick={() => pick(s.id)}
              >
                <span className="dn-subject-name">{s.name}</span>
                <span className="dn-subject-board">{[s.board, s.level].filter(Boolean).join(" · ")}</span>
                <Bar {...m} />
                <span className="dn-subject-count">
                  {m.total === 0 ? "No papers yet" : `${m.done} of ${m.total} done${m.average != null ? ` · ${m.average}% average` : ""}`}
                </span>
              </button>
            );
          })}
        </nav>

        {subject && <SubjectView key={subject.id} subject={subject} attempts={attempts} sum={sums.get(subject.id)!} onLog={log} onRemove={remove} />}
      </main>

      <Toast message={toast?.msg ?? null} tone={toast?.tone} onDismiss={() => setToast(null)} />
    </>
  );
}

function Bar({ total, green, amber, red }: { total: number; green: number; amber: number; red: number }) {
  if (!total) return <span className="dn-bar" aria-hidden="true" />;
  return (
    <span className="dn-bar" role="img" aria-label={`${green} confident, ${amber} getting there, ${red} not yet, ${total - green - amber - red} not done`}>
      <i data-c="green" style={{ flexGrow: green }} />
      <i data-c="amber" style={{ flexGrow: amber }} />
      <i data-c="red" style={{ flexGrow: red }} />
      <i style={{ flexGrow: total - green - amber - red }} />
    </span>
  );
}

function SubjectView({ subject, attempts, sum, onLog, onRemove }: {
  subject: Subject; attempts: Progress["attempts"]; sum: ReturnType<typeof summary>;
  onLog: (p: Paper, i: { score: number; date: string; confidence: Confidence }) => Promise<boolean>;
  onRemove: (p: Paper, a: Attempt) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="dn-subject-view">
      <header className="dn-sv-head">
        <div>
          <h2 className="dn-h2">{subject.name}.</h2>
          <p className="dn-sv-board">{[subject.board, subject.level].filter(Boolean).join(" · ")}</p>
        </div>
        {subject.all.length > 0 && (
          <div className="dn-alls">
            {subject.all.map((f) => <a key={f.key} className="dn-chev" href={fileHref(f.key)}>{f.label} <Arrow /></a>)}
          </div>
        )}
      </header>

      {sum.total === 0 ? (
        <div className="dn-empty">
          <p className="dn-empty-title">No {subject.name.toLowerCase()} papers yet.</p>
          <p>They’ll be here as soon as they’re added.</p>
        </div>
      ) : (
        <>
          <dl className="dn-stats">
            <div><dt>Done</dt><dd>{sum.done}<small> of {sum.total}</small></dd></div>
            <div><dt>Average</dt><dd>{sum.average != null ? <>{sum.average}<small>%</small></> : "–"}</dd></div>
            {CONFIDENCE.slice().reverse().map((c) => (
              <div key={c.value}><dt><i className="dn-dot" data-c={c.value} />{c.label}</dt><dd>{sum[c.value]}</dd></div>
            ))}
          </dl>

          {subject.groups.map((g) => (
            <div className="dn-group" key={g.name}>
              <h3 className="dn-group-name">{g.name}</h3>
              <ul className="dn-papers">
                {g.papers.map((p) => (
                  <PaperRow
                    key={p.id} paper={p} attempts={attempts[p.id] ?? []}
                    open={open === p.id} onToggle={() => setOpen((o) => (o === p.id ? null : p.id))}
                    onLog={onLog} onRemove={onRemove}
                  />
                ))}
              </ul>
            </div>
          ))}
        </>
      )}
    </section>
  );
}

function PaperRow({ paper, attempts, open, onToggle, onLog, onRemove }: {
  paper: Paper; attempts: Attempt[]; open: boolean; onToggle: () => void;
  onLog: (p: Paper, i: { score: number; date: string; confidence: Confidence }) => Promise<boolean>;
  onRemove: (p: Paper, a: Attempt) => void;
}) {
  const last = latest(attempts);
  const bodyId = `dn-p-${paper.id}`;
  return (
    <li className="dn-paper" data-open={open || undefined}>
      <button type="button" className="dn-paper-head" aria-expanded={open} aria-controls={bodyId} onClick={onToggle}>
        <span className="dn-paper-n">{paper.n}</span>
        <span className="dn-paper-main">
          <span className="dn-paper-title">{paper.title}</span>
          <span className="dn-paper-meta">
            {[paper.ref, paper.marks && `${paper.marks} marks`, paper.minutes && minutes(paper.minutes)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span className="dn-paper-result">
          {last ? (
            <><i className="dn-dot" data-c={last.confidence} title={labelOf(last.confidence)} /><b>{last.score}/{last.marks}</b><small>{pct(last)}%</small></>
          ) : <small>Not done</small>}
        </span>
        <svg className="dn-paper-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
      </button>

      {open && (
        <div className="dn-paper-body" id={bodyId}>
          <div className="dn-files">
            {paper.files.map((f) => <a key={f.key} className="dn-file" href={fileHref(f.key)}><Download />{f.label}</a>)}
          </div>
          <LogForm paper={paper} onLog={onLog} />
          {attempts.length > 0 && (
            <ol className="dn-history" aria-label="Attempts">
              {attempts.slice().reverse().map((a) => (
                <li key={a.id}>
                  <span className="dn-h-date">{dateLabel(a.date)}</span>
                  <span className="dn-h-score"><b>{a.score}/{a.marks}</b> {pct(a)}%</span>
                  <span className="dn-h-conf"><i className="dn-dot" data-c={a.confidence} />{labelOf(a.confidence)}</span>
                  <button type="button" className="dn-link dn-h-remove" onClick={() => onRemove(paper, a)} aria-label={`Remove the attempt on ${dateLabel(a.date)}`}>Remove</button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </li>
  );
}

function LogForm({ paper, onLog }: {
  paper: Paper; onLog: (p: Paper, i: { score: number; date: string; confidence: Confidence }) => Promise<boolean>;
}) {
  const marks = paper.marks ?? 100;
  const [score, setScore] = useState("");
  const [date, setDate] = useState(today);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [busy, setBusy] = useState(false);
  const n = Number(score);
  const valid = score.trim() !== "" && Number.isFinite(n) && n >= 0 && n <= marks;
  const ready = valid && !!date && !!confidence && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    const ok = await onLog(paper, { score: n, date, confidence: confidence! });
    setBusy(false);
    if (ok) { setScore(""); setConfidence(null); setDate(today()); }
  }

  return (
    <form className="dn-log" onSubmit={submit}>
      <p className="dn-log-title">Log an attempt</p>
      <div className="dn-log-row">
        <label className="dn-in dn-in-score">
          <span>Score</span>
          <span className="dn-in-box">
            <input
              type="number" inputMode="decimal" min={0} max={marks} step={0.5} placeholder="0" aria-label={`Score out of ${marks}`}
              value={score} onChange={(e) => setScore(e.target.value)} aria-invalid={score !== "" && !valid}
            />
            <span className="dn-in-of">/ {marks}</span>
          </span>
          <small>{valid ? `${Math.round((n / marks) * 100)}%` : score ? `0 to ${marks}` : " "}</small>
        </label>
        <label className="dn-in dn-in-date">
          <span>Completed</span>
          <span className="dn-in-box"><input type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} /></span>
          <small> </small>
        </label>
      </div>
      <div className="dn-conf" role="radiogroup" aria-label="Confidence">
        {CONFIDENCE.map((c) => (
          <button
            key={c.value} type="button" role="radio" aria-checked={confidence === c.value} data-c={c.value}
            onClick={() => setConfidence(c.value)}
          >
            <i className="dn-dot" data-c={c.value} />{c.label}
          </button>
        ))}
      </div>
      <button type="submit" className="dn-btn" disabled={!ready}>{busy ? "Saving…" : "Save"}</button>
    </form>
  );
}

const Download = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></svg>
);
const Arrow = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v13M6 12l6 6 6-6" /></svg>
);
