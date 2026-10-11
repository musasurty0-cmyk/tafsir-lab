/**
 * /youth-majlis — the Youth Majlis portal.
 *
 * The place the Majlis is run from. It answers, in order: when is the next
 * one, what do I need to have done, how far have I actually got, and what was
 * taught before. Preparation is read from the student's real work in
 * TafsirLab (the ten tabs), sessions and research come from what organisers
 * set at /youth-majlis/organise, and on the evening itself the top of the page
 * turns into the night's running order.
 *
 *   TafsirLab    = where I study the Qur’an.
 *   Youth Majlis = where Shaykh Omid guides my journey through it.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import Gate from "@/components/youth-majlis/Gate";
import LeaveButton from "@/components/youth-majlis/LeaveButton";
import Book3D from "@/components/youth-majlis/Book3D";
import Motion from "@/components/youth-majlis/Motion";
import JourneyRail, { type TileState } from "@/components/youth-majlis/JourneyRail";
import QuestionExplorer from "@/components/youth-majlis/QuestionExplorer";
import IlmiEnter from "@/components/youth-majlis/IlmiEnter";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { getSessionOrNull } from "@/lib/session";
import {
  currentModule, daysUntil, getSessions, getSettings, joinCohort, londonToday, longDate,
  moduleDone, nextSession, sessionPoints, sessionScope, tabStats, writtenCount, type SessionView, type TabStat,
} from "@/lib/youth-majlis/data";
import {
  AIM, AIM_DETAIL, AREAS, COHORT, LEVELS, METHOD, MODULES, QUESTIONS, SHAYKH, TAB_TITLES,
} from "@/lib/youth-majlis/content";

const mapHref = (venue: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
const away = (date: string) => {
  const d = daysUntil(date);
  return d > 1 ? `In ${d} days` : d === 1 ? "Tomorrow" : d === 0 ? "Today" : "";
};
const ayat = (s: { ayahFrom: number | null; ayahTo: number | null }) =>
  s.ayahFrom ? `Āyāt ${s.ayahFrom}${s.ayahTo && s.ayahTo !== s.ayahFrom ? `–${s.ayahTo}` : ""}` : null;
/** "Points 1–5: Names of The Surah to Language and Style." */
function pointsLine(s: SessionView): string | null {
  if (s.studyBy !== "points") return null;
  const pts = [...sessionPoints(s)];
  if (!pts.length) return null;
  const name = (n: number) => TAB_TITLES[n - 1].replace(/^\d+\.\s*/, "");
  return pts.length === 1 ? `${sessionScope(s)}: ${name(pts[0])}` : `${sessionScope(s)}: ${name(pts[0])} to ${name(pts[pts.length - 1])}`;
}
const pointName = (n: number) => TAB_TITLES[n - 1];

/** A heading whose words rise in one after another as it scrolls into view. */
function Words({ text, className, id, as: Tag = "h2" }: {
  text: string; className: string; id?: string; as?: "h1" | "h2";
}) {
  return (
    <Tag id={id} className={className} data-reveal data-words aria-label={text}>
      {text.split(/(\n| )/).map((w, i) =>
        w === "\n" ? <br key={i} /> : w === " " ? " " : (
          <span key={i} className="y-w" aria-hidden style={{ "--wi": i / 2 } as React.CSSProperties}>{w}</span>
        ))}
    </Tag>
  );
}

export default async function YouthMajlisPage() {
  if (!(await hasAccess("majlis"))) {
    return (
      <Gate
        title="Youth Majlis."
        subtitle="A closed study circle of the Qur’an with Shaykh Omid Azizi."
        mark={<span className="y-mark" aria-hidden>T</span>}
      />
    );
  }

  // ── What the page knows ──
  const [sessions, settings, account] = await Promise.all([getSessions(), getSettings(), getSessionOrNull()]);
  const me = account ? await joinCohort(account.userId) : null;
  const organiser = me?.role === "organiser";
  const ilmiOpen = await hasAccess("ilmi");

  const next = nextSession(sessions);
  const modN = currentModule(sessions);
  const current = MODULES.find((m) => m.n === modN) ?? MODULES[0];
  const tonight = next?.date === londonToday();

  // Real preparation, per module, from the student's own workspace.
  const stats: Record<number, TabStat[]> = {};
  if (me) for (const m of MODULES) stats[m.n] = await tabStats(me.workspaceId, m.surah);
  // Assigned research is done in the shared workspace once there is one.
  const sharedStats = settings.cohortWorkspaceId ? await tabStats(settings.cohortWorkspaceId, current.surah) : null;

  const states: Record<number, TileState> = {};
  const counts: Record<number, number> = {};
  for (const m of MODULES) {
    states[m.n] = m.n === modN ? "current" : moduleDone(sessions, m.n, modN) ? "done" : "upcoming";
    counts[m.n] = sessions.filter((s) => s.moduleN === m.n).length;
  }
  const written = me ? Object.fromEntries(MODULES.map((m) => [m.n, writtenCount(stats[m.n])])) : null;
  const inScope = next ? sessionPoints(next) : new Set<number>();
  const myAssignments = next && account
    ? next.assignments.filter((a) => a.assignees.some((x) => x.userId === account.userId)) : [];
  const slim = MODULES.map(({ n, surah, surahEn, surahAr, title }) => ({ n, surah, surahEn, surahAr, title }));

  return (
    <div className="y-page">
      <Motion />
      <header className="y-nav">
        <div className="y-nav-in">
          <Link href="/home" className="y-nav-brand" title="Open TafsirLab">
            <span className="y-mark y-mark--s" aria-hidden>T</span>
            Youth Majlis
          </Link>
          <nav className="y-nav-links" aria-label="Sections">
            <a href="#prepare">Prepare</a>
            <a href="#sessions">Sessions</a>
            <a href="#method">Method</a>
            <Link href="/youth-majlis/ilmi">ʿIlmī</Link>
            {organiser && <Link href="/youth-majlis/organise">Organise</Link>}
          </nav>
          <LeaveButton />
        </div>
        <span className="y-progress" aria-hidden />
      </header>

      {settings.announcement && (
        <div className="y-announce" role="note">
          <span className="y-announce-tag">From the organisers</span>
          <span>{settings.announcement}</span>
        </div>
      )}

      <main>
        {/* ── Hero: the next session, or tonight's ── */}
        <section className="y-band y-hero" aria-labelledby="y-hero-h">
          <div className="y-hero-in">
            <p className="y-basmala y-in" style={{ "--d": "0ms" } as React.CSSProperties} lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
            <p className="y-kicker y-in" style={{ "--d": "250ms" } as React.CSSProperties}>
              {tonight ? "Majlis tonight" : `${LEVELS[0].name} · Module ${current.n}`}{next ? ` · Session ${next.seq}` : ""}
            </p>
            <p className="y-hero-ar y-ink" lang="ar" dir="rtl">{current.titleAr ?? current.surahAr}</p>
            <h1 id="y-hero-h" className="y-display y-in" style={{ "--d": "1100ms" } as React.CSSProperties}>{current.surahEn}.</h1>
            <p className="y-hero-sub y-in" style={{ "--d": "1250ms" } as React.CSSProperties}>{current.title}.</p>

            {next ? (
              <div className="y-when y-in" style={{ "--d": "1400ms" } as React.CSSProperties}>
                <p className="y-when-date">{tonight ? "Tonight" : longDate(next.date!)}</p>
                <p className="y-when-meta">
                  {next.startTime && next.endTime && <span>{next.startTime}–{next.endTime}</span>}
                  {next.venue && <a href={mapHref(next.venue)} target="_blank" rel="noreferrer">{next.venue}</a>}
                  {!tonight && <span>{away(next.date!)}</span>}
                </p>
                {sessionScope(next) && <p className="y-when-scope">{pointsLine(next) ?? sessionScope(next)}</p>}
                <div className="y-cta">
                  <a className="y-btn" href={`/youth-majlis/open/${current.surah}`}>Open {current.surahEn} in TafsirLab</a>
                  <a className="y-more" href={`/youth-majlis/calendar/${next.id}`}>Add to calendar</a>
                </div>
              </div>
            ) : (
              <div className="y-cta y-in" style={{ "--d": "1400ms" } as React.CSSProperties}>
                <a className="y-btn" href={`/youth-majlis/open/${current.surah}`}>Open {current.surahEn} in TafsirLab</a>
                <p className="y-next">The next session hasn’t been set yet.</p>
              </div>
            )}

            {tonight && next && (next.agenda.length > 0 || next.assignments.length > 0) && (
              <div className="y-tonight y-in" style={{ "--d": "1600ms" } as React.CSSProperties}>
                {next.agenda.length > 0 && (
                  <ol className="y-agenda" aria-label="Tonight’s running order">
                    {next.agenda.map((a, i) => <li key={i}><span>{a.time}</span>{a.item}</li>)}
                  </ol>
                )}
                {next.assignments.length > 0 && (
                  <ul className="y-presenters" aria-label="Tonight’s research">
                    {next.assignments.map((a) => (
                      <li key={a.id}>
                        <a href={`/youth-majlis/assignment/${a.id}`}>
                          <strong>{a.point ? pointName(a.point) : "Research"}</strong>
                          <span>{a.assignees.map((x) => x.name).join(", ")}{ayat(a) ? ` · ${ayat(a)}` : ""}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>

        {/* ── Before the Majlis ── */}
        <section id="prepare" className="y-band y-band--alt" aria-labelledby="y-p-h">
          <div className="y-wrap">
            <Words id="y-p-h" className="y-h2" text="Before the Majlis." />
            <p className="y-h2-sub" data-reveal>
              {next ? <>For {longDate(next.date!, false)}{next.prepDue ? `, ready by ${longDate(next.prepDue, false)}` : ""}.</> : "For the next session."}
            </p>

            <div className="y-prep-grid">
              <div className="y-prep-card" data-reveal>
                <p className="y-prep-h">The prep pack</p>
                {next && next.prep.length > 0
                  ? <ul className="y-prep-list">{next.prep.map((p, i) => <li key={i}>{p.text}</li>)}</ul>
                  : <p className="y-prep-empty">Nothing set yet. Shaykh Omid’s preparation for this session will appear here.</p>}
              </div>

              <div className="y-prep-card" data-reveal data-reveal-i={1}>
                <p className="y-prep-h">Your research</p>
                {!account ? (
                  <p className="y-prep-empty">Sign in to TafsirLab to see anything set for you. <a className="y-more" href="/login">Sign in</a></p>
                ) : myAssignments.length === 0 ? (
                  <p className="y-prep-empty">Nothing assigned to you for this session.</p>
                ) : (
                  <ul className="y-assignments">
                    {myAssignments.map((a) => {
                      const st = a.point ? (sharedStats ?? stats[modN])?.find((t) => t.n === a.point) : undefined;
                      const group = a.assignees.length > 1;
                      return (
                        <li key={a.id}>
                          <p className="y-assign-what">{a.point ? pointName(a.point) : "Research"}{ayat(a) ? ` · ${ayat(a)}` : ""}</p>
                          <p className="y-assign-meta">
                            {group ? `With ${a.assignees.filter((x) => x.userId !== account.userId).map((x) => x.name).join(", ")}` : "Just you"}
                            {a.due && ` · due ${longDate(a.due, false)}`}
                          </p>
                          {a.note && <p className="y-assign-note">{a.note}</p>}
                          <p className="y-assign-foot">
                            {st && <span className="y-state" data-state={st.state}>{st.state === "written" ? "Written" : st.state === "started" ? "Started" : "Not started"}{st.words ? ` · ${st.words} words` : ""}</span>}
                            <a className="y-more" href={`/youth-majlis/assignment/${a.id}`}>Open it</a>
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="y-points" data-reveal>
              <div className="y-points-head">
                <p className="y-prep-h">Your ten points for {current.surahEn}</p>
                {me && <span className="y-points-count">{writtenCount(stats[modN])} of 10 written</span>}
              </div>
              {!account ? (
                <p className="y-prep-empty">Sign in to TafsirLab and this shows how far you’ve got with each point, from what you’ve actually written. <a className="y-more" href="/login">Sign in</a></p>
              ) : (
                <ol className="y-points-list">
                  {stats[modN].map((t) => (
                    <li key={t.n}>
                      <a href={`/youth-majlis/open/${current.surah}?point=${t.n}`} data-state={t.state} data-focus={inScope.has(t.n) ? "" : undefined}>
                        <span className="y-pt-dot" aria-hidden />
                        <span className="y-pt-title">{t.title}{inScope.has(t.n) && <span className="y-pt-focus">This session</span>}</span>
                        <span className="y-pt-meta">{t.state === "empty" ? "Not started" : `${t.words} words${t.notes ? `, ${t.notes} notes` : ""}`}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>

        {/* ── Journey ── */}
        <section id="journey" className="y-band" aria-labelledby="y-j-h">
          <div className="y-wrap">
            <Words id="y-j-h" className="y-h2" text="The journey." />
            <p className="y-h2-sub" data-reveal>Three levels, each built upon the one before.</p>
          </div>
          <JourneyRail modules={slim} levels={LEVELS} states={states} written={written} sessions={counts} total={QUESTIONS.length} />
        </section>

        {/* ── Every session ── */}
        <section id="sessions" className="y-band y-band--alt" aria-labelledby="y-s-h">
          <div className="y-wrap">
            <Words id="y-s-h" className="y-h2" text="Every session." />
            <p className="y-h2-sub" data-reveal>What was covered, and what Shaykh Omid wanted us to keep.</p>
            {[...MODULES].reverse().filter((m) => counts[m.n]).map((m) => (
              <div key={m.n} className="y-sess-mod" data-reveal>
                <h3 className="y-sess-mod-h"><span lang="ar" dir="rtl">{m.surahAr}</span> Sūrah {m.surahEn}</h3>
                <ol className="y-sess-list">
                  {sessions.filter((s) => s.moduleN === m.n).map((s) => <SessionCard key={s.id} s={s} isNext={s.id === next?.id} />)}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* ── Modules ── */}
        <div id="modules">
          {MODULES.map((m, i) => (
            <section key={m.n} id={`module-${m.n}`} className={`y-band y-module${i % 2 ? " y-band--alt" : ""}`} aria-labelledby={`y-m${m.n}`}>
              <div className="y-wrap y-module-grid">
                <div className="y-module-text">
                  <p className="y-kicker" data-reveal>Module {m.n}{m.n === modN ? " · Now studying" : states[m.n] === "done" ? " · Completed" : ""}</p>
                  <Words id={`y-m${m.n}`} className="y-h2" text={`${m.surahEn}.`} />
                  <p className="y-h2-sub" data-reveal>{m.title}.</p>
                  <ul className="y-themes">
                    {m.themes.map((t, ti) => <li key={t} data-reveal data-reveal-i={ti}>{t}</li>)}
                  </ul>
                  <div className="y-cta y-cta--left" data-reveal>
                    <a className="y-btn" href={`/youth-majlis/open/${m.surah}`}>Open in TafsirLab</a>
                    <a className="y-more" href="#method">The ten questions</a>
                  </div>
                </div>
                <div className="y-module-side">
                  <p className="y-module-ar y-ink-scroll" lang="ar" dir="rtl" data-reveal>{m.titleAr ?? m.surahAr}</p>
                  <p className="y-module-range" data-reveal>
                    {m.passage ? `Āyāt ${m.passage.from}–${m.passage.to}` : `${m.ayat} āyāt`} · Sūrah {m.surah}
                  </p>
                  {m.exercises.length > 0 && (
                    <div className="y-exercise" data-reveal>
                      <p className="y-exercise-h">Exercises</p>
                      {m.exercises.map((q) => <p key={q} className="y-exercise-q">{q}</p>)}
                      <a className="y-more y-exercise-go" href={`/youth-majlis/open/${m.surah}?point=9`}>Answer them in 9. Personal Reflections</a>
                    </div>
                  )}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* ── Method ── */}
        <section id="method" className="y-band y-band--dark" aria-labelledby="y-q-h">
          <div className="y-wrap">
            <Words id="y-q-h" className="y-h2" text={"Ten questions.\nEvery sūrah."} />
            <p className="y-h2-sub" data-reveal>How to research each point, and how far you’ve really got with it.</p>
            <div data-reveal>
              <QuestionExplorer questions={QUESTIONS} modules={slim} current={modN} stats={stats} signedIn={!!me} />
            </div>
            <p className="y-method" data-reveal>{METHOD.join("  ·  ")}</p>
          </div>
        </section>

        {/* ── Areas ── */}
        <section className="y-band" aria-labelledby="y-a-h">
          <div className="y-wrap">
            <Words id="y-a-h" className="y-h2" text="Four areas of growth." />
            <p className="y-h2-sub" data-reveal>Where each module takes us. A map of the course, never a measure of anyone’s īmān or character.</p>
            <div className="y-areas">
              {AREAS.map((a, ai) => (
                <div key={a.id} className="y-area" data-reveal data-reveal-i={ai}>
                  <span className="y-area-ar" lang="ar" dir="rtl">{a.ar}</span>
                  <span className="y-area-en">{a.en}</span>
                  <span className="y-area-mods">
                    {MODULES.filter((m) => m.areas.includes(a.id)).map((m) => (
                      <a key={m.n} href={`#module-${m.n}`} className="y-area-link">{m.surahEn}</a>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Aim ── */}
        <section className="y-band y-band--alt" aria-labelledby="y-aim-h">
          <div className="y-wrap y-statement">
            <h2 id="y-aim-h" className="y-statement-h" data-reveal>{AIM}</h2>
            <p className="y-statement-p" data-reveal>{AIM_DETAIL}</p>
          </div>
        </section>

        {/* ── Cohort ── */}
        <section className="y-band" aria-labelledby="y-c-h">
          <div className="y-wrap">
            <Words id="y-c-h" className="y-h2" text="The cohort." />
            <ul className="y-names">
              {COHORT.map((n, i) => <li key={n} className="y-name" data-reveal data-reveal-i={i}>{n}</li>)}
            </ul>
          </div>
        </section>

        {/* ── ʿIlmī ── */}
        <section className="y-band y-band--dark y-promo" aria-labelledby="y-i-h">
          <div className="y-wrap y-promo-grid">
            <div className="y-promo-book" data-reveal>
              <Book3D compact />
              <p className="bk-hint">Tap to open · drag to turn</p>
            </div>
            <div>
              <p className="y-kicker y-kicker--light" data-reveal>ʿIlmī</p>
              <Words id="y-i-h" className="y-h2" text="Uṣūl al-Fiqh." />
              <div className="y-cta y-cta--left" data-reveal>
                <IlmiEnter unlocked={ilmiOpen} />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="y-foot">
        Under the guidance of {SHAYKH}. Powered by <Link href="/home">TafsirLab</Link>.
      </footer>
    </div>
  );
}

/** One session in the archive: when, what, and what to keep from it. */
function SessionCard({ s, isNext }: { s: SessionView; isNext: boolean }) {
  const past = !!s.date && s.date < londonToday();
  return (
    <li className="y-sess" data-when={isNext ? "next" : past ? "past" : "later"}>
      <div className="y-sess-head">
        <span className="y-sess-n">Session {s.seq}</span>
        <span className="y-sess-date">{s.date ? longDate(s.date, false) : "Date not recorded"}</span>
        {isNext && <span className="y-sess-tag">Next</span>}
        {sessionScope(s) && <span className="y-sess-ayat">{sessionScope(s)}</span>}
      </div>
      {s.takeaways.length > 0 && (
        <ol className="y-sess-takeaways" aria-label="Shaykh’s takeaways">
          {s.takeaways.map((t, i) => <li key={i}>{t}</li>)}
        </ol>
      )}
      {(s.recordingUrl || s.followUp) && (
        <p className="y-sess-foot">
          {s.recordingUrl && <a className="y-more" href={s.recordingUrl} target="_blank" rel="noreferrer">Recording</a>}
          {s.followUp && <span>Follow-up: {s.followUp}</span>}
        </p>
      )}
      {past && s.takeaways.length === 0 && !s.recordingUrl && <p className="y-sess-none">Takeaways not added yet.</p>}
    </li>
  );
}
