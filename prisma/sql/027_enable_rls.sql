-- Row-level security on every public table (owner's request, 7 Nov 2026).
-- Supabase exposes the public schema through its REST API to the anon and
-- authenticated roles; with RLS off, anyone holding the project's public key
-- could read or write these tables directly. RLS with no policies denies
-- those roles everything. The app is unaffected: Prisma connects as
-- "postgres", which has BYPASSRLS.
--
-- Run this again after adding a table (it is safe to repeat).
DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;
