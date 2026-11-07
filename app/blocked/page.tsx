/**
 * /blocked — the only thing a blocked user can see.
 *
 * getSession() redirects every blocked user here. This page must NOT call
 * getSession (that would bounce it straight back and loop), so it reads the
 * cookie with readUserId and looks the user up itself. A viewer who is not
 * actually blocked has no business here and is sent back to the app.
 */
import { redirect } from "next/navigation";
import { readUserId } from "@/lib/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const FALLBACK = "Your access to the program is paused. Please get in touch to restore it.";

export default async function BlockedPage() {
  const userId = await readUserId();
  if (!userId) redirect("/login");

  const user = await db.user.findUnique({
    where:  { id: userId },
    select: { blockedAt: true, blockReason: true },
  });

  // Not blocked (or gone) → back to the app; this page is only for the blocked.
  if (!user || user.blockedAt == null) redirect("/home");

  const message = user.blockReason?.trim() || FALLBACK;

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "var(--bg)",
        color: "var(--ink)",
      }}
    >
      <div style={{ width: "min(32rem, 100%)", textAlign: "center" }}>
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            margin: "0 auto 28px",
            borderRadius: 12,
            background: "var(--ink)",
            color: "var(--bg)",
            display: "grid",
            placeItems: "center",
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: 24,
            fontWeight: 600,
            lineHeight: 1,
          }}
        >
          T
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: "clamp(1.25rem, 1rem + 1.4vw, 1.6rem)",
            lineHeight: 1.45,
            color: "var(--ink)",
            textWrap: "balance",
          }}
        >
          {message}
        </p>
      </div>
    </main>
  );
}
