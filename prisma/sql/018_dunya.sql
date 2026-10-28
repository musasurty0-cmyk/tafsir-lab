-- /dunya: a private A-level page. One row holds an scrypt hash of its
-- password (never the password, and never in this repository, which is
-- public), the list of papers, and the owner's attempts at them. The PDFs
-- themselves live in a private Cloudflare R2 bucket, not here. Additive only.
CREATE TABLE "DunyaPlan" (
    "id" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "catalog" JSONB NOT NULL,
    "progress" JSONB,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DunyaPlan_pkey" PRIMARY KEY ("id")
);
