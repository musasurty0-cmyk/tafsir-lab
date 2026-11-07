-- Blocking a user (owner's request, 7 Nov 2026). A blocked user keeps their
-- account and data but cannot reach any part of the app: every authenticated
-- request redirects them to a single page that shows blockReason and nothing
-- else. Unblocking is clearing blockedAt. The app enforces this in getSession
-- (lib/session.ts); there is no effect on anyone whose blockedAt is NULL.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "blockedAt"   TIMESTAMPTZ;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "blockReason" TEXT;

-- The two accounts to block now, with the message they should see.
UPDATE "User"
   SET "blockedAt"   = now(),
       "blockReason" = 'Salaam - Please check your Instagram messages to regain access to the program.'
 WHERE lower("email") IN ('aishahakbar0@gmail.com', 'aishahakbar03@gmail.com');
