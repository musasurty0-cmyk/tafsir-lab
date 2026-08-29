# The tafsīr assistant

Answers questions by **quoting the tafsīr in this database**. It has no access
to the web, it does not paraphrase, and it cannot generate a sentence of
commentary. When it finds nothing it says so.

## Why retrieval, not fine-tuning

Fine-tuning a model on tafsīr teaches it the *style* of tafsīr. The result
writes fluent, confident commentary that no scholar wrote, in the voice of
scholars who did — and it cannot cite, because weights carry no provenance.

Everything asked for here (quotes, no invention, nothing from the web, show the
sources, pin a source) is a property of **retrieval**:

| Requirement | How it is met |
|---|---|
| Give quotes | The answer *is* the retrieved sentences |
| No hallucination | `verifyExtractive` re-checks every sentence against its source before sending |
| Nothing from the web | The only data is `TafsirEntry` rows in this database |
| Show what it pulled from | The trace is built from the same objects as the answer |
| Let me pin a source | A `WHERE s.slug = ANY(...)` |

The free T4 is still used — to **embed the corpus**, which is the right job for
a one-off GPU session.

## Pipeline

```
ingest          scripts/ingest-corpus.mjs      tafsir → TafsirEntry
embed (Colab)   ml/embed_corpus.py             entries → TafsirChunk (span + vector)
serve           ml/space/app.py                query embedding + ar→en translation
retrieve        lib/services/tafsir-search…    semantic + lexical, fused by RRF
answer          lib/tafsir/answer.ts           select sentences, verify, cite
chat            app/assistant/                 streamed trace + quotes
```

## Setup

1. **Ingest** — `node scripts/ingest-corpus.mjs` (~40 min, resumable)
2. **Schema** — apply `prisma/sql/005_tafsir_vectors.sql` in the Supabase SQL editor
3. **Embed** — open `ml/Tafsir_Embed_Colab.ipynb`, set Runtime → T4 GPU, run
4. **Index** — apply `prisma/sql/006_tafsir_index.sql` *after* embedding
5. **Space** — deploy `ml/space/` as a free Gradio Space, then set
   `TAFSIR_MODEL_SPACE=https://<user>-<space>.hf.space`

Every step degrades honestly. Without the Space the assistant falls back to
keyword search and says so; without embeddings the picker says nothing is
indexed rather than showing an empty list.

## Costs

Nothing. Colab free T4 for the one-off embedding, a free CPU Space for two
small models, pgvector inside the Supabase instance already in use, and the
tafsīr text from a public CDN.

## The one design decision worth knowing

`TafsirChunk` stores `[startChar, endChar)` offsets, **not** copies of the text.
Storing the text would put the corpus in the database twice — about 300 MB
here, the difference between fitting a free tier and not. It also means a
quotation is provably the exact text that was embedded.
