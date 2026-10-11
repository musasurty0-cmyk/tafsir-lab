/**
 * /youth-majlis — the Youth Majlis portal.
 *
 * The course layer around TafsirLab: where the cohort is, what it is studying
 * and when it meets. It does not duplicate the editor or the canvas; every
 * sūrah opens straight into TafsirLab, which is where the study happens.
 *
 *   TafsirLab   = where I study the Qur’an.
 *   Youth Majlis = where Shaykh Omid guides my journey through it.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import Gate from "@/components/youth-majlis/Gate";
import LeaveButton from "@/components/youth-majlis/LeaveButton";
import { hasAccess } from "@/lib/youth-majlis/gate";
import {
  AIM, AIM_DETAIL, AREAS, COHORT, CURRENT_MODULE, LEVELS, METHOD, MODULES,
  NEXT_MAJLIS, QUESTIONS, SHAYKH, ILMI_COHORT, type Module,
} from "@/lib/youth-majlis/content";

const openHref = (m: Module) => `/youth-majlis/open/${m.surah}`;

function nextMajlisText(): { line: string; detail: string } {
  if (!NEXT_MAJLIS) return { line: "Date to be announced", detail: `With ${SHAYKH}` };
  const d = new Date(NEXT_MAJLIS.when);
  const line = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
    timeZone: "Europe/London",
  }).format(d);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const when = days > 1 ? `in ${days} days` : days === 1 ? "tomorrow" : days === 0 ? "today" : "";
  return { line, detail: [`With ${SHAYKH}`, NEXT_MAJLIS.where, when].filter(Boolean).join(" · ") };
}

export default async function YouthMajlisPage() {
  if (!(await hasAccess("majlis"))) {
    return (
      <Gate
        area="majlis"
        eyebrow="TafsirLab × Youth Majlis"
        title="Youth Majlis"
        subtitle="A closed study circle of the Qur’an with Shaykh Omid Azizi. Enter the cohort’s password to continue."
      >
        <Mark />
      </Gate>
    );
  }

  const current = MODULES.find((m) => m.n === CURRENT_MODULE) ?? MODULES[0];
  const next = nextMajlisText();

  return (
    <div className="ym-page">
      <header className="ym-top">
        <Link href="/home" className="ym-brand" title="Open TafsirLab">
          <Mark small />
          <span className="ym-brand-name">TafsirLab</span>
          <span className="ym-brand-x">×</span>
          <span className="ym-brand-name ym-brand-name--alt">Youth Majlis</span>
        </Link>
        <nav className="ym-top-nav" aria-label="Sections">
          <a href="#journey">Journey</a>
          <a href="#modules">Modules</a>
          <a href="#questions">The 10 questions</a>
          <Link href="/youth-majlis/ilmi">ʿIlmī</Link>
          <LeaveButton />
        </nav>
      </header>

      <main className="ym-main">
        {/* ── Continue your journey ── */}
        <section className="ym-hero" aria-labelledby="ym-hero-title">
          <p className="ym-basmala" lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
          <p className="ym-eyebrow">Continue your journey · {LEVELS[0].name} · Module {String(current.n).padStart(2, "0")}</p>
          <p className="ym-hero-ar" lang="ar" dir="rtl">{current.titleAr ?? current.surahAr}</p>
          <h1 id="ym-hero-title" className="ym-hero-title">Sūrah {current.surahEn}</h1>
          <p className="ym-hero-sub">{current.title}</p>

          <div className="ym-hero-next">
            <span className="ym-next-label">Next Majlis</span>
            <span className="ym-next-line">{next.line}</span>
            <span className="ym-next-detail">{next.detail}</span>
          </div>

          <div className="ym-hero-actions">
            <a className="ym-btn ym-btn--primary" href={openHref(current)}>
              Open {current.surahEn} in TafsirLab <span aria-hidden>→</span>
            </a>
            <a className="ym-btn" href={`#module-${current.n}`}>Prepare for the Majlis</a>
          </div>
        </section>

        {/* ── The journey ── */}
        <section id="journey" className="ym-section" aria-labelledby="ym-journey-title">
          <div className="ym-section-head">
            <p className="ym-eyebrow">Your journey</p>
            <h2 id="ym-journey-title" className="ym-h2">Three levels, built one upon the other</h2>
          </div>
          <ol className="ym-levels">
            {LEVELS.map((lv) => (
              <li key={lv.n} className="ym-level" data-locked={lv.n > 1 ? "true" : undefined}>
                <div className="ym-level-head">
                  <span className="ym-level-n">Level {String(lv.n).padStart(2, "0")}</span>
                  <span className="ym-level-name">{lv.name}</span>
                </div>
                {lv.n === 1 ? (
                  <ol className="ym-steps">
                    {MODULES.map((m) => {
                      const state = m.n < CURRENT_MODULE ? "done" : m.n === CURRENT_MODULE ? "current" : "upcoming";
                      return (
                        <li key={m.n} className="ym-step" data-state={state}>
                          <a href={`#module-${m.n}`}>
                            <span className="ym-step-dot" aria-hidden />
                            <span className="ym-step-n">{String(m.n).padStart(2, "0")}</span>
                            <span className="ym-step-ar" lang="ar" dir="rtl">{m.surahAr}</span>
                            <span className="ym-step-en">{m.surahEn}</span>
                            <span className="ym-step-title">{m.title}</span>
                            <span className="ym-step-state">
                              {state === "done" ? "Completed" : state === "current" ? "Current" : "Upcoming"}
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="ym-level-locked">Opens after {LEVELS[lv.n - 2].name}</p>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* ── Modules ── */}
        <section id="modules" className="ym-section" aria-labelledby="ym-modules-title">
          <div className="ym-section-head">
            <p className="ym-eyebrow">Level 01 · {LEVELS[0].name}</p>
            <h2 id="ym-modules-title" className="ym-h2">The modules</h2>
          </div>
          <div className="ym-modules">
            {MODULES.map((m) => (
              <article key={m.n} id={`module-${m.n}`} className="ym-module" data-current={m.n === CURRENT_MODULE ? "true" : undefined}>
                <header className="ym-module-head">
                  <div>
                    <p className="ym-module-n">Module {String(m.n).padStart(2, "0")}</p>
                    <h3 className="ym-module-title">Sūrah {m.surahEn}</h3>
                    <p className="ym-module-sub">{m.title}</p>
                    <p className="ym-module-range">
                      {m.passage ? `Āyāt ${m.passage.from}–${m.passage.to}` : `${m.ayat} āyāt`} · Sūrah {m.surah}
                    </p>
                  </div>
                  <p className="ym-module-ar" lang="ar" dir="rtl">{m.titleAr ?? m.surahAr}</p>
                </header>

                <div className="ym-module-body">
                  <div>
                    <h4 className="ym-h4">Themes</h4>
                    <ul className="ym-list">{m.themes.map((t) => <li key={t}>{t}</li>)}</ul>
                  </div>
                  {m.exercises.length > 0 && (
                    <div>
                      <h4 className="ym-h4">Exercises</h4>
                      <ul className="ym-exercises">
                        {m.exercises.map((x) => <li key={x}>{x}</li>)}
                      </ul>
                    </div>
                  )}
                </div>

                <footer className="ym-module-foot">
                  <span className="ym-tags">
                    {m.areas.map((a) => (
                      <span key={a} className="ym-tag">{AREAS.find((x) => x.id === a)?.en}</span>
                    ))}
                  </span>
                  <span className="ym-module-actions">
                    <a className="ym-btn ym-btn--small" href="#questions">The 10 questions</a>
                    <a className="ym-btn ym-btn--primary ym-btn--small" href={openHref(m)}>
                      Open in TafsirLab <span aria-hidden>→</span>
                    </a>
                  </span>
                </footer>
              </article>
            ))}
          </div>
        </section>

        {/* ── The ten questions ── */}
        <section id="questions" className="ym-section" aria-labelledby="ym-q-title">
          <div className="ym-section-head">
            <p className="ym-eyebrow">The method</p>
            <h2 id="ym-q-title" className="ym-h2">Every module is studied through the same ten questions</h2>
            <p className="ym-lede">
              They are the research pathways for each sūrah. Bring them to TafsirLab — the tafāsīr, the
              Arabic and your notes are there — and bring what you find to the Majlis.
            </p>
          </div>
          <ol className="ym-questions">
            {QUESTIONS.map((q) => (
              <li key={q.n} className="ym-q">
                <span className="ym-q-n">{String(q.n).padStart(2, "0")}</span>
                <span className="ym-q-label">{q.label}</span>
                <span className="ym-q-text">{q.q}</span>
              </li>
            ))}
          </ol>
          <ul className="ym-method" aria-label="How we study">
            {METHOD.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </section>

        {/* ── Four areas ── */}
        <section className="ym-section" aria-labelledby="ym-areas-title">
          <div className="ym-section-head">
            <p className="ym-eyebrow">The curriculum</p>
            <h2 id="ym-areas-title" className="ym-h2">Four areas of Qur’anic development</h2>
            <p className="ym-lede">
              Which modules take up each one. This maps the course — it does not measure anyone’s
              īmān or character.
            </p>
          </div>
          <div className="ym-areas">
            {AREAS.map((a) => (
              <div key={a.id} className="ym-area">
                <span className="ym-area-ar" lang="ar" dir="rtl">{a.ar}</span>
                <span className="ym-area-en">{a.en}</span>
                <span className="ym-area-mods">
                  {MODULES.filter((m) => m.areas.includes(a.id)).map((m) => (
                    <a key={m.n} href={`#module-${m.n}`} className="ym-tag">{m.surahEn}</a>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Aim + cohort ── */}
        <section className="ym-section ym-split" aria-labelledby="ym-aim-title">
          <div>
            <p className="ym-eyebrow">Aim &amp; objective</p>
            <h2 id="ym-aim-title" className="ym-h2">{AIM}</h2>
            <p className="ym-lede">{AIM_DETAIL}</p>
          </div>
          <div>
            <p className="ym-eyebrow">The cohort</p>
            <ul className="ym-cohort">
              {COHORT.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </div>
        </section>

        {/* ── ʿIlmī ── */}
        <section className="ym-section">
          <Link href="/youth-majlis/ilmi" className="ym-ilmi-card">
            <span className="ym-ilmi-mini" aria-hidden><span /></span>
            <span className="ym-ilmi-text">
              <span className="ym-eyebrow ym-eyebrow--light">ʿIlmī · closed</span>
              <span className="ym-ilmi-title">Uṣūl al-Fiqh — an intensive with Shaykh Omid</span>
              <span className="ym-ilmi-sub">
                For {ILMI_COHORT.join(", ").replace(/, ([^,]*)$/, " and $1")}. Its own password.
              </span>
            </span>
            <span className="ym-ilmi-go" aria-hidden>→</span>
          </Link>
        </section>
      </main>

      <footer className="ym-footer">
        Under the guidance of {SHAYKH} · Powered by <Link href="/home">TafsirLab</Link>
      </footer>
    </div>
  );
}

/** The TafsirLab tile — the same mark as the app and the reels. */
function Mark({ small = false }: { small?: boolean }) {
  return <span className={`ym-mark${small ? " ym-mark--small" : ""}`} aria-hidden>T</span>;
}
