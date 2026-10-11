/**
 * /youth-majlis/ilmi — the ʿIlmī track: an intensive in Uṣūl al-Fiqh with
 * Shaykh Omid, for four students, behind its own password.
 *
 * Centred on the set text, Kamali's Principles of Islamic Jurisprudence, and
 * on what to read before the first session.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import Gate from "@/components/youth-majlis/Gate";
import Book3D from "@/components/youth-majlis/Book3D";
import LeaveButton from "@/components/youth-majlis/LeaveButton";
import { hasAccess } from "@/lib/youth-majlis/gate";
import {
  ILMI_BOOK, ILMI_COHORT, ILMI_READING, ILMI_SESSIONS, ILMI_TERMS, SHAYKH,
} from "@/lib/youth-majlis/content";

const LEVELS = ["Start here", "Alongside", "Going further"] as const;

export default async function IlmiPage() {
  // The ʿIlmī section sits inside the portal: its gate comes second.
  if (!(await hasAccess("majlis"))) redirect("/youth-majlis");

  if (!(await hasAccess("ilmi"))) {
    return (
      <Gate
        area="ilmi"
        eyebrow="Youth Majlis · ʿIlmī"
        title="Uṣūl al-Fiqh"
        subtitle={`A closed intensive with ${SHAYKH}. Enter the ʿIlmī password.`}
      >
        <span className="ym-gate-book" aria-hidden />
      </Gate>
    );
  }

  return (
    <div className="ym-page ym-page--ilmi">
      <header className="ym-top">
        <Link href="/youth-majlis" className="ym-brand">
          <span className="ym-mark ym-mark--small" aria-hidden>T</span>
          <span className="ym-brand-name">Youth Majlis</span>
          <span className="ym-brand-x">·</span>
          <span className="ym-brand-name ym-brand-name--alt">ʿIlmī</span>
        </Link>
        <nav className="ym-top-nav" aria-label="Sections">
          <a href="#what">What it is</a>
          <a href="#roadmap">Road map</a>
          <a href="#reading">Pre-reading</a>
          <Link href="/youth-majlis">← The Majlis</Link>
          <LeaveButton />
        </nav>
      </header>

      <main className="ym-main">
        {/* ── The book ── */}
        <section className="il-hero" aria-labelledby="il-title">
          <Book3D />
          <div className="il-hero-text">
            <p className="ym-eyebrow">The set text</p>
            <h1 id="il-title" className="il-title">{ILMI_BOOK.title}</h1>
            <p className="il-author">{ILMI_BOOK.author}</p>
            <p className="ym-lede">{ILMI_BOOK.note}</p>
            <p className="il-meta">
              With {SHAYKH} · two or three Saturdays · intense, long sessions · dates to be confirmed
            </p>
          </div>
        </section>

        {/* ── What it is ── */}
        <section id="what" className="ym-section il-what" aria-labelledby="il-what-title">
          <p className="il-what-ar" lang="ar" dir="rtl">أُصُولُ ٱلْفِقْه</p>
          <h2 id="il-what-title" className="ym-h2">What is Uṣūl al-Fiqh?</h2>
          <div className="il-prose">
            <p>
              <strong>Fiqh</strong> is the understanding of the practical rulings of Islam — how to
              pray, fast, trade, marry and inherit — as derived from their detailed evidences.
              <strong> Uṣūl al-Fiqh</strong>, literally <em>the roots of fiqh</em>, is the discipline
              that studies those evidences and the method of deriving rulings from them.
            </p>
            <p>
              It asks what counts as a source of law — the Qur’an, the Sunnah, consensus (ijmāʿ) and
              analogy (qiyās), and the further sources the schools debate; how a text is to be read —
              general and specific, absolute and qualified, command and prohibition, abrogation; how
              evidences that seem to conflict are reconciled; and who is qualified to do all of this.
            </p>
            <p>
              If fiqh is the answer, uṣūl is how the answer was reached. Imām al-Shāfiʿī’s
              <em> al-Risālah</em> is counted the first work to set it out systematically, and every
              school since has built upon it and argued with it.
            </p>
            <p className="il-tie">
              It is also what stands behind the eighth question of the Majlis — <em>what jurisprudential
              rulings and principles can be derived from these āyāt?</em> — and what lets you follow a
              tafsīr’s legal discussion step by step rather than taking its conclusion on trust.
            </p>
          </div>
        </section>

        {/* ── Road map ── */}
        <section id="roadmap" className="ym-section" aria-labelledby="il-road-title">
          <div className="ym-section-head">
            <p className="ym-eyebrow">The road map</p>
            <h2 id="il-road-title" className="ym-h2">Three madākhil — three entrances to the Sharīʿah</h2>
            <p className="ym-lede">Each its own session, in the order the Shaykh has proposed.</p>
          </div>
          <ol className="il-road">
            {ILMI_SESSIONS.map((s) => (
              <li key={s.n} className="il-stop">
                <span className="il-stop-n">Session {s.n}</span>
                <span className="il-stop-ar" lang="ar" dir="rtl">{s.ar}</span>
                <span className="il-stop-en">{s.en}</span>
                <p className="il-stop-gist">{s.gist}</p>
                <span className="il-stop-date">{s.date ?? "Saturday · date to be confirmed"}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Pre-reading ── */}
        <section id="reading" className="ym-section" aria-labelledby="il-read-title">
          <div className="ym-section-head">
            <p className="ym-eyebrow">Before the first session</p>
            <h2 id="il-read-title" className="ym-h2">Recommended pre-reading</h2>
            <p className="ym-lede">
              Start with the first two. The rest are there for whoever wants to go further before we
              begin — not required.
            </p>
          </div>
          {LEVELS.map((lv) => (
            <div key={lv} className="il-read-group">
              <h3 className="ym-h4">{lv}</h3>
              <ul className="il-reads">
                {ILMI_READING.filter((r) => r.level === lv).map((r) => (
                  <li key={r.title} className="il-read">
                    <span className="il-read-title">{r.title}</span>
                    <span className="il-read-author">{r.author}</span>
                    <span className="il-read-why">{r.why}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {/* ── Terms ── */}
        <section className="ym-section" aria-labelledby="il-terms-title">
          <div className="ym-section-head">
            <p className="ym-eyebrow">Worth knowing</p>
            <h2 id="il-terms-title" className="ym-h2">Nine terms you will meet in the first hour</h2>
          </div>
          <dl className="il-terms">
            {ILMI_TERMS.map((t) => (
              <div key={t.tr} className="il-term">
                <dt>
                  <span className="il-term-ar" lang="ar" dir="rtl">{t.ar}</span>
                  <span className="il-term-tr">{t.tr}</span>
                </dt>
                <dd>{t.en}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Cohort ── */}
        <section className="ym-section ym-split">
          <div>
            <p className="ym-eyebrow">The ʿIlmī cohort</p>
            <ul className="ym-cohort ym-cohort--big">
              {ILMI_COHORT.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </div>
          <div>
            <p className="ym-eyebrow">Under the guidance of</p>
            <p className="il-shaykh">{SHAYKH}</p>
          </div>
        </section>
      </main>

      <footer className="ym-footer">
        Under the guidance of {SHAYKH} · Powered by <Link href="/home">TafsirLab</Link>
      </footer>
    </div>
  );
}
