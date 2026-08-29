"""
embed_corpus — turn the ingested tafsir into a searchable vector index.

Run this on Colab's free T4. It is the whole "training" step, and it is not
training: nothing about the model changes. The model reads each passage once
and records where it sits in meaning-space, so that later a question can be
placed in the same space and the nearest real passages found.

That distinction is the point of the design. A fine-tuned model would learn to
*write like* al-Tabari, which is exactly how you end up attributing invented
commentary to a named scholar. This never generates a word of tafsir. It only
ever points at text a human wrote, which is why quoting is possible and
hallucination is not.

WHAT IT DOES
    1. reads TafsirEntry rows straight from Supabase
    2. splits each into paragraph-aligned spans
    3. embeds each span with multilingual-e5-small (Arabic and English, one space)
    4. writes TafsirChunk rows back: the vector plus [start, end) offsets

Resumable. Every (source, verse) already chunked is skipped, so a dropped Colab
session costs the current batch and nothing else.

USAGE (Colab)
    !pip -q install sentence-transformers psycopg2-binary
    !python embed_corpus.py                 # everything not yet embedded
    !python embed_corpus.py --source ar-tafsir-ibn-kathir
    !python embed_corpus.py --limit 3000    # a taste, to check quality first
"""

from __future__ import annotations

import argparse
import getpass
import os
import re
import sys
import time

# ── Model ──────────────────────────────────────────────────────────────────
# 384 dims, 12 layers, ~470 MB. Chosen over a larger model for three reasons
# that all matter here: it puts Arabic and English in ONE space (so an English
# question finds an Arabic passage), it runs at a sane speed on a free CPU box
# at query time, and 384 dims keeps the index inside a free Postgres tier.
#
# e5 REQUIRES these prefixes. Without them retrieval degrades sharply and
# silently — the vectors are still valid, only worse, which is the hardest kind
# of mistake to notice. The query side must use "query: "; see the Space.
MODEL_NAME = "intfloat/multilingual-e5-small"
PASSAGE_PREFIX = "passage: "

# ── Chunking ───────────────────────────────────────────────────────────────
# A chunk must be small enough that its embedding means one thing, and large
# enough to stand alone as a quotation. Classical tafsir runs to 8,000 chars a
# verse and occasionally 99,000; one vector over that averages away everything
# specific in it.
TARGET_CHARS = 1200
MIN_CHARS = 120

# NO OVERLAP, and that is a storage decision taken knowingly. Chunks are
# contiguous [start, end) spans, so the database stores two integers per chunk
# rather than a second copy of the whole corpus - about 300 MB on this dataset,
# which is the difference between fitting in a free Postgres tier and not.
# Overlap would slightly help a sentence straddling a boundary; the lexical
# index over the full entry text already covers that case.

# Ceiling per verse. Al-Tabari on 2:255 would otherwise contribute eighty
# chunks and dominate every search that touches it - a storage problem and a
# relevance problem at once.
MAX_CHUNKS_PER_ENTRY = 8

BATCH_ENTRIES = 400      # rows read per round trip
EMBED_BATCH = 128        # spans per forward pass

SENT_END = re.compile(r"[.!?۔؟]\s+")
PARA_SPLIT = re.compile(r"(\n\s*\n)")


def split_into_chunks(text: str) -> list[tuple[int, int]]:
    """
    Paragraph-aligned chunks, as [start, end) offsets into `text`.

    Splits on blank lines first, because tafsir is written in paragraphs and a
    paragraph is the natural quotable unit; only a paragraph longer than the
    target is broken further, and then at sentence ends rather than mid-word.

    Offsets rather than strings so the chunk table holds no second copy of the
    corpus. Every span is contiguous, so text[start:end] is exactly the passage
    that was embedded - what the vector describes can always be reconstructed.
    """
    if not text or not text.strip():
        return []

    # Paragraph bounds as offsets into the ORIGINAL string, so spans stay valid
    # against the stored content.
    paras: list[tuple[int, int]] = []
    pos = 0
    for part in PARA_SPLIT.split(text):
        if part and not PARA_SPLIT.fullmatch(part):
            a, b = pos, pos + len(part)
            while a < b and text[a].isspace():
                a += 1
            while b > a and text[b - 1].isspace():
                b -= 1
            if b > a:
                paras.append((a, b))
        pos += len(part or "")

    if not paras:
        stripped = text.strip()
        a = text.index(stripped)
        paras = [(a, a + len(stripped))]

    spans: list[tuple[int, int]] = []
    cur_start: int | None = None
    cur_end = 0

    def flush() -> None:
        nonlocal cur_start
        if cur_start is not None and cur_end - cur_start >= MIN_CHARS:
            spans.append((cur_start, cur_end))
        cur_start = None

    for a, b in paras:
        if b - a > TARGET_CHARS:
            flush()
            seg = a
            for m in SENT_END.finditer(text, a, b):
                end = m.end()
                if end - seg >= TARGET_CHARS:
                    spans.append((seg, end))
                    seg = end
            if b - seg >= MIN_CHARS:
                spans.append((seg, b))
            elif spans and seg < b:
                # A short tail joins the previous span rather than becoming a
                # fragment nobody could quote.
                spans[-1] = (spans[-1][0], b)
            continue

        if cur_start is not None and b - cur_start > TARGET_CHARS:
            flush()
        if cur_start is None:
            cur_start = a
        cur_end = b

    flush()

    # A very short entry yields nothing above MIN_CHARS but is still worth
    # indexing. Al-Jalalayn on a short verse is a single clause, and dropping it
    # would not read as "this edition is terse here" - it would read as the
    # edition having nothing to say, which is a different and false claim.
    if not spans:
        stripped = text.strip()
        if len(stripped) >= 15:
            a = text.index(stripped)
            spans = [(a, a + len(stripped))]

    return spans[:MAX_CHUNKS_PER_ENTRY]


def connect(dsn: str):
    import psycopg2
    # Supabase's pooler is the reachable host on IPv4-only networks; the direct
    # db.<ref>.supabase.co host resolves to IPv6 and simply times out. If this
    # hangs, that is almost always why.
    return psycopg2.connect(dsn, connect_timeout=30)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", help="only this TafsirSource slug")
    ap.add_argument("--limit", type=int, help="stop after N entries (trial run)")
    ap.add_argument("--redo", action="store_true", help="re-embed entries already chunked")
    args = ap.parse_args()

    dsn = os.environ.get("DATABASE_URL") or getpass.getpass("DATABASE_URL (pooler): ")

    from sentence_transformers import SentenceTransformer
    import torch
    from psycopg2.extras import execute_values

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"device: {device}")
    if device == "cpu":
        print("  (no GPU - this works, just slower. "
              "Colab: Runtime > Change runtime type > T4 GPU)")

    model = SentenceTransformer(MODEL_NAME, device=device)
    # fp16 halves memory and roughly doubles throughput on a T4, with no
    # meaningful effect on retrieval at 384 dims.
    if device == "cuda":
        model = model.half()

    conn = connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    # Must match the chunker's own floor. A stricter filter here would silently
    # exclude the short glosses the chunker is written to keep.
    where = ['e.content IS NOT NULL', 'length(e.content) >= 15']
    params: list = []
    if args.source:
        where.append("s.slug = %s")
        params.append(args.source)
    if not args.redo:
        # Resumability, as one anti-join rather than a lookup per entry.
        where.append('''NOT EXISTS (
            SELECT 1 FROM "TafsirChunk" c
            WHERE c."sourceId" = e."sourceId" AND c."verseKey" = e."verseKey")''')

    sql = '''
        SELECT e."sourceId", e."verseKey", e.content
        FROM "TafsirEntry" e
        JOIN "TafsirSource" s ON s.id = e."sourceId"
        WHERE ''' + " AND ".join(where) + '''
        ORDER BY e."sourceId", e."verseKey"
    '''
    if args.limit:
        sql += " LIMIT %d" % int(args.limit)

    print("reading entries...")
    cur.execute(sql, params)

    entries = chunks = 0
    t0 = time.time()

    while True:
        rows = cur.fetchmany(BATCH_ENTRIES)
        if not rows:
            break

        pending: list[tuple] = []   # sourceId, verseKey, surah, ayah, i, start, end, text
        for source_id, verse_key, content in rows:
            entries += 1
            try:
                surah_s, ayah_s = verse_key.split(":")
                surah, ayah = int(surah_s), int(ayah_s)
            except ValueError:
                print("  skipping malformed verseKey %r" % (verse_key,))
                continue
            for i, (a, b) in enumerate(split_into_chunks(content)):
                pending.append((source_id, verse_key, surah, ayah, i, a, b, content[a:b]))

        if not pending:
            continue

        vectors = model.encode(
            [PASSAGE_PREFIX + p[7] for p in pending],
            batch_size=EMBED_BATCH,
            # pgvector's cosine distance expects unit vectors; normalising here
            # means the index never has to.
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )

        values = [
            (p[0], p[1], p[2], p[3], p[4], p[5], p[6],
             "[" + ",".join("%.6f" % x for x in vec) + "]")
            for p, vec in zip(pending, vectors)
        ]

        execute_values(
            cur,
            '''INSERT INTO "TafsirChunk"
                 ("sourceId","verseKey",surah,ayah,"chunkIndex","startChar","endChar",embedding)
               VALUES %s
               ON CONFLICT ("sourceId","verseKey","chunkIndex") DO UPDATE
                 SET "startChar" = EXCLUDED."startChar",
                     "endChar"   = EXCLUDED."endChar",
                     embedding   = EXCLUDED.embedding''',
            values,
            template="(%s,%s,%s,%s,%s,%s,%s,%s::halfvec)",
            page_size=500,
        )
        conn.commit()

        chunks += len(values)
        rate = entries / max(time.time() - t0, 1e-6)
        print("  %7d entries -> %8d chunks (%.0f entries/s)" % (entries, chunks, rate))

    cur.close()
    conn.close()

    print("\ndone: %d entries -> %d chunks in %.1f min"
          % (entries, chunks, (time.time() - t0) / 60))
    print("\nNow build the index, once - prisma/sql/006_tafsir_index.sql")
    return 0


if __name__ == "__main__":
    sys.exit(main())
