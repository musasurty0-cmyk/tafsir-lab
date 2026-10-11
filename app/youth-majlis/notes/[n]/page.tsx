/**
 * /youth-majlis/notes/[n] — the class notes for one module, as the Majlis
 * compiled them: the passage, then the sūrah through the ten questions, with
 * the circle's reflections beside the scholars, and a summary to close.
 * Behind the portal's password, like everything else here.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Gate from "@/components/youth-majlis/Gate";
import LeaveButton from "@/components/youth-majlis/LeaveButton";
import Motion from "@/components/youth-majlis/Motion";
import { PassageView, PointsIndex } from "@/components/youth-majlis/NotesInteractive";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { MODULES, SHAYKH } from "@/lib/youth-majlis/content";
import { getNotes, getSources, modulesWithNotes } from "@/lib/youth-majlis/notes";

export default async function NotesPage({ params }: { params: Promise<{ n: string }> }) {
  if (!(await hasAccess("majlis"))) redirect("/youth-majlis");
  const { n } = await params;
  const mod = MODULES.find((m) => String(m.n) === n);
  if (!mod) notFound();
  const [notes, sources, available] = await Promise.all([getNotes(mod.n), getSources(), modulesWithNotes()]);
  if (!notes) notFound();

  const others = MODULES.filter((m) => m.n !== mod.n && available.has(m.n));
  const points = notes.sections.map((s) => ({ n: s.n, title: s.title }));

  return (
    <div className="y-page yn">
      <Motion />
      <header className="y-nav">
        <div className="y-nav-in">
          <Link href="/youth-majlis" className="y-nav-brand">
            <span className="y-mark y-mark--s" aria-hidden>T</span>
            Youth Majlis
          </Link>
          <nav className="y-nav-links" aria-label="Sections">
            <a href="#passage">Passage</a>
            <a href="#points">The ten points</a>
            {notes.summary && <a href="#summary">Summary</a>}
            {sources && <a href="#sources">Sources</a>}
            <a href="/youth-majlis/notes/pdf" download>PDF</a>
          </nav>
          <LeaveButton />
        </div>
        <span className="y-progress" aria-hidden />
      </header>

      <main>
        {/* ── Title ── */}
        <section className="y-band y-hero yn-hero" aria-labelledby="yn-h">
          <p className="y-kicker y-in" style={{ "--d": "0ms" } as React.CSSProperties}>Class notes · Module {mod.n}</p>
          <p className="yn-hero-ar y-in" style={{ "--d": "120ms" } as React.CSSProperties} lang="ar" dir="rtl">{mod.surahAr}</p>
          <h1 id="yn-h" className="y-display y-in" style={{ "--d": "240ms" } as React.CSSProperties}>
            {mod.surahEn}{mod.passage ? ` ${mod.passage.from}–${mod.passage.to}` : ""}.
          </h1>
          <p className="y-hero-sub y-in" style={{ "--d": "360ms" } as React.CSSProperties}>{mod.title}.</p>
          <p className="yn-meta y-in" style={{ "--d": "480ms" } as React.CSSProperties}>{notes.meta.join(" · ")}</p>
          <div className="y-cta y-in" style={{ "--d": "600ms" } as React.CSSProperties}>
            <a className="y-btn" href="#points">Read the notes</a>
            <a className="y-more" href={`/youth-majlis/open/${mod.surah}`}>Open in TafsirLab</a>
            <a className="y-more" href="/youth-majlis/notes/pdf" download>Download as PDF</a>
          </div>
          <p className="yn-credit y-in" style={{ "--d": "720ms" } as React.CSSProperties}>
            Study notes and reflections of the Majlis, under the guidance of {SHAYKH}.
          </p>
        </section>

        {/* ── The passage ── */}
        <section id="passage" className="y-band y-band--alt yn-band" aria-labelledby="yn-p-h">
          <div className="y-wrap yn-narrow">
            <h2 id="yn-p-h" className="y-h2" data-reveal>The passage.</h2>
            <p className="y-h2-sub" data-reveal>
              {mod.passage ? `Āyāt ${mod.passage.from} to ${mod.passage.to}` : `All ${mod.ayat} āyāt`}, in the King Fahd Complex’s Uthmani script.
            </p>
            <div data-reveal><PassageView verses={notes.verses} basmala={notes.basmala} /></div>
          </div>
        </section>

        {/* ── The ten points ── */}
        <section id="points" className="y-band yn-band" aria-labelledby="yn-t-h">
          <div className="y-wrap">
            <h2 id="yn-t-h" className="y-h2" data-reveal>Through the ten questions.</h2>
            {notes.intro && <div className="yn-prose yn-lead" data-reveal dangerouslySetInnerHTML={{ __html: notes.intro }} />}
            <div className="yn-layout">
              <PointsIndex points={points} />
              <div className="yn-points">
                {notes.sections.map((s) => (
                  <article key={s.n} id={`point-${s.n}`} data-point={s.n} className="yn-point" aria-labelledby={`yn-pt-${s.n}`}>
                    <header className="yn-point-head">
                      <span className="yn-point-n" aria-hidden>{s.n}</span>
                      <h3 id={`yn-pt-${s.n}`} className="yn-point-h">{s.title}.</h3>
                    </header>
                    <div className="yn-prose" dangerouslySetInnerHTML={{ __html: s.html }} />
                    <a className="y-more yn-point-go" href={`/youth-majlis/open/${mod.surah}?point=${s.n}`}>Add yours in TafsirLab</a>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Summary ── */}
        {notes.summary && (
          <section id="summary" className="y-band y-band--dark" aria-labelledby="yn-s-h">
            <div className="y-wrap yn-narrow">
              <h2 id="yn-s-h" className="y-h2" data-reveal>In summary.</h2>
              <div className="yn-prose yn-summary" data-reveal dangerouslySetInnerHTML={{ __html: notes.summary }} />
            </div>
          </section>
        )}

        {/* ── Sources ── */}
        {sources && (
          <section id="sources" className="y-band y-band--alt" aria-labelledby="yn-src-h">
            <div className="y-wrap">
              <h2 id="yn-src-h" className="y-h2" data-reveal>Sources.</h2>
              <p className="y-h2-sub" data-reveal>The editions the notes quote from, across all three sūrahs.</p>
              <div className="yn-sources">
                {sources.groups.map((g) => (
                  <div key={g.title} className="yn-source" data-reveal>
                    <h3 className="yn-source-h">{g.title}</h3>
                    <ul>{g.items.map((it, i) => <li key={i} dangerouslySetInnerHTML={{ __html: it }} />)}</ul>
                  </div>
                ))}
              </div>
              <p className="yn-mistakes" data-reveal>
                The reflections and conclusions here are based on tafsīr and personal study. Any mistakes are from us, and Allah knows best.
              </p>
            </div>
          </section>
        )}

        {/* ── The other notes ── */}
        {others.length > 0 && (
          <section className="y-band" aria-labelledby="yn-o-h">
            <div className="y-wrap">
              <h2 id="yn-o-h" className="y-h2" data-reveal>More class notes.</h2>
              <div className="yn-others">
                {others.map((m, i) => (
                  <Link key={m.n} href={`/youth-majlis/notes/${m.n}`} className="yn-other" data-reveal data-reveal-i={i}>
                    <span className="yn-other-k">Module {m.n}</span>
                    <span className="yn-other-ar" lang="ar" dir="rtl">{m.surahAr}</span>
                    <span className="yn-other-en">{m.surahEn}{m.passage ? ` ${m.passage.from}–${m.passage.to}` : ""}</span>
                    <span className="yn-other-t">{m.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="y-foot">
        <Link href="/youth-majlis">Back to the Majlis</Link> · Powered by TafsirLab
      </footer>
    </div>
  );
}
