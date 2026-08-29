/**
 * POST /api/feedback — a signed-in user telling us something.
 *
 * Mail-only by design: there is no Feedback table because nothing in the app
 * reads feedback back, and a row nobody queries is a liability rather than a
 * record. If RESEND_API_KEY is unset the send is a no-op and this returns
 * { delivered: false } rather than pretending — the form then says so instead
 * of thanking the user for a message that went nowhere.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { sendTeamMail } from "@/lib/team-mail";
import { memoryLimit, clientIp } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-errors";

export const runtime = "nodejs";

const KINDS = ["bug", "idea", "content", "other"] as const;
const LABEL: Record<string, string> = {
  bug: "Bug", idea: "Idea", content: "Content correction", other: "Something else",
};

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getSession();

    // Same shape of limit the other public forms use: a person reporting a bug
    // twice is normal, twenty times in a minute is a script.
    if (!memoryLimit(`feedback:${clientIp(req)}`, 5, 60_000)) {
      return NextResponse.json({ error: "Too many messages just now. Try again shortly." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({})) as { kind?: unknown; message?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (message.length < 4)
      return NextResponse.json({ error: "Please write a little more." }, { status: 400 });
    if (message.length > 5000)
      return NextResponse.json({ error: "That is too long — 5000 characters max." }, { status: 400 });

    const kind = (KINDS as readonly string[]).includes(String(body.kind)) ? String(body.kind) : "other";

    const user = await db.user.findUnique({
      where: { id: userId }, select: { name: true, email: true },
    });

    const delivered = await sendTeamMail({
      subject: `[Feedback · ${LABEL[kind]}] ${user?.name ?? "A user"}`,
      text:
        `${LABEL[kind]} from ${user?.name ?? "unknown"} <${user?.email ?? "unknown"}>\n` +
        `user id: ${userId}\n\n${message}\n`,
      replyTo: user?.email,
      label:   "feedback",
    });

    return NextResponse.json({ ok: true, delivered });
  } catch (err) {
    return apiError(err);
  }
}
