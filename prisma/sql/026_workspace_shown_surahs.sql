-- Sūrahs on a workspace's grid (owner's request, 9 Nov 2026, for the Youth
-- Majlis cohort). Organisers choose which sūrahs the workspace shows; an empty
-- list means all 114, so every existing workspace is unchanged. Pages already
-- made in a sūrah left off the list keep their work; the sūrah is only hidden
-- from the grid and the sūrah switcher.
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "shownSurahs" INTEGER[] NOT NULL DEFAULT '{}';

-- The cohort studies Al-Fātiḥah, Al-Furqān, Aṣ-Ṣaff and Al-Muzzammil.
UPDATE "Workspace" SET "shownSurahs" = '{1,25,61,73}'
 WHERE "id"::text = (SELECT "data"->>'cohortWorkspaceId' FROM "YouthMajlisSettings" WHERE "id" = 'main');
