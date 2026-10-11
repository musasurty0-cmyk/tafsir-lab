/**
 * /youth-majlis/ilmi — the ʿIlmī track: an intensive in Uṣūl al-Fiqh with
 * Shaykh Omid, for four students. Inside the portal, behind a second password.
 *
 * Opens on the set text, Kamali's Principles of Islamic Jurisprudence, turning
 * on a black stage; then what the discipline is, the road map, and what to
 * read before the first session.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import Gate from "@/components/youth-majlis/Gate";
import Book3D from "@/components/youth-majlis/Book3D";
import LeaveButton from "@/components/youth-majlis/LeaveButton";
import Motion from "@/components/youth-majlis/Motion";
import { ReadingList, TermDeck } from "@/components/youth-majlis/IlmiInteractive";
import { hasAccess } from "@/lib/youth-majlis/gate";
import {
  ILMI_BOOK, ILMI_COHORT, ILMI_READING, ILMI_SESSIONS, ILMI_TERMS, SHAYKH,
} from "@/lib/youth-majlis/content";

const TIERS = ["Start here", "Alongside", "Going further"] as const;

export default async function IlmiPage() {
  // Inside the portal: the portal's password first, then ʿIlmī's own.
  if (!(await hasAccess("majlis"))) redirect("/youth-majlis");
  if (!(await hasAccess("ilmi"))) {
    return (
      <Gate
        area="ilmi"
        title="ʿIlmī."
        subtitle="Enter the ʿIlmī password to continue."
        mark={<span className="y-gate-book" aria-hidden />}
      />
    );
  }

  return (
    <div className="y-page">
      <Motion />
      <header className="y-nav y-nav--dark">
        <div className="y-nav-in">
          <Link href="/youth-majlis" className="y-nav-brand">
            <span className="y-mark y-mark--s" aria-hidden>T</span>
            ʿIlmī
          </Link>
          <nav className="y-nav-links" aria-label="Sections">
            <a href="#what">Uṣūl al-Fiqh</a>
            <a href="#roadmap">Road map</a>
            <a href="#reading">Pre-reading</a>
            <Link href="/youth-majlis">The Majlis</Link>
          </nav>
          <LeaveButton />
        </div>
        <span className="y-progress" aria-hidden />
      </header>

      <main>
        {/* ── The book ── */}
        <section className="y-band y-band--dark y-ilmi-hero" aria-labelledby="y-il-h">
          <p className="y-kicker y-kicker--light y-in" style={{ "--d": "0ms" } as React.CSSProperties}>The set text</p>
          <div className="y-in y-in--book" style={{ "--d": "150ms" } as React.CSSProperties}><Book3D /></div>
          <p className="bk-hint y-in" style={{ "--d": "900ms" } as React.CSSProperties}>Tap to open · drag to turn</p>
          <h1 id="y-il-h" className="y-display y-display--book y-in" style={{ "--d": "500ms" } as React.CSSProperties}>{ILMI_BOOK.title}.</h1>
          <p className="y-hero-sub y-in" style={{ "--d": "650ms" } as React.CSSProperties}>{ILMI_BOOK.author}</p>
          <p className="y-ilmi-note y-in" style={{ "--d": "800ms" } as React.CSSProperties}>{ILMI_BOOK.note}</p>
          <p className="y-next y-in" style={{ "--d": "950ms" } as React.CSSProperties}><strong>With {SHAYKH}.</strong> Three sessions, each over three Saturdays, intense and long. <span>Dates to be confirmed.</span></p>
        </section>

        {/* ── What it is ── */}
        <section id="what" className="y-band" aria-labelledby="y-what-h">
          <div className="y-wrap y-what">
            <p className="y-what-ar y-ink-scroll" lang="ar" dir="rtl" data-reveal>أُصُولُ ٱلْفِقْهِ</p>
            <h2 id="y-what-h" className="y-h2" data-reveal>What is Uṣūl al-Fiqh?</h2>
            <p className="y-lead" data-reveal>
              If fiqh is the answer, uṣūl is how the answer was reached.
            </p>
            <div className="y-prose" data-reveal>
              <p>
                <strong>Fiqh</strong> is the understanding of the practical rulings of Islam (how to
                pray, fast, trade, marry and inherit) as derived from their detailed evidences.
                <strong> Uṣūl al-Fiqh</strong>, literally <em>the roots of fiqh</em>, is the discipline
                that studies those evidences and the method of deriving rulings from them.
              </p>
              <p>
                It asks what counts as a source of law: the Qur’an, the Sunnah, consensus (ijmāʿ) and
                analogy (qiyās), and the further sources the schools debate; how a text is to be read (general and
                specific, absolute and qualified, command and prohibition, abrogation); how
                evidences that seem to conflict are reconciled; and who is qualified to do all of this.
              </p>
              <p>
                Imām al-Shāfiʿī’s <em>al-Risālah</em> is counted the first work to set it out
                systematically, and every school since has built upon it and argued with it.
              </p>
              <p className="y-prose-tie">
                It is also what stands behind the eighth question of the Majlis, <em>what jurisprudential
                rulings and principles can be derived from these āyāt?</em>, and what lets you follow a
                tafsīr’s legal discussion step by step, rather than taking its conclusion on trust.
              </p>
            </div>
          </div>
        </section>

        {/* ── Road map ── */}
        <section id="roadmap" className="y-band y-band--alt" aria-labelledby="y-road-h">
          <div className="y-wrap">
            <h2 id="y-road-h" className="y-h2" data-reveal>Three entrances.<br />Three Saturdays each.</h2>
            <p className="y-h2-sub" data-reveal>The madākhil to the Sharīʿah. Each is its own session, taught over three Saturdays, in the order the Shaykh has proposed.</p>
            <ol className="y-road">
              {ILMI_SESSIONS.map((s) => (
                <li key={s.n} className="y-stop" data-reveal data-reveal-i={s.n - 1}>
                  <span className="y-stop-n">{s.n}</span>
                  <span className="y-stop-ar" lang="ar" dir="rtl">{s.ar}</span>
                  <span className="y-stop-en">{s.en}</span>
                  <p className="y-stop-gist">{s.gist}</p>
                  <span className="y-stop-date">{s.date ?? "Three Saturdays. Dates to be confirmed."}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ── Pre-reading ── */}
        <section id="reading" className="y-band" aria-labelledby="y-read-h">
          <div className="y-wrap">
            <h2 id="y-read-h" className="y-h2" data-reveal>Before the first session.</h2>
            <p className="y-h2-sub" data-reveal>Start with the first two. Tick each off as you go.</p>
            <ReadingList reading={ILMI_READING} tiers={TIERS} />
          </div>
        </section>

        {/* ── Terms ── */}
        <section className="y-band y-band--alt" aria-labelledby="y-terms-h">
          <div className="y-wrap">
            <h2 id="y-terms-h" className="y-h2" data-reveal>Nine words for the first hour.</h2>
            <p className="y-h2-sub" data-reveal>The Arabic on the front, the meaning on the back. Tap a card to turn it.</p>
            <TermDeck terms={ILMI_TERMS} />
          </div>
        </section>

        {/* ── Cohort ── */}
        <section className="y-band" aria-labelledby="y-ic-h">
          <div className="y-wrap">
            <h2 id="y-ic-h" className="y-h2" data-reveal>Four students.</h2>
            <ul className="y-names y-names--big">
              {ILMI_COHORT.map((n, i) => <li key={n} className="y-name" data-reveal data-reveal-i={i}>{n}</li>)}
            </ul>
            <p className="y-h2-sub" data-reveal>Under the guidance of {SHAYKH}.</p>
          </div>
        </section>
      </main>

      <footer className="y-foot">
        Under the guidance of {SHAYKH}. Powered by <Link href="/home">TafsirLab</Link>.
      </footer>
    </div>
  );
}
