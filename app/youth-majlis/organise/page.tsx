/**
 * /youth-majlis/organise — the organiser's desk.
 *
 * Behind the portal's gate, a TafsirLab sign-in and the organiser role. Shows
 * who is ready for the next session (counts only), and edits everything the
 * portal shows: sessions, prep, takeaways, assignments, the cohort.
 */

export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionOrNull } from "@/lib/session";
import { hasAccess } from "@/lib/youth-majlis/gate";
import { cohort, currentModule, getSessions, getSettings, isOrganiser, nextSession } from "@/lib/youth-majlis/data";
import { MODULES, TAB_TITLES } from "@/lib/youth-majlis/content";
import OrganiserApp from "@/components/youth-majlis/OrganiserApp";
import LeaveButton from "@/components/youth-majlis/LeaveButton";

export default async function OrganisePage() {
  if (!(await hasAccess("majlis"))) redirect("/youth-majlis");
  const session = await getSessionOrNull();
  if (!session) redirect("/login");
  if (!(await isOrganiser(session.userId))) redirect("/youth-majlis");

  const [sessions, settings] = await Promise.all([getSessions(), getSettings()]);
  const next = nextSession(sessions);
  const modN = currentModule(sessions);
  const mod = MODULES.find((m) => m.n === modN) ?? MODULES[0];
  const members = await cohort(mod.surah);
  const slim = MODULES.map(({ n, surahEn, surah }) => ({ n, surahEn, surah }));

  return (
    <div className="y-page og-page">
      <header className="y-nav">
        <div className="y-nav-in">
          <Link href="/youth-majlis" className="y-nav-brand">
            <span className="y-mark y-mark--s" aria-hidden>T</span>
            Organise
          </Link>
          <nav className="y-nav-links" aria-label="Sections">
            <a href="#og-ready">Ready</a>
            <a href="#og-sessions">Sessions</a>
            <a href="#og-assign">Research</a>
            <a href="#og-cohort">Cohort</a>
            <Link href="/youth-majlis">The portal</Link>
          </nav>
          <LeaveButton />
        </div>
      </header>
      <main className="y-wrap og-main">
        <h1 className="og-title">Organise.</h1>
        <OrganiserApp
          sessions={sessions} members={members} modules={slim} tabTitles={TAB_TITLES}
          nextId={next?.id ?? null} readinessFor={{ n: mod.n, surahEn: mod.surahEn, surah: mod.surah }}
          settings={settings} meId={session.userId}
        />
      </main>
    </div>
  );
}
