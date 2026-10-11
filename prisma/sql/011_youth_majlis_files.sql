-- Files the portal hands out, such as the class notes as a PDF. Kept in the
-- database, not the repository: the repository is public and these belong to
-- the cohort. Served only through a route behind the portal's password.
CREATE TABLE "YouthMajlisFile" (
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "YouthMajlisFile_pkey" PRIMARY KEY ("name")
);
