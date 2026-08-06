/**
 * waitlist-digest — post the signups you were never told about to the team inbox.
 *
 *   npm run waitlist:digest -- --dry    # print the email, send nothing
 *   npm run waitlist:digest             # send it, then mark those rows notified
 *   npm run waitlist:digest -- --all    # include ones already notified
 *
 * A catch-up, not a feature: Resend refused every notification for ten days
 * while the signups themselves were saved correctly, so this replays what
 * should have arrived at the time. Rows are only marked `notified` if Resend
 * actually accepts the message — a failed send must leave them visible to
 * `npm run waitlist` rather than quietly marking them done.
 *
 * Reads .env the same way the deployed app reads its environment. Never prints
 * the API key.
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const TEAM_INBOX = process.env.TEAM_INBOX || "salaam@tafsir-lab.com";

/* A bare node script gets no Next.js env loading. */
try {
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* rely on the real environment */ }

const args   = process.argv.slice(2);
const dryRun = args.includes("--dry");
const all    = args.includes("--all");

const db = new PrismaClient();

try {
  const rows = await db.waitlistSignup.findMany({
    where: all ? {} : { notified: false },
    orderBy: { createdAt: "asc" },
  });

  if (!rows.length) {
    console.log("\nNothing to send — every signup has already been passed on.\n");
    process.exit(0);
  }

  const plural = rows.length === 1 ? "signup" : "signups";
  const first  = rows[0].createdAt.toISOString().slice(0, 10);
  const last   = rows[rows.length - 1].createdAt.toISOString().slice(0, 10);

  const body = [
    `${rows.length} waitlist ${plural} you were never emailed about.`,
    ``,
    `They were stored correctly the whole time — the notification emails were`,
    `refused by Resend between ${first} and ${last} because no sending domain`,
    `was verified. That is fixed; this is the catch-up.`,
    ``,
    `${"—".repeat(58)}`,
    ``,
    ...rows.flatMap((s) => {
      const lines = [
        `${s.createdAt.toISOString().slice(0, 10)}   ${s.name || "(no name given)"}`,
        `             ${s.email}`,
      ];
      if (s.context) lines.push(`             how they study: ${s.context}`);
      if (s.source && s.source !== "direct") lines.push(`             came from: ${s.source}`);
      lines.push("");
      return lines;
    }),
    `${"—".repeat(58)}`,
    ``,
    `Reply to each of them directly — this digest is not reply-addressed to`,
    `anyone, so hitting reply here goes nowhere useful.`,
  ].join("\n");

  const subject = `${rows.length} waitlist ${plural} you missed (${first} – ${last})`;

  if (dryRun) {
    console.log(`\nTo:      ${TEAM_INBOX}`);
    console.log(`Subject: ${subject}\n`);
    console.log(body);
    console.log(`\n(dry run — nothing sent, nothing marked)\n`);
    process.exit(0);
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error(
      "\n  RESEND_API_KEY is not set.\n\n" +
      "  Copy it from Vercel → tafsir-lab → Settings → Environment Variables\n" +
      "  into your local .env, then run this again. Use --dry to preview the\n" +
      "  email without needing the key at all.\n",
    );
    process.exit(1);
  }

  const from = process.env.WAITLIST_FROM || "TafsirLab <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [TEAM_INBOX], subject, text: body }),
  });

  if (!res.ok) {
    console.error(`\n  Resend refused it (HTTP ${res.status}):`);
    console.error("  " + (await res.text()).slice(0, 400));
    console.error("\n  Nothing was marked as notified. Run `npm run check:email`.\n");
    process.exit(1);
  }

  console.log(`\n  Sent ${rows.length} ${plural} to ${TEAM_INBOX}.`);

  /* Only now. A row marked notified on a failed send is a signup that
     disappears from `npm run waitlist` without anyone having seen it. */
  const marked = await db.waitlistSignup.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { notified: true },
  });
  console.log(`  Marked ${marked.count} as passed on.\n`);
} finally {
  await db.$disconnect();
}
