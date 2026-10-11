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
 * Laid out as a product page — full-bleed bands, one idea each — and built to
 * be used, not just read: the ten questions are worked through and ticked off,
 * exercises are answered in place, and progress shows on the journey.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import Gate from "@/components/youth-majlis/Gate";
import LeaveButton from "@/components/youth-majlis/LeaveButton";
import Book3D from "@/components/youth-majlis/Book3D";
import Motion from "@/components/youth-majlis/Motion";
import JourneyRail from "@/components/youth-majlis/JourneyRail";
import QuestionExplorer from "@/components/youth-majlis/QuestionExplorer";
import Exercises from "@/components/youth-majlis/Exercises";
import IlmiEnter from "@/components/youth-majlis/IlmiEnter";
import { hasAccess } from "@/lib/youth-majlis/gate";
import {
  AIM, AIM_DETAIL, AREAS, COHORT, CURRENT_MODULE, LEVELS, METHOD, MODULES,
  NEXT_MAJLIS, QUESTIONS, SHAYKH, type Module,
} from "@/lib/youth-majlis/content";

const openHref = (m: Module) => `/youth-majlis/open/${m.surah}`;

function nextMajlis(): { when: string; detail: string } {
  if (!NEXT_MAJLIS) return { when: "Date to be announced.", detail: `With ${SHAYKH}.` };
  const { date, time, note, where } = NEXT_MAJLIS;
  // Midday UTC keeps the calendar date the same in London whatever the season.
  const day = new Date(`${date}T12:00:00Z`);
  const when = new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London",
  }).format(day) + (time ? `, ${time}` : "");
  // Whole days between today's London date and the Majlis.
  const todayLondon = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const days = Math.round((Date.parse(date) - Date.parse(todayLondon)) / 86_400_000);
  const away = days > 1 ? `In ${days} days.` : days === 1 ? "Tomorrow." : days === 0 ? "Today." : "";
  return { when: `${when}.`, detail: [note, away, `With ${SHAYKH}.`, where].filter(Boolean).join(" ") };
}

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

  const current = MODULES.find((m) => m.n === CURRENT_MODULE) ?? MODULES[0];
  const ilmiOpen = await hasAccess("ilmi");
  const next = nextMajlis();
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
            <a href="#journey">Journey</a>
            <a href="#modules">Modules</a>
            <a href="#method">Method</a>
            <Link href="/youth-majlis/ilmi">ʿIlmī</Link>
          </nav>
          <LeaveButton />
        </div>
        <span className="y-progress" aria-hidden />
      </header>

      <main>
        {/* ── Hero: the Arabic inks in right to left, the rest follows ── */}
        <section className="y-band y-hero" aria-labelledby="y-hero-h" data-parallax>
          <div className="y-hero-in">
            <p className="y-basmala y-in" style={{ "--d": "0ms" } as React.CSSProperties} lang="ar" dir="rtl">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</p>
            <p className="y-kicker y-in" style={{ "--d": "250ms" } as React.CSSProperties}>{LEVELS[0].name} · Module {current.n}</p>
            <p className="y-hero-ar y-ink" lang="ar" dir="rtl">{current.titleAr ?? current.surahAr}</p>
            <h1 id="y-hero-h" className="y-display y-in" style={{ "--d": "1100ms" } as React.CSSProperties}>{current.surahEn}.</h1>
            <p className="y-hero-sub y-in" style={{ "--d": "1250ms" } as React.CSSProperties}>{current.title}.</p>
            <div className="y-cta y-in" style={{ "--d": "1450ms" } as React.CSSProperties}>
              <a className="y-btn" href={openHref(current)}>Open in TafsirLab</a>
              <a className="y-more" href={`#module-${current.n}`}>Prepare for the Majlis</a>
            </div>
            <p className="y-next y-in" style={{ "--d": "1650ms" } as React.CSSProperties}><strong>Next Majlis.</strong> {next.when} <span>{next.detail}</span></p>
          </div>
          <a href="#journey" className="y-scroll-cue y-in" style={{ "--d": "2200ms" } as React.CSSProperties} aria-label="Scroll to the journey">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>
          </a>
        </section>

        {/* ── Journey ── */}
        <section id="journey" className="y-band y-band--alt" aria-labelledby="y-j-h">
          <div className="y-wrap">
            <Words id="y-j-h" className="y-h2" text="The journey." />
            <p className="y-h2-sub" data-reveal>Three levels, each built upon the one before.</p>
          </div>
          <JourneyRail modules={slim} levels={LEVELS} current={CURRENT_MODULE} total={QUESTIONS.length} />
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
                  <p className="y-kicker" data-reveal>Module {m.n}{m.n === CURRENT_MODULE ? " · Now studying" : ""}</p>
                  <Words id={`y-m${m.n}`} className="y-h2" text={`${m.surahEn}.`} />
                  <p className="y-h2-sub" data-reveal>{m.title}.</p>
                  <ul className="y-themes">
                    {m.themes.map((t, ti) => <li key={t} data-reveal data-reveal-i={ti}>{t}</li>)}
                  </ul>
                  <div className="y-cta y-cta--left" data-reveal>
                    <a className="y-btn" href={openHref(m)}>Open in TafsirLab</a>
                    <a className="y-more" href="#method">Work through the ten questions</a>
                  </div>
                </div>
                <div className="y-module-side">
                  <p className="y-module-ar y-ink-scroll" lang="ar" dir="rtl" data-reveal>{m.titleAr ?? m.surahAr}</p>
                  <p className="y-module-range" data-reveal>
                    {m.passage ? `Āyāt ${m.passage.from}–${m.passage.to}` : `${m.ayat} āyāt`} · Sūrah {m.surah}
                  </p>
                  {m.exercises.length > 0 && <Exercises moduleN={m.n} exercises={m.exercises} />}
                </div>
              </div>
            </section>
          ))}
        </div>

        {/* ── Method: the explorer ── */}
        <section id="method" className="y-band y-band--dark" aria-labelledby="y-q-h">
          <div className="y-wrap">
            <Words id="y-q-h" className="y-h2" text={"Ten questions.\nEvery sūrah."} />
            <p className="y-h2-sub" data-reveal>Choose a module and work through them one by one. Your progress fills the journey.</p>
            <div data-reveal>
              <QuestionExplorer questions={QUESTIONS} modules={slim} current={CURRENT_MODULE} />
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
              {COHORT.map((n, i) => (
                <li key={n} className="y-name" data-reveal data-reveal-i={i}>{n}</li>
              ))}
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
