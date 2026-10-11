-- The Majlis's compiled class notes, one row per module (0 = the sources).
-- Kept in the database, not the repository: the repository is public and the
-- notes belong to the cohort. "data" holds the passage, the ten points and
-- the summary as the notes page renders them.
CREATE TABLE "YouthMajlisNote" (
    "moduleN" INTEGER NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YouthMajlisNote_pkey" PRIMARY KEY ("moduleN")
);
