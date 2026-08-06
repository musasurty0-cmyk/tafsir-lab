/**
 * /beta — the tour.
 *
 * It used to be a standalone walkthrough component that described the app from
 * outside it. Now it drops you into a real demo workspace, seeded with the
 * notes the tour actually talks about, with the tutorial already running —
 * the tour IS the product rather than a recording of it.
 *
 * The page itself only exists for the cases where that cannot happen. The
 * normal path redirects to /api/beta/start, which has to be a route handler
 * because it sets the session cookie.
 */
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import "../waitlist/waitlist.css";
import "./request/beta-request.css";

export const metadata: Metadata = {
  title: "Try TafsirLab",
  description: "A hands-on tour of TafsirLab in a real workspace — no sign-up.",
  robots: { index: true, follow: true },
};

const NOTES: Record<string, { title: string; body: string }> = {
  busy: {
    title: "The tour is busy.",
    body: "A few too many people started one at once. Give it a minute and try again — nothing is broken.",
  },
  failed: {
    title: "That didn’t start properly.",
    body: "Something went wrong setting up your workspace. Try again in a moment; if it keeps happening we’d like to know.",
  },
  unavailable: {
    title: "The tour is closed just now.",
    body: "We open it in batches while the beta is small. Request a place and we’ll let you in.",
  },
};

export default async function BetaPage({
  searchParams,
}: {
  searchParams: Promise<{ busy?: string; failed?: string; unavailable?: string }>;
}) {
  const sp = await searchParams;
  const note = sp.unavailable ? "unavailable" : sp.busy ? "busy" : sp.failed ? "failed" : null;

  /* No note means an ordinary visit: go and get a workspace. The redirect is
     the whole point of this page. */
  if (!note) redirect("/api/beta/start");

  const { title, body } = NOTES[note];

  return (
    <main className="wl-page">
      <div className="wl-shell">
        <header className="wl-head">
          <div className="wl-mark" aria-hidden>T</div>
          <span className="wl-wordmark">TafsirLab</span>
        </header>

        <p className="wl-eyebrow">Tour</p>
        <h1 className="wl-title">{title}</h1>
        <p className="wl-sub">{body}</p>

        <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 34, flexWrap: "wrap" }}>
          {note !== "unavailable" && (
            <a className="wl-submit" href="/beta"
               style={{ width: "auto", padding: "0 28px", textDecoration: "none", display: "grid", placeItems: "center" }}>
              Try again
            </a>
          )}
          <a className="br-back" href="/beta/request" style={{ marginTop: 0 }}>
            Request a place →
          </a>
        </div>

        <footer className="wl-foot">
          <span>© TafsirLab</span>
          <a href="mailto:salaam@tafsir-lab.com">salaam@tafsir-lab.com</a>
        </footer>
      </div>
    </main>
  );
}
