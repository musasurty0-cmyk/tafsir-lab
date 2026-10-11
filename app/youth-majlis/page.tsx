/**
 * /youth-majlis — the Youth Majlis portal.
 *
 * The course layer around TafsirLab: where the cohort is, what it is studying
 * and when it meets. It does not duplicate the editor or the canvas; every
 * sūrah opens straight into TafsirLab, which is where the study happens.
 *
 *   TafsirLab    = where I study the Qur’an.
 *   Youth Majlis = where Shaykh Omid guides my journey through it.
 *
 * Laid out as a product page: full-bleed bands, one idea per band, large type
 * carrying the structure instead of boxes and outlines.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import Gate from "@/components/youth-majlis/Gate";
import LeaveButton from "@/components/youth-majlis/LeaveButton";
import Book3D from "@/components/youth-majlis/Book3D";
import { hasAccess } from "@/lib/youth-majlis/gate";
import {
  AIM, AIM_DETAIL, AREAS, COHORT, CURRENT_MODULE, LEVELS, METHOD, MODULES,
  NEXT_MAJLIS, QUESTIONS, SHAYKH, ILMI_COHORT, type Module,
} from "@/lib/youth-majlis/content";

const openHref = (m: Module) => `/youth-majlis/open/${m.surah}`;
const list = (xs: string[]) => xs.join(", ").replace(/, ([^,]*)$/, " and $1");

function nextMajlis(): { when: string; detail: string } {
  if (!NEXT_MAJLIS) return { when: "Date to be announced.", detail: `With ${SHAYKH}.` };
  const d = new Date(NEXT_MAJLIS.when);
  const when = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit",
    timeZone: "Europe/London",
  }).format(d);
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  const away = days > 1 ? `In ${days} days.` : days === 1 ? "Tomorrow." : days === 0 ? "Today." : "";
  return { when: `${when}.`, detail: [away, `With ${SHAYKH}.`, NEXT_MAJLIS.where].filter(Boolean).join(" ") };
}

export default async function YouthMajlisPage() {
  if (!(await hasAccess("majlis"))) {
    return (
      <Gate
        area="majlis"
        title="Youth Majlis."
        subtitle="A closed study circle of the Qur’an with Shaykh Omid Azizi."
        mark={<span className="y-mark" aria-hidden>T</span>}
      />
    );
  }

  const current = MODULES.find((m) => m.n === CURRENT_MODULE) ?? MODULES[0];
  const next = nextMajlis();

  return (
    <div className="y-page">
      <header className="y-nav">
        <div className="y-nav-in">
          <Link href="/home" className="y-nav-brand" title="Open TafsirLab">
            <span className="y-mark y-mark--s" aria-hidden>T</span>
            Youth Majlis
          </Link>
          <nav className="y-nav-links" aria-label="Sections">
            <a href="#journey">Journey</a>
            <a href="#modules">Modules</a>
            <a href="#method">Method</a>
            <Link href="/youth-majlis/ilmi">ʿIlmī</Link>
          </nav>
          <LeaveButton />
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="y-band y-hero" aria-labelledby="y-hero-h">
          <p className="y-basmala" lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
          <p className="y-kicker">{LEVELS[0].name} · Module {current.n}</p>
          <p className="y-hero-ar" lang="ar" dir="rtl">{current.titleAr ?? current.surahAr}</p>
          <h1 id="y-hero-h" className="y-display">{current.surahEn}.</h1>
          <p className="y-hero-sub">{current.title}.</p>
          <div className="y-cta">
            <a className="y-btn" href={openHref(current)}>Open in TafsirLab</a>
            <a className="y-more" href={`#module-${current.n}`}>Prepare for the Majlis</a>
          </div>
          <p className="y-next"><strong>Next Majlis.</strong> {next.when} <span>{next.detail}</span></p>
        </section>

        {/* ── Journey ── */}
        <section id="journey" className="y-band y-band--alt" aria-labelledby="y-j-h">
          <div className="y-wrap">
            <h2 id="y-j-h" className="y-h2">The journey.</h2>
            <p className="y-h2-sub">Three levels, each built upon the one before.</p>
          </div>
          <div className="y-rail" role="list">
            {MODULES.map((m) => {
              const state = m.n < CURRENT_MODULE ? "Completed" : m.n === CURRENT_MODULE ? "Now studying" : "Coming up";
              return (
                <a key={m.n} href={`#module-${m.n}`} className="y-tile" role="listitem" data-current={m.n === CURRENT_MODULE ? "" : undefined}>
                  <span className="y-tile-state">{state}</span>
                  <span className="y-tile-ar" lang="ar" dir="rtl">{m.surahAr}</span>
                  <span className="y-tile-name">{m.surahEn}</span>
                  <span className="y-tile-title">{m.title}</span>
                  <span className="y-tile-n">Level 1 · Module {m.n}</span>
                </a>
              );
            })}
            {LEVELS.slice(1).map((lv) => (
              <div key={lv.n} className="y-tile y-tile--locked" role="listitem">
                <span className="y-tile-state">Later</span>
                <span className="y-tile-level">{lv.n}</span>
                <span className="y-tile-name">{lv.name}</span>
                <span className="y-tile-title">Opens after {LEVELS[lv.n - 2].name}.</span>
                <span className="y-tile-n">Level {lv.n}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Modules, one band each ── */}
        <div id="modules">
          {MODULES.map((m, i) => (
            <section
              key={m.n}
              id={`module-${m.n}`}
              className={`y-band y-module${i % 2 ? " y-band--alt" : ""}`}
              aria-labelledby={`y-m${m.n}`}
            >
              <div className="y-wrap y-module-grid">
                <div className="y-module-text">
                  <p className="y-kicker">Module {m.n}{m.n === CURRENT_MODULE ? " · Now studying" : ""}</p>
                  <h2 id={`y-m${m.n}`} className="y-h2">{m.surahEn}.</h2>
                  <p className="y-h2-sub">{m.title}.</p>
                  <ul className="y-themes">{m.themes.map((t) => <li key={t}>{t}</li>)}</ul>
                  <div className="y-cta y-cta--left">
                    <a className="y-btn" href={openHref(m)}>Open in TafsirLab</a>
                    <a className="y-more" href="#method">Study it through the ten questions</a>
                  </div>
                </div>
                <div className="y-module-side">
                  <p className="y-module-ar" lang="ar" dir="rtl">{m.titleAr ?? m.surahAr}</p>
                  <p className="y-module-range">
                    {m.passage ? `Āyāt ${m.passage.from}–${m.passage.to}` : `${m.ayat} āyāt`} · Sūrah {m.surah}
                  </p>
                  {m.exercises.length > 0 && (
                    <div className="y-exercise">
                      <p className="y-exercise-h">Exercises</p>
                      {m.exercises.map((x) => <p key={x} className="y-exercise-q">{x}</p>)}
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
            <h2 id="y-q-h" className="y-h2">Ten questions.<br />Every sūrah.</h2>
            <p className="y-h2-sub">The same questions guide every module. Bring them to TafsirLab, where the tafāsīr, the Arabic and your notes are, and bring what you find to the Majlis.</p>
            <ol className="y-questions">
              {QUESTIONS.map((q) => (
                <li key={q.n}>
                  <span className="y-q-n">{q.n}</span>
                  <span className="y-q-label">{q.label}</span>
                  <span className="y-q-text">{q.q}</span>
                </li>
              ))}
            </ol>
            <p className="y-method">{METHOD.join("  ·  ")}</p>
          </div>
        </section>

        {/* ── Areas ── */}
        <section className="y-band" aria-labelledby="y-a-h">
          <div className="y-wrap">
            <h2 id="y-a-h" className="y-h2">Four areas of growth.</h2>
            <p className="y-h2-sub">Where each module takes us. A map of the course — never a measure of anyone’s īmān or character.</p>
            <div className="y-areas">
              {AREAS.map((a) => (
                <div key={a.id} className="y-area">
                  <span className="y-area-ar" lang="ar" dir="rtl">{a.ar}</span>
                  <span className="y-area-en">{a.en}</span>
                  <span className="y-area-mods">
                    {MODULES.filter((m) => m.areas.includes(a.id)).map((m) => m.surahEn).join(" · ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Aim ── */}
        <section className="y-band y-band--alt" aria-labelledby="y-aim-h">
          <div className="y-wrap y-statement">
            <h2 id="y-aim-h" className="y-statement-h">{AIM}</h2>
            <p className="y-statement-p">{AIM_DETAIL}</p>
          </div>
        </section>

        {/* ── Cohort ── */}
        <section className="y-band" aria-labelledby="y-c-h">
          <div className="y-wrap">
            <h2 id="y-c-h" className="y-h2">The cohort.</h2>
            <p className="y-names">{COHORT.join("   ")}</p>
          </div>
        </section>

        {/* ── ʿIlmī ── */}
        <section className="y-band y-band--dark y-promo" aria-labelledby="y-i-h">
          <div className="y-wrap y-promo-grid">
            <div className="y-promo-book"><Book3D compact /></div>
            <div>
              <p className="y-kicker y-kicker--light">ʿIlmī</p>
              <h2 id="y-i-h" className="y-h2">Uṣūl al-Fiqh.</h2>
              <p className="y-h2-sub">An intensive with {SHAYKH}, for {list(ILMI_COHORT)}. On its own password.</p>
              <div className="y-cta y-cta--left">
                <Link className="y-btn y-btn--light" href="/youth-majlis/ilmi">Enter ʿIlmī</Link>
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
