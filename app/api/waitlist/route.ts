/**
 * POST /api/waitlist — public waitlist signup (linked from the Instagram bio).
 *
 * Order matters: the row is written FIRST, then we try to notify the team.
 * If mail is misconfigured or the provider is down, the signup is still safely
 * recorded — the opposite order would silently lose real people.
 *
 * Mail uses Resend's REST API directly (no SDK dependency). It only runs when
 * RESEND_API_KEY is set; without it the endpoint still succeeds and the signup
 * is queryable from the database.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const TEAM_INBOX = "studywithtafsirlab@gmail.com";

/** Deliberately permissive but real: one @, a dot in the domain, no spaces. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function notify(entry: {
  email: string; name?: string | null; context?: string | null; source?: string | null;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  // Resend requires a verified sender; fall back to their shared onboarding
  // domain so this works before a custom domain is set up.
  const from = process.env.WAITLIST_FROM || "TafsirLab <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [TEAM_INBOX],
        reply_to: entry.email,
        subject: `Waitlist: ${entry.email}`,
        text: [
          `New TafsirLab waitlist signup`,
          ``,
          `Email:   ${entry.email}`,
          `Name:    ${entry.name || "—"}`,
          `Source:  ${entry.source || "—"}`,
          ``,
          `How they study today:`,
          entry.context || "—",
        ].join("\n"),
      }),
    });
    return res.ok;
  } catch {
    return false; // never let a mail failure fail the signup
  }
}

export async function POST(req: NextRequest) {
  let body: { email?: unknown; name?: unknown; context?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const name = str(body.name, 120);
  const context = str(body.context, 1000);
  const source = str(body.source, 60) ?? "direct";

  try {
    // Signing up twice is not an error — it's the same person, so treat it as
    // idempotent and keep the newest context they gave us.
    const existing = await db.waitlistSignup.findUnique({ where: { email } });
    const entry = existing
      ? await db.waitlistSignup.update({
          where: { email },
          data: { name: name ?? existing.name, context: context ?? existing.context },
        })
      : await db.waitlistSignup.create({
          data: {
            email, name, context, source,
            userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
          },
        });

    if (!existing) {
      const sent = await notify({ email, name, context, source });
      if (sent) {
        await db.waitlistSignup.update({ where: { id: entry.id }, data: { notified: true } });
      }
    }

    return NextResponse.json({ ok: true, alreadyJoined: Boolean(existing) }, { status: 201 });
  } catch (err) {
    console.error("[waitlist] failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
