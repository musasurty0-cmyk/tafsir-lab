/**
 * What one user actually costs, from real data.
 *
 * The point is not to predict the bill. Every service in this stack is
 * usage-based, so the bill already tracks reality on its own — nothing here is
 * provisioned in advance and there is no way to accidentally pay 100k prices at
 * 10k users. The point is UNIT ECONOMICS: cost per active user, so a price can
 * be set from evidence instead of a guess, and so the next tier upgrade is a
 * decision made early rather than an email from a provider.
 *
 * Run it monthly:  node scripts/unit-economics.mjs
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const DAYS = Number(process.env.WINDOW_DAYS ?? 30);
const since = new Date(Date.now() - DAYS * 864e5);
const DEMO = "demo.tafsirlab.local";
const real = { email: { not: { endsWith: `@${DEMO}` } } };

/* Plan floors and marginal rates. Verify against current provider pricing
   before trusting the projection — these move, and a stale rate here would
   quietly give a confident wrong answer. */
const RATE = {
  vercelPro:      20,     // $/mo
  supabasePro:    25,     // $/mo, 8 GB storage included
  storagePerGB:   0.125,  // $/GB/mo beyond the included 8
  realtimePerUser: 0.029, // $/active user/mo — Yjs room duration
  emailFloor:     20,
};
const FREE = { supabaseGB: 0.5, vercelInvocations: 1e6 };

const [users, activeUsers] = await Promise.all([
  db.user.count({ where: real }),
  db.user.count({ where: { ...real, OR: [
    { notes:    { some: { updatedAt: { gte: since } } } },
    { drawings: { some: { updatedAt: { gte: since } } } },
  ] } }),
]);

const dbBytes = Number((await db.$queryRawUnsafe(
  `SELECT pg_database_size(current_database())::bigint AS b`))[0].b);
const inkBytes = Number((await db.$queryRawUnsafe(
  `SELECT COALESCE(sum(pg_column_size(strokes)),0)::bigint AS b FROM "CanvasDrawing"`))[0].b);

const gb   = dbBytes / 1073741824;
const base = Math.max(1, activeUsers);
const perUserMB = dbBytes / 1048576 / base;

const line = (l, v) => console.log(`  ${l.padEnd(34)}${v}`);
console.log(`\n  ── TafsirLab unit economics · last ${DAYS} days ──\n`);
line("accounts (real, non-demo)", users);
line("active in window", activeUsers);
line("database", `${(dbBytes / 1048576).toFixed(1)} MB  (ink ${(inkBytes / dbBytes * 100).toFixed(0)}%)`);
line("storage per active user", `${perUserMB.toFixed(2)} MB`);

/* Where the current free tiers run out, at TODAY's per-user footprint. Recompute
   every month: the number moves as people annotate more heavily, and the whole
   value of this script is catching that drift before a provider does. */
console.log(`\n  ── headroom on the free tier ──\n`);
const capStorage = Math.floor((FREE.supabaseGB * 1024) / Math.max(perUserMB, 0.01));
line("Supabase 500 MB caps out at", `${capStorage.toLocaleString()} users like today's`);
line("Vercel Hobby ~1M calls caps at", `~${Math.floor(FREE.vercelInvocations / 1800).toLocaleString()} active users`);
line("first wall", capStorage < 550 ? "STORAGE — Supabase" : "REQUESTS — Vercel");
console.log(`  NOTE: Vercel Hobby forbids commercial use — charging money forces Pro regardless.`);

console.log(`\n  ── projected monthly cost ──\n`);
for (const n of [Math.max(base, 100), 1000, 10000, 100000]) {
  const storeGB = (perUserMB * n) / 1024;
  const overage = Math.max(0, storeGB - 8) * RATE.storagePerGB;
  const total = RATE.vercelPro + RATE.supabasePro + RATE.emailFloor
              + overage + n * RATE.realtimePerUser;
  console.log(`  ${String(n).padStart(7)} users   $${total.toFixed(0).padStart(6)}/mo   ${(total / n * 100).toFixed(2)}p per user   (storage ${storeGB.toFixed(1)} GB)`);
}

console.log(`\n  ── what to charge ──\n`);
const at10k = (RATE.vercelPro + RATE.supabasePro + RATE.emailFloor
  + Math.max(0, (perUserMB * 10000) / 1024 - 8) * RATE.storagePerGB
  + 10000 * RATE.realtimePerUser) / 10000;
line("cost per user at 10k", `${(at10k * 100).toFixed(2)}p`);
line("break-even at £4/mo", `${(at10k / 4 * 100).toFixed(2)}% of users paying`);
line("floor before you lose money", `£${(at10k * 1.0).toFixed(2)} if EVERY user paid`);
console.log(`\n  Realtime is ${(10000 * RATE.realtimePerUser / (at10k * 10000) * 100).toFixed(0)}% of the cost at 10k — it is the lever, not storage.\n`);

await db.$disconnect();
