-- Vector store for the tafsir assistant.
--
-- Apply with psql or the Supabase SQL editor. (A naive JS statement-splitter
-- will mangle the multi-line CREATE TABLE below.)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- One row per retrievable passage: a slice of one edition's commentary on one
-- verse.
--
-- The passage is stored as [startChar, endChar) into TafsirEntry.content, NOT
-- as a copy of the text. Copying would put the entire corpus in the database a
-- second time — roughly 300 MB here, the difference between fitting a free
-- tier and not. Spans are contiguous and non-overlapping, so
-- substr(content, startChar+1, endChar-startChar) is exactly the text that was
-- embedded.
--
-- halfvec (2 bytes/dim) rather than vector (4): at 384 dims the recall
-- difference between fp16 and fp32 is not measurable, and the storage
-- difference is half.
--
-- verseKey/surah/ayah are denormalised onto the chunk so a filtered search
-- ("only al-Qurtubi", "only 2:255") is a plain WHERE and never a join.
CREATE TABLE IF NOT EXISTS "TafsirChunk" (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "sourceId"   uuid NOT NULL REFERENCES "TafsirSource"(id) ON DELETE CASCADE,
  "verseKey"   text NOT NULL,
  surah        int  NOT NULL,
  ayah         int  NOT NULL,
  "chunkIndex" int  NOT NULL,
  "startChar"  int  NOT NULL,
  "endChar"    int  NOT NULL,
  -- intfloat/multilingual-e5-small: Arabic and English in one space, and small
  -- enough to run on a free CPU Space at query time.
  embedding    halfvec(384),
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("sourceId", "verseKey", "chunkIndex"),
  CONSTRAINT tafsir_chunk_span_valid CHECK ("endChar" > "startChar" AND "startChar" >= 0)
);

CREATE INDEX IF NOT EXISTS tafsir_chunk_source_idx ON "TafsirChunk" ("sourceId");
CREATE INDEX IF NOT EXISTS tafsir_chunk_verse_idx  ON "TafsirChunk" (surah, ayah);

-- Lexical search runs over the ENTRY text, not the chunk, because the chunk no
-- longer stores text. That is not a compromise: trigram search wants the whole
-- passage anyway, and matching at entry level then mapping to chunks gives the
-- same answers with one index instead of two.
--
-- It earns its place because vector search alone misses exact phrases and
-- proper nouns — precisely what a citation-first assistant is asked for.
CREATE INDEX IF NOT EXISTS tafsir_entry_trgm_idx
  ON "TafsirEntry" USING gin (content gin_trgm_ops);

-- The HNSW index is built separately, AFTER the embeddings are loaded — see
-- 006_tafsir_index.sql. Building it first and then inserting 200k rows is far
-- slower, and pgvector does not need it to answer, only to answer quickly.
