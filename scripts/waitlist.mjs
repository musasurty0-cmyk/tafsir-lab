/**
 * waitlist — who has signed up, and who was never told about.
 *
 *   npm run waitlist          # everyone, newest last
 *   npm run waitlist -- --new # only those the team was never emailed about
 *   npm run waitlist -- --beta# closed-beta applications instead
 *
 * Exists because the row is the source of truth and the notification email is
 * best-effort: when Resend refused every message for ten days, 13 real signups
 * were sitting safely in the database with nothing on screen to say so. The
 * `notified` column is the difference between "nobody signed up" and "nobody
 * told you", and until now there was no way to look at it without writing a
 * query by hand.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const args = process.argv.slice(2);
const onlyNew = args.includes("--new");
const beta = args.includes("--beta");

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const warn = (s) => `\x1b[33m${s}\x1b[0m`;

try {
  if (beta) {
    const rows = await db.betaRequest.findMany({
      where: onlyNew ? { notified: false } : {},
      orderBy: { createdAt: "asc" },
    });
    console.log(`\n${bold(String(rows.length))} closed-beta request${rows.length === 1 ? "" : "s"}` +
                (onlyNew ? " never emailed to you" : "") + "\n");
    for (const r of rows) {
      console.log(`${dim(r.createdAt.toISOString().slice(0, 10))}  ${bold(r.name)}` +
                  (r.age ? dim(`  (${r.age})`) : "") +
                  (r.notified ? "" : warn("  · not emailed")));
      console.log(`            ${r.email}`);
      console.log(`            studies ${r.studyDaily.toLowerCase()} a day`);
      console.log(`            with: ${r.studyTools}`);
      console.log(`            wants: ${r.benefit}`);
      console.log("");
    }
  } else {
    const rows = await db.waitlistSignup.findMany({
      where: onlyNew ? { notified: false } : {},
      orderBy: { createdAt: "asc" },
    });
    const missed = rows.filter((r) => !r.notified).length;
    console.log(`\n${bold(String(rows.length))} waitlist signup${rows.length === 1 ? "" : "s"}` +
                (onlyNew ? " never emailed to you" : "") + "\n");
    for (const s of rows) {
      console.log(`${dim(s.createdAt.toISOString().slice(0, 10))}  ${bold(s.name || "(no name)")}` +
                  (s.notified ? "" : warn("  · not emailed")));
      console.log(`            ${s.email}`);
      if (s.context) console.log(`            ${dim("studies with:")} ${s.context}`);
      console.log("");
    }
    if (!onlyNew && missed) {
      console.log(warn(`${missed} of these were never emailed to the team.`) +
                  dim("  Run `npm run check:email` if that is still happening.\n"));
    }
  }
} finally {
  await db.$disconnect();
}
