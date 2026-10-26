/**
 * Collaboration config — single source of truth for the PartyKit host.
 *
 * CRITICAL: the previous fallback was "localhost:1999" in ALL environments.
 * NEXT_PUBLIC_PARTYKIT_HOST only existed in the local .env (which is
 * gitignored), so production builds on Vercel inlined the localhost
 * fallback — every client tried ws://localhost:1999 and live sync was
 * completely dead in production.
 *
 * Now the deployed realtime worker is the production default; the env var
 * remains as an override, and localhost is used only in development.
 * (Hosted PartyKit shut down on 23 Oct 2026; the server is now the
 * Cloudflare Worker in party/, deployed with `npm run party:deploy`.)
 */

export const PARTYKIT_HOST: string =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST
  ?? (process.env.NODE_ENV === "development"
        ? "localhost:1999"
        : "tafsir-lab-realtime.tafsir-lab.workers.dev");
