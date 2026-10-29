-- Private Mushaf boards (owner's request, 29 Oct 2026, for the Youth Majlis
-- cohort). In a workspace with this on, every member has their own Mushaf
-- board on each page, which only they write on and only they and the admins
-- can see, and the page's shared board is written on by admins alone. Text
-- notes stay shared, and members cannot make private ones. The boards' ink
-- is in realtime rooms named "<pageId>.u.<userId>" (party/), not here.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "privateBoards" BOOLEAN NOT NULL DEFAULT false;

-- The Youth Majlis cohort workspace has it on.
UPDATE "Workspace" SET "privateBoards" = true
 WHERE "id"::text = (SELECT "data"->>'cohortWorkspaceId' FROM "YouthMajlisSettings" WHERE "id" = 'main');

-- Organisers run that workspace, so they are its admins: they write on the
-- shared board and see everyone's. Students stay members.
UPDATE "WorkspaceMember" m SET "role" = 'admin'
  FROM "YouthMajlisProgress" p
 WHERE m."userId" = p."userId" AND p."role" = 'organiser' AND m."role" = 'member'
   AND m."workspaceId"::text = (SELECT "data"->>'cohortWorkspaceId' FROM "YouthMajlisSettings" WHERE "id" = 'main');
INSERT INTO "WorkspaceMember" ("workspaceId", "userId", "role")
SELECT (s."data"->>'cohortWorkspaceId')::uuid, p."userId", 'admin'
  FROM "YouthMajlisProgress" p, "YouthMajlisSettings" s
 WHERE s."id" = 'main' AND s."data"->>'cohortWorkspaceId' IS NOT NULL AND p."role" = 'organiser'
ON CONFLICT DO NOTHING;
