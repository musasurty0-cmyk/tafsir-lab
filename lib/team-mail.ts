/**
 * One way to mail the team, used by /api/waitlist and /api/beta/request.
 *
 * Both had their own copy that ended `return res.ok` — so when Resend refused
 * a message, the REASON was discarded and the endpoint still reported success.
 * A misconfigured sender looked exactly like a working one, and the only
 * symptom was mail quietly never arriving. Resend puts a precise explanation
 * in the response body ("domain is not verified", "you can only send testing
 * emails to your own address"); it is now logged.
 */

/**
 * Where submissions are sent.
 *
 * Back to salaam@ now that tafsir-lab.com is verified in Resend and
 * WAITLIST_FROM is set in Vercel. Both are load-bearing: with an unverified
 * domain the code falls back to onboarding@resend.dev, and that sandbox sender
 * may only DELIVER to the address owning the Resend account — every message to
 * salaam@ came back 403 "Testing domain restriction", which cost 13 waitlist
 * signups that were stored but never announced.
 *
 * `npm run check:email` reports whether that is still true.
 */
export const TEAM_INBOX =
  process.env.TEAM_INBOX || "salaam@tafsir-lab.com";

/**
 * Resend will only accept a `from` on a domain verified in the account. The
 * fallback is Resend's shared sandbox sender, which additionally can only
 * DELIVER to the account owner's own address — fine for a first smoke test,
 * useless for mailing a team inbox. Set WAITLIST_FROM to something on a
 * verified domain in production.
 */
export function teamMailFrom(): string {
  return process.env.WAITLIST_FROM || "TafsirLab <onboarding@resend.dev>";
}

export interface TeamMail {
  subject: string;
  text: string;
  /** The person who submitted, so a reply goes straight back to them. */
  replyTo?: string;
  /** Prefix for the log line, e.g. "waitlist". */
  label: string;
}

/** @returns whether Resend accepted the message. Never throws. */
export async function sendTeamMail(mail: TeamMail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[${mail.label}] RESEND_API_KEY is not set — nothing was emailed.`);
    return false;
  }

  const from = teamMailFrom();
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [TEAM_INBOX],
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
        subject: mail.subject,
        text: mail.text,
      }),
    });

    if (res.ok) return true;

    /* The body is the whole point of this function existing. Resend's 4xx
       bodies name the exact problem, and without them a broken sender is
       indistinguishable from a working one. */
    const detail = await res.text().catch(() => "(no body)");
    console.error(
      `[${mail.label}] Resend REFUSED the message.\n` +
      `  status: ${res.status}\n` +
      `  from:   ${from}\n` +
      `  to:     ${TEAM_INBOX}\n` +
      `  resend: ${detail.slice(0, 500)}`,
    );
    return false;
  } catch (err) {
    console.error(`[${mail.label}] could not reach Resend:`, err);
    return false; // a mail failure must never fail the submission
  }
}
