/**
 * /waitlist — the public landing page linked from the Instagram bio.
 *
 * Deliberately one screen: someone arriving from a Reel has already been sold
 * to. The job here is to confirm they're in the right place and take an email,
 * not to re-pitch the product. Visual language matches the film — white,
 * serif display, near-monochrome.
 */
import type { Metadata } from "next";
import WaitlistForm from "./WaitlistForm";
import "./waitlist.css";

export const metadata: Metadata = {
  title: "Join the waitlist · TafsirLab",
  description:
    "TafsirLab is a workspace built for studying the Qur’an — Mushaf, notes, handwriting and classical tafsir in one place. Join the waitlist.",
  openGraph: {
    title: "TafsirLab — a workspace built for the Qur’an",
    description:
      "Mushaf, notes, handwriting and classical tafsir in one connected workspace. Join the waitlist.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

/** `?from=` lets us tell Instagram traffic apart from anything else. */
export default async function WaitlistPage({
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

        <p className="wl-eyebrow">Coming soon</p>
        <h1 className="wl-title">
          A workspace built<br />for the Qur’an.
        </h1>
        <p className="wl-sub">
          The Mushaf, your notes, your handwriting and classical tafsir —
          in one place, instead of five.
        </p>

        <WaitlistForm source={source} />

        <ul className="wl-list">
          <li><span aria-hidden>✳</span> Notes that live inside the ayah — and inside a single word</li>
          <li><span aria-hidden>✳</span> Write and annotate by hand, straight onto the page</li>
          <li><span aria-hidden>✳</span> Classical tafsir in Arabic and English, side by side</li>
          <li><span aria-hidden>✳</span> Study on your own, or with a circle</li>
        </ul>

        <footer className="wl-foot">
          <span>© TafsirLab</span>
          <a href="mailto:studywithtafsirlab@gmail.com">studywithtafsirlab@gmail.com</a>
        </footer>
      </div>
    </main>
  );
}
