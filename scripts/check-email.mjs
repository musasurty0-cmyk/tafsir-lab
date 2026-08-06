/**
 * check-email — why is nothing arriving at the team inbox?
 *
 *   node scripts/check-email.mjs           # diagnose only
 *   node scripts/check-email.mjs --send    # also send one real test message
 *
 * Reads .env itself: a bare node script gets no Next.js env loading, and the
 * whole point is to run this the same way in a terminal as the deployed app
 * runs in Vercel. Never prints the API key.
 *
 * Exists because the app used to discard Resend's rejection reason, so a
 * misconfigured sender was indistinguishable from a working one — mail simply
 * never showed up and nothing said why. The two usual causes after a domain
 * change are both diagnosed below.
 */
import { readFileSync } from "node:fs";

const TEAM_INBOX = "salaam@tafsir-lab.com";

/* ── env ─────────────────────────────────────────────────────────────────── */
function loadEnv() {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const v = m[2].replace(/^["']|["']$/g, "");
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch { /* no .env — rely on the real environment */ }
}
loadEnv();

const key  = process.env.RESEND_API_KEY;
const from = process.env.WAITLIST_FROM || "TafsirLab <onboarding@resend.dev>";
const usingSandbox = !process.env.WAITLIST_FROM;

const ok = (s) => console.log("  \x1b[32m✓\x1b[0m " + s);
const no = (s) => console.log("  \x1b[31m✗\x1b[0m " + s);
const hm = (s) => console.log("  \x1b[33m!\x1b[0m " + s);

console.log("\nTafsirLab mail check\n");

if (!key) {
  no("RESEND_API_KEY is not set.");
  console.log(`
  Nothing can be sent at all. Submissions are still stored in the database,
  and the endpoint still reports success — which is exactly why this looks
  like "emails stopped arriving" rather than an error.

  Set it in Vercel (Project → Settings → Environment Variables) and locally
  in .env, then redeploy.
`);
  process.exit(1);
}
ok(`RESEND_API_KEY is set (${key.slice(0, 6)}…, ${key.length} chars)`);
console.log(`  from: ${from}`);
console.log(`  to:   ${TEAM_INBOX}\n`);

/* ── which domains does the account actually have? ───────────────────────── */
const res = await fetch("https://api.resend.com/domains", {
  headers: { Authorization: `Bearer ${key}` },
});

/* A sending-only key cannot list domains, and that is the RIGHT kind of key
   for an app that only ever posts to /emails — least privilege. Treating the
   401 as "bad key" was wrong: it says nothing about whether sending works. */
let domains = [];
let canListDomains = true;
if (!res.ok) {
  const detail = await res.text();
  if (res.status === 401 && detail.includes("restricted_api_key")) {
    canListDomains = false;
    ok("RESEND_API_KEY is a send-only key (cannot list domains — that is fine)");
  } else {
    no(`Resend rejected the API key (HTTP ${res.status}).`);
    console.log("  " + detail.slice(0, 300));
    console.log("\n  A key is tied to one Resend account. If you rebuilt the");
    console.log("  account or rotated keys, generate a new one and update Vercel.\n");
    process.exit(1);
  }
} else {
  domains = (await res.json()).data ?? [];
}

if (!canListDomains) {
  console.log("");
  if (usingSandbox) {
    hm("WAITLIST_FROM is unset, so the shared sandbox sender is being used.");
    console.log(`
  onboarding@resend.dev can ONLY deliver to the address that owns the Resend
  account, so anything sent to ${TEAM_INBOX} is refused. Set WAITLIST_FROM to
  an address on a verified domain.
`);
  } else {
    ok(`Sending as ${from}.`);
    console.log(`
  This key cannot list domains, so verification cannot be confirmed from here
  — check Resend → Domains, or just run with --send and read the result.
`);
  }
  if (!process.argv.includes("--send")) process.exit(usingSandbox ? 1 : 0);
}
console.log("Domains in this Resend account:");
if (!domains.length) hm("none — no custom domain has been added yet");
for (const d of domains) {
  const verified = d.status === "verified";
  (verified ? ok : no)(`${d.name}  —  ${d.status}${d.region ? ` (${d.region})` : ""}`);
}

/* ── the two failure modes worth naming ──────────────────────────────────── */
const fromDomain = (from.match(/<([^>]+)>/)?.[1] ?? from).split("@")[1]?.trim();
console.log("");

if (usingSandbox) {
  hm("WAITLIST_FROM is unset, so the shared sandbox sender is being used.");
  console.log(`
  onboarding@resend.dev can ONLY deliver to the email address that owns the
  Resend account. Sending it to ${TEAM_INBOX} is refused unless that IS the
  account address — which is the most common reason mail silently stops.

  Fix: verify your domain in Resend, then set
       WAITLIST_FROM="TafsirLab <salaam@tafsir-lab.com>"
  in Vercel and .env.
`);
} else {
  const match = domains.find((d) => d.name === fromDomain);
  if (!match) {
    no(`The from-domain "${fromDomain}" is not in this Resend account.`);
    console.log(`
  Resend only accepts a from-address on a domain you have added AND verified.
  If you changed domains, the old one is probably still in WAITLIST_FROM.
  Add "${fromDomain}" in Resend → Domains, or point WAITLIST_FROM at one of
  the domains listed above.
`);
  } else if (match.status !== "verified") {
    no(`"${fromDomain}" is added but its status is "${match.status}".`);
    console.log(`
  Its DNS records are not satisfied yet, so every send is refused. Open
  Resend → Domains → ${fromDomain} and copy the DKIM/SPF records into your
  DNS host, then press Verify. Propagation is usually minutes, up to an hour.
`);
  } else {
    ok(`"${fromDomain}" is verified — the sender is good.`);
    console.log(`
  If mail still is not reaching you, the problem is AFTER Resend: check
  Resend → Emails for the delivery status of recent sends. "Delivered" there
  means Resend handed it over and the issue is ${TEAM_INBOX} itself — most
  likely its forwarding/alias rule was not recreated on the new domain.
`);
  }
}

/* ── optionally prove it end to end ──────────────────────────────────────── */
if (process.argv.includes("--send")) {
  console.log(`Sending one test message to ${TEAM_INBOX}…`);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [TEAM_INBOX],
      subject: "TafsirLab mail check",
      text: "If you are reading this, the waitlist and beta-request notifications can reach you.",
    }),
  });
  const body = await r.text();
  if (r.ok) {
    ok(`Resend accepted it — ${body}`);
    console.log(`
  Accepted is not the same as delivered. If it does not appear, look at
  Resend → Emails for this message's final status.
`);
  } else {
    no(`Resend refused it (HTTP ${r.status}):`);
    console.log("  " + body.slice(0, 400) + "\n");
  }
}
