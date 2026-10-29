"use client";

/**
 * The organiser's desk. Everything that used to need a code change: sessions,
 * prep packs, takeaways, recordings, the running order, research assignments,
 * the cohort, the announcement. Plus the readiness board — who has written
 * what for the next session, in counts only, never the writing itself.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { MemberView, SessionView, AssignmentView, Settings } from "@/lib/youth-majlis/data";

/** The same words the portal uses, without importing server code. */
function scopeText(s: SessionView): string | null {
  if (s.studyBy === "points") {
    if (!s.pointFrom) return "The ten points";
    return s.pointTo && s.pointTo !== s.pointFrom ? `Points ${s.pointFrom}–${s.pointTo}` : `Point ${s.pointFrom}`;
  }
  if (!s.ayahFrom) return null;
  return s.ayahTo && s.ayahTo !== s.ayahFrom ? `Āyāt ${s.ayahFrom}–${s.ayahTo}` : `Āyah ${s.ayahFrom}`;
}

type Mod = { n: number; surahEn: string; surah: number };

/** The ten points, as the cohort titles its tabs. */
const POINTS = [
  "1. Names of The Surah", "2. Merits and Virtues", "3. Time of Revelation", "4. Reason for Revelation",
  "5. Language and Style", "6. Structure and Order", "7. Core Message", "8. Jurisprudential Rulings",
  "9. Personal Reflections", "10. Actions Plan",
];

/** The running order from the cohort's own plan for the evening. */
const STANDARD_AGENDA = [
  ["17:30", "Qur’an and opening"], ["17:45", "Student research"], ["18:45", "Shaykh’s discussion"],
  ["19:30", "Break"], ["19:45", "Tadabbur"], ["20:30", "Contemporary application"], ["20:55", "Closing"],
].map(([time, item]) => `${time} ${item}`).join("\n");

async function act(body: Record<string, unknown>): Promise<string | null> {
  const r = await fetch("/api/youth-majlis/organise", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  }).catch(() => null);
  if (r?.ok) return null;
  const d = await r?.json().catch(() => null) as { error?: string } | null;
  return d?.error ?? "Couldn’t save. Check your connection.";
}

const fmt = (d: string | null) => d
  ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" }).format(new Date(`${d}T12:00:00Z`))
  : "No date yet";

export default function OrganiserApp({
  sessions, members, modules, tabTitles, nextId, readinessFor, settings, meId,
}: {
  sessions: SessionView[]; members: MemberView[]; modules: Mod[]; tabTitles: string[];
  nextId: string | null; readinessFor: Mod; settings: Settings; meId: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const run = async (body: Record<string, unknown>, ok: string) => {
    const err = await act(body);
    setMsg(err ? { text: err, bad: true } : { text: ok });
    if (!err) router.refresh();
    return !err;
  };

  const active = members.filter((m) => m.role !== "left");
  const removed = members.filter((m) => m.role === "left");
  const next = sessions.find((s) => s.id === nextId) ?? null;

  return (
    <div className="og">
      {msg && (
        <div className={`og-toast${msg.bad ? " og-toast--bad" : ""}`} role="status" onAnimationEnd={() => !msg.bad && setMsg(null)}>
          {msg.text}
          <button onClick={() => setMsg(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* ── Readiness ── */}
      <section className="og-sec" aria-labelledby="og-ready">
        <h2 id="og-ready" className="og-h">Who’s ready.</h2>
        <p className="og-sub">
          {next ? <>For <strong>{fmt(next.date)}</strong>, Sūrah {readinessFor.surahEn}. </> : <>Sūrah {readinessFor.surahEn}. </>}
          Each dot is one of the ten points in the student’s own workspace: filled once it has real writing, half when started. Counts only. You never see what anyone wrote.
        </p>
        {active.length === 0 ? (
          <p className="og-empty">Nobody has joined yet. Students join the first time they open the portal signed in to TafsirLab.</p>
        ) : (
          <div className="og-grid-wrap">
            <table className="og-grid">
              <thead>
                <tr>
                  <th scope="col">Student</th>
                  {tabTitles.map((t, i) => <th key={t} scope="col" title={t}>{i + 1}</th>)}
                  <th scope="col">Written</th>
                  {next && <th scope="col">Assigned</th>}
                </tr>
              </thead>
              <tbody>
                {active.map((m) => {
                  const written = m.tabs.filter((t) => t.state === "written").length;
                  const mine = next?.assignments.filter((a) => a.assignees.some((x) => x.userId === m.userId)) ?? [];
                  return (
                    <tr key={m.userId}>
                      <th scope="row">{m.name}{m.role === "organiser" && <span className="og-role">organiser</span>}</th>
                      {m.tabs.map((t) => (
                        <td key={t.n}><span className="og-dot" data-state={t.state} title={`${t.title}: ${t.words} words${t.notes ? `, ${t.notes} notes` : ""}`} /></td>
                      ))}
                      <td className="og-num">{m.workspaceId ? `${written}/10` : <span className="og-muted">not opened</span>}</td>
                      {next && (
                        <td>{mine.length
                          ? mine.map((a) => <span key={a.id} className="og-chip">{a.point ? `${a.point}. ${tabTitles[a.point - 1].replace(/^\d+\.\s*/, "")}` : a.ayahFrom ? `Āyāt ${a.ayahFrom}–${a.ayahTo ?? a.ayahFrom}` : "Research"}</span>)
                          : <span className="og-muted">none</span>}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Sessions ── */}
      <section className="og-sec" aria-labelledby="og-sessions">
        <h2 id="og-sessions" className="og-h">Sessions.</h2>
        <p className="og-sub">Dates, venue, the prep pack, and afterwards the takeaways and recording. The portal shows whatever you put here.</p>
        {modules.map((mod) => (
          <div key={mod.n} className="og-mod">
            <h3 className="og-mod-h">{mod.n}. Sūrah {mod.surahEn}</h3>
            {sessions.filter((s) => s.moduleN === mod.n).map((s) => (
              <SessionRow key={s.id} s={s} isNext={s.id === nextId} run={run} />
            ))}
            <AddSession moduleN={mod.n} run={run} />
          </div>
        ))}
      </section>

      {/* ── Assignments ── */}
      <section className="og-sec" aria-labelledby="og-assign">
        <h2 id="og-assign" className="og-h">Research assignments.</h2>
        <p className="og-sub">Give one of the ten points, an āyah range, or both, to one student or a group. They see it on their portal, with how far they’ve got.</p>
        <Assignments sessions={sessions} members={active} tabTitles={tabTitles} defaultSession={nextId} run={run} />
      </section>

      {/* ── Cohort ── */}
      <section className="og-sec" aria-labelledby="og-cohort">
        <h2 id="og-cohort" className="og-h">The cohort.</h2>
        <p className="og-sub">Anyone who opens the portal signed in to TafsirLab joins as a student. Click a name to change it; it changes on their TafsirLab account too. Organisers can edit everything on this page.</p>
        <ul className="og-members">
          {active.map((m) => (
            <li key={m.userId}>
              <MemberName member={m} run={run} />
              <span className="og-member-mail">{m.email}</span>
              <select
                value={m.role}
                aria-label={`Role for ${m.name}`}
                onChange={(e) => run({ action: "member.role", userId: m.userId, role: e.target.value }, `${m.name} is now a ${e.target.value}.`)}
              >
                <option value="student">Student</option>
                <option value="organiser">Organiser</option>
              </select>
              {m.userId === meId ? <span className="og-muted">you</span> : (
                <button type="button" className="og-remove" aria-label={`Remove ${m.name} from the cohort`} title="Remove from the cohort"
                        onClick={() => run({ action: "member.role", userId: m.userId, role: "left" }, `${m.name} was removed. You can put them back under Removed.`)}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        {removed.length > 0 && (
          <details className="og-removed">
            <summary>Removed ({removed.length})</summary>
            <p className="og-sub">They can still open the portal, but they aren’t in the cohort, its readiness board or its shared workspace.</p>
            <ul className="og-members">
              {removed.map((m) => (
                <li key={m.userId} data-left="">
                  <span className="og-member-name">{m.name}</span>
                  <span className="og-member-mail">{m.email}</span>
                  <button type="button" className="og-link-btn"
                          onClick={() => run({ action: "member.role", userId: m.userId, role: "student" }, `${m.name} is back in the cohort.`)}>
                    Put back
                  </button>
                  <span />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* ── Settings ── */}
      <section className="og-sec" aria-labelledby="og-settings">
        <h2 id="og-settings" className="og-h">Portal.</h2>
        <Announcement initial={settings.announcement ?? ""} run={run} />
        <div className="og-card">
          <h3 className="og-card-h">Shared cohort workspace</h3>
          {settings.cohortWorkspaceId ? (
            <p className="og-sub">Assigned research opens here, so the Majlis can go through everyone’s findings together. Everyone in the cohort is a member. <a className="og-link" href={`/workspaces/${settings.cohortWorkspaceId}`}>Open it</a></p>
          ) : (
            <>
              <p className="og-sub">Not made yet. Until it is, assigned research opens in each student’s own workspace. Making it adds everyone in the cohort as a member.</p>
              <button className="og-btn" onClick={() => run({ action: "cohort.create" }, "Shared cohort workspace made.")}>Make the shared workspace</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Session editing ─────────────────────────────────────────────────────────

function SessionRow({ s, isNext, run }: { s: SessionView; isNext: boolean; run: (b: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="og-row" data-open={open ? "" : undefined}>
      <button className="og-row-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="og-row-n">Session {s.seq}</span>
        <span className="og-row-date">{fmt(s.date)}</span>
        <span className="og-row-meta">
          {isNext && <span className="og-chip og-chip--accent">Next</span>}
          {scopeText(s) && <span className="og-chip">{scopeText(s)}</span>}
          {s.takeaways.length > 0 && <span className="og-chip">{s.takeaways.length} takeaways</span>}
          {s.recordingUrl && <span className="og-chip">Recording</span>}
          {s.prep.length > 0 && <span className="og-chip">Prep pack</span>}
          {!s.date && <span className="og-chip og-chip--warn">Needs a date</span>}
        </span>
        <span className="og-row-chev" aria-hidden>›</span>
      </button>
      {open && <SessionForm s={s} run={run} onDone={() => setOpen(false)} />}
    </div>
  );
}

function AddSession({ moduleN, run }: { moduleN: number; run: (b: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  return open
    ? <div className="og-row" data-open=""><SessionForm moduleN={moduleN} run={run} onDone={() => setOpen(false)} /></div>
    : <button className="og-add" onClick={() => setOpen(true)}>Add a session</button>;
}

function SessionForm({ s, moduleN, run, onDone }: {
  s?: SessionView; moduleN?: number;
  run: (b: Record<string, unknown>, ok: string) => Promise<boolean>; onDone: () => void;
}) {
  const [f, setF] = useState({
    date: s?.date ?? "", startTime: s?.startTime ?? "17:30", endTime: s?.endTime ?? "21:00", venue: s?.venue ?? "",
    ayahFrom: s?.ayahFrom?.toString() ?? "", ayahTo: s?.ayahTo?.toString() ?? "",
    studyBy: s?.studyBy ?? "ayat", pointFrom: s?.pointFrom?.toString() ?? "1", pointTo: s?.pointTo?.toString() ?? "10",
    prep: (s?.prep ?? []).map((p) => p.text).join("\n"), prepDue: s?.prepDue ?? "",
    takeaways: (s?.takeaways ?? []).join("\n"), recordingUrl: s?.recordingUrl ?? "", followUp: s?.followUp ?? "",
    agenda: (s?.agenda ?? []).map((a) => `${a.time} ${a.item}`.trim()).join("\n"),
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const split = (t: string) => t.split("\n").map((x) => x.trim()).filter(Boolean);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await run({
      action: "session.save", id: s?.id, moduleN: s?.moduleN ?? moduleN,
      date: f.date || null, startTime: f.startTime || null, endTime: f.endTime || null, venue: f.venue,
      ayahFrom: f.studyBy === "ayat" ? f.ayahFrom || null : null,
      ayahTo: f.studyBy === "ayat" ? f.ayahTo || null : null,
      studyBy: f.studyBy,
      pointFrom: f.studyBy === "points" ? f.pointFrom || null : null,
      pointTo: f.studyBy === "points" ? f.pointTo || null : null,
      prep: split(f.prep), prepDue: f.prepDue || null, takeaways: split(f.takeaways),
      recordingUrl: f.recordingUrl, followUp: f.followUp,
      agenda: split(f.agenda).map((l) => { const m = /^(\d{1,2}:\d{2})\s+(.*)$/.exec(l); return m ? { time: m[1].padStart(5, "0"), item: m[2] } : { time: "", item: l }; }),
    }, s ? "Session saved." : "Session added.");
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form className="og-form" onSubmit={save}>
      <div className="og-fields og-fields--4">
        <label>Date<input type="date" value={f.date} onChange={set("date")} /></label>
        <label>Starts<input type="time" value={f.startTime} onChange={set("startTime")} /></label>
        <label>Ends<input type="time" value={f.endTime} onChange={set("endTime")} /></label>
        <label>Venue<input value={f.venue} onChange={set("venue")} placeholder="Postcode or place" /></label>
      </div>
      <div className="og-by" role="radiogroup" aria-label="How this session goes through the sūrah">
        <span className="og-by-label">Go through it</span>
        <button type="button" role="radio" aria-checked={f.studyBy === "ayat"} onClick={() => setF({ ...f, studyBy: "ayat" })}>Āyah by āyah</button>
        <button type="button" role="radio" aria-checked={f.studyBy === "points"} onClick={() => setF({ ...f, studyBy: "points" })}>Point by point (1–10)</button>
      </div>
      <div className="og-fields og-fields--4">
        {f.studyBy === "ayat" ? (
          <>
            <label>From āyah<input inputMode="numeric" value={f.ayahFrom} onChange={set("ayahFrom")} /></label>
            <label>To āyah<input inputMode="numeric" value={f.ayahTo} onChange={set("ayahTo")} /></label>
          </>
        ) : (
          <>
            <label>From point
              <select value={f.pointFrom} onChange={set("pointFrom")}>
                {POINTS.map((t, i) => <option key={t} value={i + 1}>{t}</option>)}
              </select>
            </label>
            <label>To point
              <select value={f.pointTo} onChange={set("pointTo")}>
                {POINTS.map((t, i) => <option key={t} value={i + 1}>{t}</option>)}
              </select>
            </label>
          </>
        )}
        <label className="og-span2">Prep due by<input type="date" value={f.prepDue} onChange={set("prepDue")} /></label>
      </div>
      <label>Prep pack <span>One item per line: what to read, listen to or bring.</span>
        <textarea rows={4} value={f.prep} onChange={set("prep")} placeholder={"Read 61:1–9 twice, with the translation\nTafsīr al-Saʿdī on 61:4"} />
      </label>
      <label>Running order for the evening <span>One per line, starting with the time.</span>
        <textarea rows={4} value={f.agenda} onChange={set("agenda")} placeholder="17:30 Qur’an and opening" />
      </label>
      {!f.agenda && <button type="button" className="og-link-btn" onClick={() => setF({ ...f, agenda: STANDARD_AGENDA })}>Use the standard running order</button>}
      <label>Shaykh’s takeaways <span>After the session. One point per line, three to seven is ideal.</span>
        <textarea rows={4} value={f.takeaways} onChange={set("takeaways")} />
      </label>
      <div className="og-fields og-fields--2">
        <label>Recording link<input value={f.recordingUrl} onChange={set("recordingUrl")} placeholder="https://" /></label>
        <label>Follow-up<input value={f.followUp} onChange={set("followUp")} placeholder="Something to do before next time" /></label>
      </div>
      <div className="og-form-actions">
        <button className="og-btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        <button className="og-link-btn" type="button" onClick={onDone}>Cancel</button>
        {s && (
          <button className="og-link-btn og-danger" type="button"
            onClick={() => { if (confirm(`Delete session ${s.seq}? Its assignments go with it.`)) void run({ action: "session.delete", id: s.id }, "Session deleted.").then((ok) => ok && onDone()); }}>
            Delete session
          </button>
        )}
      </div>
    </form>
  );
}

// ── Assignments ─────────────────────────────────────────────────────────────

/** A member's name, which turns into a field when clicked. Enter saves, Escape leaves it. */
function MemberName({ member, run }: {
  member: MemberView; run: (body: Record<string, unknown>, ok: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(member.name);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) field.current?.select(); }, [editing]);

  const save = async () => {
    const name = value.trim();
    if (!name || name === member.name) { setValue(member.name); setEditing(false); return; }
    if (await run({ action: "member.rename", userId: member.userId, name }, `${member.name} is now ${name}.`)) setEditing(false);
  };

  if (!editing) {
    return (
      <button type="button" className="og-member-name og-member-edit" onClick={() => { setValue(member.name); setEditing(true); }}
              title="Change their name">
        {member.name}
      </button>
    );
  }
  return (
    <input ref={field} className="og-member-input" value={value} maxLength={80} aria-label={`New name for ${member.name}`}
           onChange={(e) => setValue(e.target.value)}
           onBlur={() => void save()}
           onKeyDown={(e) => {
             if (e.key === "Enter") { e.preventDefault(); void save(); }
             if (e.key === "Escape") { setValue(member.name); setEditing(false); }
           }} />
  );
}

function Assignments({ sessions, members, tabTitles, defaultSession, run }: {
  sessions: SessionView[]; members: MemberView[]; tabTitles: string[]; defaultSession: string | null;
  run: (b: Record<string, unknown>, ok: string) => Promise<boolean>;
}) {
  const [sid, setSid] = useState(defaultSession ?? sessions[sessions.length - 1]?.id ?? "");
  const s = sessions.find((x) => x.id === sid);
  const [editing, setEditing] = useState<AssignmentView | "new" | null>(null);
  const status = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);

  return (
    <div>
      <label className="og-inline">Session
        <select value={sid} onChange={(e) => { setSid(e.target.value); setEditing(null); }}>
          {sessions.map((x) => <option key={x.id} value={x.id}>{x.surahEn}, session {x.seq} · {fmt(x.date)}</option>)}
        </select>
      </label>
      {s && (
        <ul className="og-assign">
          {s.assignments.length === 0 && <li className="og-empty">No research set for this session yet.</li>}
          {s.assignments.map((a) => (
            <li key={a.id}>
              <div className="og-assign-what">
                <strong>{a.point ? tabTitles[a.point - 1] : "Research"}</strong>
                {a.ayahFrom && <span> · Āyāt {a.ayahFrom}–{a.ayahTo ?? a.ayahFrom}</span>}
                {a.due && <span className="og-muted"> · due {fmt(a.due)}</span>}
                {a.note && <p className="og-muted">{a.note}</p>}
              </div>
              <div className="og-assign-who">
                {a.assignees.map((x) => {
                  const t = a.point ? status.get(x.userId)?.tabs.find((tt) => tt.n === a.point) : undefined;
                  return <span key={x.userId} className="og-chip" data-state={t?.state}>{x.name}{t ? ` · ${t.words}w` : ""}</span>;
                })}
              </div>
              <button className="og-link-btn" onClick={() => setEditing(a)}>Edit</button>
            </li>
          ))}
        </ul>
      )}
      {editing
        ? <AssignmentForm key={editing === "new" ? "new" : editing.id} sessionId={sid} a={editing === "new" ? undefined : editing}
            members={members} tabTitles={tabTitles} run={run} onDone={() => setEditing(null)} />
        : s && <button className="og-add" onClick={() => setEditing("new")}>Set research for this session</button>}
    </div>
  );
}

function AssignmentForm({ sessionId, a, members, tabTitles, run, onDone }: {
  sessionId: string; a?: AssignmentView; members: MemberView[]; tabTitles: string[];
  run: (b: Record<string, unknown>, ok: string) => Promise<boolean>; onDone: () => void;
}) {
  const [point, setPoint] = useState(a?.point?.toString() ?? "");
  const [from, setFrom] = useState(a?.ayahFrom?.toString() ?? "");
  const [to, setTo] = useState(a?.ayahTo?.toString() ?? "");
  const [note, setNote] = useState(a?.note ?? "");
  const [due, setDue] = useState(a?.due ?? "");
  const [who, setWho] = useState<Set<string>>(new Set(a?.assignees.map((x) => x.userId) ?? []));
  const [busy, setBusy] = useState(false);
  const toggle = (id: string) => setWho((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await run({
      action: "assignment.save", id: a?.id, sessionId, point: point || null, ayahFrom: from || null, ayahTo: to || null,
      note, due: due || null, userIds: [...who],
    }, a ? "Assignment saved." : "Research set.");
    setBusy(false);
    if (ok) onDone();
  }

  return (
    <form className="og-form" onSubmit={save}>
      <div className="og-fields og-fields--4">
        <label className="og-span2">Point
          <select value={point} onChange={(e) => setPoint(e.target.value)}>
            <option value="">No particular point</option>
            {tabTitles.map((t, i) => <option key={t} value={i + 1}>{t}</option>)}
          </select>
        </label>
        <label>From āyah<input inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To āyah<input inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="og-fields og-fields--2">
        <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything they should focus on" /></label>
        <label>Due<input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
      </div>
      <fieldset className="og-who">
        <legend>Who <span>{who.size > 1 ? `A group of ${who.size}` : who.size === 1 ? "One student" : "Choose one or more"}</span></legend>
        {members.map((m) => (
          <button type="button" key={m.userId} className="og-pick" aria-pressed={who.has(m.userId)} onClick={() => toggle(m.userId)}>{m.name}</button>
        ))}
      </fieldset>
      <div className="og-form-actions">
        <button className="og-btn" type="submit" disabled={busy || who.size === 0}>{busy ? "Saving…" : "Save"}</button>
        <button className="og-link-btn" type="button" onClick={onDone}>Cancel</button>
        {a && (
          <button className="og-link-btn og-danger" type="button"
            onClick={() => { if (confirm("Delete this assignment?")) void run({ action: "assignment.delete", id: a.id }, "Assignment deleted.").then((ok) => ok && onDone()); }}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}

function Announcement({ initial, run }: { initial: string; run: (b: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const [text, setText] = useState(initial);
  return (
    <div className="og-card">
      <h3 className="og-card-h">Announcement</h3>
      <p className="og-sub">Shown at the top of the portal for everyone. Leave it empty to show nothing.</p>
      <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Bring your tafsīr notes printed this week." />
      <div className="og-form-actions">
        <button className="og-btn" onClick={() => run({ action: "settings.save", announcement: text }, text.trim() ? "Announcement posted." : "Announcement cleared.")}>
          {text.trim() ? "Post" : "Clear"}
        </button>
      </div>
    </div>
  );
}
