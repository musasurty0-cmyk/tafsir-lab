/**
 * POST /api/beta/request — apply for a place in the closed beta.
 *
 * Sibling of /api/waitlist, with one deliberate difference. The waitlist writes
 * the row first and treats mail as best-effort, because the row is the source
 * of truth there. Here the answers are the point — they decide who gets a
 * place — so the request must survive EITHER dependency being down: the row is
 * attempted, the email is attempted, and the submission only fails if both
 * failed. A database outage should not turn someone away from a form they took
 * five minutes over.
 *
 * Mail goes out through Resend's REST API (no SDK), and only when
 * RESEND_API_KEY is set. See .env.example — unset means the row is still
 * written and nobody is emailed, which is why `notified` exists.
 */
import { memoryLimit, clientIp } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { STUDY_BUCKETS, AGE_MIN, AGE_MAX, type StudyBucket } from "@/lib/beta";
import { sendTeamMail } from "@/lib/team-mail";

export const runtime = "nodejs";

/** Deliberately permissive but real: one @, a dot in the domain, no spaces. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface Answers {
  email: string;
  name: string;
  age: number | null;
  studyDaily: string;
  studyTools: string;
  benefit: string;
  source: string;
}

function notify(a: Answers): Promise<boolean> {
  return sendTeamMail({
    label: "beta-request",
    /* reply_to is the applicant, so answering is one click from the
       notification rather than a copy-paste of their address. */
    replyTo: a.email,
    subject: `Closed beta request: ${a.name} <${a.email}>`,
    text: [
      `Closed beta request`,
      ``,
      `Name:    ${a.name}`,
      `Email:   ${a.email}`,
      `Age:     ${a.age ?? "—"}`,
      `Source:  ${a.source}`,
      ``,
      `Studies daily:`,
      `  ${a.studyDaily}`,
      ``,
      `What they study with today:`,
      a.studyTools,
      ``,
      `How TafsirLab would help them:`,
      a.benefit,
    ].join("\n"),
  });
}

export async function POST(req: NextRequest) {
  /* Public, unauthenticated, and it both writes a row and sends mail — the
     same soft per-instance brake the waitlist uses. */
  if (!memoryLimit(`beta-request:${clientIp(req)}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const str = (v: unknown, max: number) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const name = str(body.name, 120);
  if (!name) {
    return NextResponse.json({ error: "Please tell us your name." }, { status: 400 });
  }

  /* Age is optional, but a value that IS given has to be a real one — an
     unparseable age silently stored as null loses information without saying
     so. Bounds are wide on purpose; this is a sanity check, not a gate. */
  let age: number | null = null;
  if (body.age !== undefined && body.age !== null && body.age !== "") {
    const n = Number(body.age);
    if (!Number.isInteger(n) || n < AGE_MIN || n > AGE_MAX) {
      return NextResponse.json(
        { error: `Please enter an age between ${AGE_MIN} and ${AGE_MAX}.` }, { status: 400 },
      );
    }
    age = n;
  }

  const studyDaily = str(body.studyDaily, 60);
  if (!studyDaily || !STUDY_BUCKETS.includes(studyDaily as StudyBucket)) {
    return NextResponse.json(
      { error: "Please choose how much you study each day." }, { status: 400 },
    );
  }

  const studyTools = str(body.studyTools, 1000);
  if (!studyTools) {
    return NextResponse.json(
      { error: "Please tell us what you study with at the moment." }, { status: 400 },
    );
  }

  const benefit = str(body.benefit, 2000);
  if (!benefit) {
    return NextResponse.json(
      { error: "Please tell us how TafsirLab would help you." }, { status: 400 },
    );
  }

  const answers: Answers = {
    email, name, age, studyDaily, studyTools, benefit,
    source: str(body.source, 60) ?? "direct",
  };

  /* Attempt both, independently. Applying twice is the same person changing
     their mind, so it updates rather than erroring. */
  let stored = false;
  let alreadyApplied = false;
  let rowId: string | null = null;
  try {
    const existing = await db.betaRequest.findUnique({ where: { email } });
    alreadyApplied = Boolean(existing);
    const row = existing
      ? await db.betaRequest.update({
          where: { email },
          data: {
            name, age, studyDaily, studyTools, benefit,
            userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
          },
        })
      : await db.betaRequest.create({
          data: {
            ...answers,
            userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
          },
        });
    stored = true;
    rowId = row.id;
  } catch (err) {
    /* Logged, not surfaced: the applicant can do nothing about it, and the
       email below may still get their answers to us. */
    console.error("[beta-request] could not store:", err);
  }

  const sent = await notify(answers);

  if (stored && sent && rowId) {
    try {
      await db.betaRequest.update({ where: { id: rowId }, data: { notified: true } });
    } catch { /* the request is safe either way; this flag is bookkeeping */ }
  }

  /* Only a total failure is a failure. If the row was written we have the
     answers; if the mail went out we have them too. */
  if (!stored && !sent) {
    console.error("[beta-request] BOTH store and notify failed for", email);
    return NextResponse.json(
      { error: "Something went wrong. Please try again in a moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, alreadyApplied }, { status: 201 });
}
