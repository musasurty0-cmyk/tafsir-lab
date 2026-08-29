-- Run once, AFTER the embeddings are loaded.
--
-- m/ef_construction are pgvector's defaults; they are a reasonable point on the
-- build-time/recall curve for a corpus this size, and raising them costs build
-- minutes on a free instance for recall we cannot measure at this scale.
CREATE INDEX IF NOT EXISTS tafsir_chunk_embedding_idx
  ON "TafsirChunk" USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ANALYZE "TafsirChunk";
