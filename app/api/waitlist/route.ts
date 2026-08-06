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
import { memoryLimit, clientIp } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendTeamMail } from "@/lib/team-mail";

export const runtime = "nodejs";

/** Deliberately permissive but real: one @, a dot in the domain, no spaces. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function notify(entry: {
  email: string; name?: string | null; context?: string | null; source?: string | null;
}): Promise<boolean> {
  return sendTeamMail({
    label: "waitlist",
    replyTo: entry.email,
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
  });
}

export async function POST(req: NextRequest) {
  // Best-effort per-IP throttle: a public, unauthenticated form that both
  // writes a row and sends mail, so it wants some brake on flooding. This is
  // the per-instance layer only (see lib/rate-limit) — a soft cap, not a wall.
  if (!memoryLimit(`waitlist:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

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
