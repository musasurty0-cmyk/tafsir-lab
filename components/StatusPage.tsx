/**
 * The page shown in place of one that could not be: not found, no access, or
 * an error. Themed through the app's tokens (the old ones were hard-coded
 * greys that sank into the dark theme), one filled action, and a sentence a
 * reader can act on instead of a stack trace.
 */
import Link from "next/link";

export default function StatusPage({
  title,
  body,
  primary,
  reference,
}: {
  title: string;
  body: string;
  /** The one filled action. Defaults to the dashboard. */
  primary?: { label: string; onClick: () => void };
  /** An error's digest, so a report can be matched to the server's log. */
  reference?: string;
}) {
  return (
    <main className="status-page">
      <h1 className="status-title">{title}</h1>
      <p className="status-body">{body}</p>
      <div className="status-actions">
        {primary ? (
          <>
            <button className="status-primary" onClick={primary.onClick}>{primary.label}</button>
            <Link className="status-link" href="/home">Go to your dashboard ›</Link>
          </>
        ) : (
          <Link className="status-primary" href="/home">Go to your dashboard</Link>
        )}
      </div>
      {reference && <p className="status-ref">Reference {reference}</p>}
    </main>
  );
}
