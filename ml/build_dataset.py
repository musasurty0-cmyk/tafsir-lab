"""
build_dataset — turn the ingested tafsir into dataset.jsonl for fine-tuning.

Every example is REAL TEXT from the database. Nothing is generated, and no
question or answer is invented: the assistant turns are the scholars' own words
as ingested, and the user turns are templated around the verse and edition that
text actually belongs to.

Two kinds of pair, because the assistant is wanted for two things:

  ask     "What does al-Qurtubi say about 2:255?"  -> that edition's commentary
  render  Arabic commentary                        -> the same work's English

The second only exists where one work was ingested in both languages (Ibn
Kathir, al-Jalalayn, al-Mukhtasar). Those are genuinely aligned on the same
verse by the same author, which is what makes them usable as translation pairs
rather than two unrelated texts about the same ayah.

Assistant turns carry a citation line. A fine-tune learns format as much as
content, so citing is taught here rather than left to the prompt to enforce
later.

USAGE
    python ml/build_dataset.py                    # everything, capped
    python ml/build_dataset.py --max 4000         # smaller, for a quick run
    python ml/build_dataset.py --out dataset.jsonl
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import random
import sys

SYSTEM = (
    "You are a Qur'anic tafsir assistant. You answer only from the tafsir "
    "passages you are given, you quote them rather than paraphrasing freely, "
    "and you cite the work and verse for every claim. If the passages do not "
    "answer the question, say so."
)

# How the user might ask for one edition on one verse. Varied so the model does
# not learn a single sentence shape and fail on anything else.
ASK_TEMPLATES = [
    "What does {source} say about {verse}?",
    "Show me {source} on {verse}.",
    "{source} — {verse}?",
    "Explain {verse} according to {source}.",
    "I'm reading {verse}. What does {source} say?",
]

RENDER_TEMPLATES = [
    "Translate this passage from {source} on {verse} into English.",
    "What does this say? ({source}, {verse})\n\n{arabic}",
    "Give me the English of {source} on {verse}.",
]

# Commentary runs to thousands of characters. A 1.5B model with a short context
# cannot train on an 8,000-character target, and a truncated one teaches it to
# stop mid-sentence — so long entries are cut at a sentence end near the cap.
MAX_ANSWER_CHARS = 1400
MIN_ANSWER_CHARS = 120


def clip(text: str, cap: int = MAX_ANSWER_CHARS) -> str:
    """Trim to a sentence boundary near the cap, never mid-word."""
    t = " ".join(text.split())
    if len(t) <= cap:
        return t
    window = t[:cap]
    for end in (".", "۔", "؟", "!", "?"):
        i = window.rfind(end)
        if i > cap * 0.6:
            return window[: i + 1]
    i = window.rfind(" ")
    return window[:i] if i > 0 else window


def connect(dsn: str):
    import psycopg2
    # The pooler host, not db.<ref>.supabase.co — that one is IPv6-only and
    # simply hangs on an IPv4 network.
    return psycopg2.connect(dsn, connect_timeout=30)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="dataset.jsonl")
    ap.add_argument("--max", type=int, default=6000,
                    help="cap on total examples (a 1.5B LoRA needs thousands, not tens of thousands)")
    ap.add_argument("--seed", type=int, default=7)
    args = ap.parse_args()

    random.seed(args.seed)   # same input, same dataset
    dsn = os.environ.get("DATABASE_URL") or getpass.getpass("DATABASE_URL (pooler): ")

    conn = connect(dsn)
    cur = conn.cursor()

    # ── ask pairs ──────────────────────────────────────────────────────────
    cur.execute(
        """
        SELECT s.name, s.language, e."verseKey", e.content
        FROM "TafsirEntry" e
        JOIN "TafsirSource" s ON s.id = e."sourceId"
        WHERE length(e.content) BETWEEN %s AND 20000
        """,
        (MIN_ANSWER_CHARS,),
    )
    rows = cur.fetchall()
    print(f"{len(rows):,} entries available")

    ask: list[dict] = []
    for name, lang, verse, content in rows:
        body = clip(content)
        if len(body) < MIN_ANSWER_CHARS:
            continue
        ask.append({
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user",
                 "content": random.choice(ASK_TEMPLATES).format(source=name, verse=verse)},
                {"role": "assistant", "content": f"{body}\n\n— {name}, {verse}"},
            ]
        })

    # ── render (translation) pairs ─────────────────────────────────────────
    # Same work, same verse, two languages. Paired on the verse key, which is
    # what makes them aligned rather than merely adjacent.
    PAIRS = [
        ("ar-tafsir-ibn-kathir",   "en-tafisr-ibn-kathir",   "Ibn Kathir"),
        ("ar-tafsir-al-jalalayn",  "en-al-jalalayn",         "al-Jalalayn"),
        ("ar-tafsir-al-mukhtasar", "en-tafsir-al-mukhtasar", "al-Mukhtasar"),
    ]
    render: list[dict] = []
    for ar_slug, en_slug, label in PAIRS:
        cur.execute(
            """
            SELECT a."verseKey", a.content, b.content
            FROM "TafsirEntry" a
            JOIN "TafsirSource" sa ON sa.id = a."sourceId" AND sa.slug = %s
            JOIN "TafsirSource" sb ON sb.slug = %s
            JOIN "TafsirEntry" b ON b."sourceId" = sb.id AND b."verseKey" = a."verseKey"
            WHERE length(a.content) BETWEEN %s AND 6000
              AND length(b.content) BETWEEN %s AND 6000
            """,
            (ar_slug, en_slug, MIN_ANSWER_CHARS, MIN_ANSWER_CHARS),
        )
        got = cur.fetchall()
        print(f"  {label}: {len(got):,} aligned ar/en pairs")
        for verse, ar, en in got:
            a_clip, e_clip = clip(ar, 900), clip(en)
            if len(a_clip) < MIN_ANSWER_CHARS or len(e_clip) < MIN_ANSWER_CHARS:
                continue
            tpl = random.choice(RENDER_TEMPLATES)
            user = tpl.format(source=label, verse=verse, arabic=a_clip) \
                if "{arabic}" in tpl else \
                f"{tpl.format(source=label, verse=verse)}\n\n{a_clip}"
            render.append({
                "messages": [
                    {"role": "system", "content": SYSTEM},
                    {"role": "user", "content": user},
                    {"role": "assistant", "content": f"{e_clip}\n\n— {label}, {verse}"},
                ]
            })

    cur.close()
    conn.close()

    # ── mix ────────────────────────────────────────────────────────────────
    # Roughly a third translation, so the behaviour is learned without swamping
    # the far larger pool of ask pairs.
    random.shuffle(ask)
    random.shuffle(render)
    want_render = min(len(render), args.max // 3)
    want_ask = min(len(ask), args.max - want_render)
    data = ask[:want_ask] + render[:want_render]
    random.shuffle(data)

    with open(args.out, "w", encoding="utf-8") as f:
        for row in data:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    chars = sum(len(m["content"]) for r in data for m in r["messages"])
    print(f"\nwrote {args.out}")
    print(f"  {len(data):,} examples  ({want_ask:,} ask, {want_render:,} translate)")
    print(f"  ~{chars / len(data):.0f} chars per example, {chars / 1_000_000:.1f}M total")
    return 0


if __name__ == "__main__":
    sys.exit(main())
