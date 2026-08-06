/**
 * /beta/request — apply for a place in the closed beta.
 *
 * Sits beside /beta, which is the hands-on tour. Someone who has just played
 * with the tour and wants in lands here; the page does not re-pitch the
 * product, it explains that places are limited and why it is asking.
 *
 * Visual language is the waitlist's, imported rather than restated, so the two
 * public pages are recognisably the same product.
 */
import type { Metadata } from "next";
import BetaRequestForm from "./BetaRequestForm";
import "../../waitlist/waitlist.css";
import "./beta-request.css";

export const metadata: Metadata = {
  title: "Request a place · TafsirLab closed beta",
  description:
    "TafsirLab is in closed beta. Tell us how you study the Qur’an and we’ll consider you for a place.",
  openGraph: {
    title: "TafsirLab — closed beta",
    description:
      "A workspace built for studying the Qur’an. Tell us how you study and request a place.",
    type: "website",
  },
  /* Not indexed: this is a limited-places form, and a search result for it
     outlives the cohort it was opened for. */
  robots: { index: false, follow: true },
};

/** `?from=` distinguishes Instagram traffic from anything else, same as the
 *  waitlist page. */
export default async function BetaRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const source = (from || "direct").slice(0, 60);

  return (
    <main className="wl-page">
      <div className="wl-shell">
        <header className="wl-head">
          <div className="wl-mark" aria-hidden>T</div>
          <span className="wl-wordmark">TafsirLab</span>
        </header>

        <p className="wl-eyebrow">Closed beta</p>
        <h1 className="wl-title">
          Request a place.
        </h1>
        <p className="wl-sub">
          We’re letting people in a few at a time, so the ones who are in get
          looked after properly.
        </p>
        <p className="br-intro">
          These questions aren’t a test — they tell us who we’re building for
          and what to fix first. A sentence each is plenty.
        </p>

        <BetaRequestForm source={source} />

        <a className="br-back" href="/beta">← Try the tour first</a>

        <footer className="wl-foot">
          <span>© TafsirLab</span>
          <a href="mailto:salaam@tafsir-lab.com">salaam@tafsir-lab.com</a>
        </footer>
      </div>
    </main>
  );
}
