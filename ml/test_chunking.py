"""
Chunker tests.

The chunker decides what a "quotation" is, so its failure modes are the ones
that matter most for a citation-first assistant: a fragment cannot be quoted
honestly, and one giant chunk means the embedding averages away everything
specific in it.

Since chunks are stored as [start, end) offsets rather than copies of the text,
there is a second class of failure that would be invisible at read time and
corrupt every quotation: a span that is out of bounds, reversed, or overlapping
its neighbour. `check` asserts against all of those on every case.

Pure logic - no model, no database, no GPU.

    python ml/test_chunking.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from embed_corpus import (            # noqa: E402
    split_into_chunks, TARGET_CHARS, MIN_CHARS, MAX_CHUNKS_PER_ENTRY,
)

AR = "قَالَ ابْنُ عَبَّاسٍ رَضِيَ اللَّهُ عَنْهُمَا فِي هَذِهِ الْآيَةِ الْكَرِيمَةِ. "
EN = "And Ibn Abbas, may Allah be pleased with him, said concerning this noble verse. "
SEP = chr(10) * 2          # paragraph break, without escaping games


def para(unit, n):
    return (unit * n).strip()


def spans_of(text):
    """Spans, and the text each one points at."""
    sp = split_into_chunks(text)
    return sp, [text[a:b] for a, b in sp]


def check(text, label):
    sp, out = spans_of(text)

    # Offsets are the stored form, so these three must hold or every quotation
    # built from them is wrong in a way nothing downstream could detect.
    for a, b in sp:
        assert isinstance(a, int) and isinstance(b, int), f"{label}: span not integers"
        assert 0 <= a < b <= len(text), f"{label}: span ({a},{b}) out of bounds"
    for (_, b1), (a2, _) in zip(sp, sp[1:]):
        assert a2 >= b1, f"{label}: spans overlap or run backwards"

    assert all(len(c) >= MIN_CHARS or len(out) == 1 for c in out), \
        f"{label}: produced a fragment below MIN_CHARS"
    assert len(out) <= MAX_CHUNKS_PER_ENTRY, f"{label}: exceeded the per-entry cap"
    return out


def test_empty():
    assert split_into_chunks("") == []
    assert split_into_chunks("   " + SEP + "  ") == []


def test_short_entry_survives():
    # Al-Jalalayn on a short verse is one clause. Dropping it would not read as
    # "this edition is terse here" but as the edition having nothing to say.
    t = "تفسير مختصر جدا لهذه الآية."
    _, out = spans_of(t)
    assert out == [t], out


def test_single_paragraph_under_target():
    t = para(AR, 8)
    out = check(t, "single")
    assert len(out) == 1
    assert out[0] == t


def test_paragraphs_are_grouped_not_split():
    t = SEP.join(para(AR, 3) for _ in range(3))
    out = check(t, "grouped")
    assert len(out) <= 2, f"expected grouping, got {len(out)}"


def test_long_entry_is_split():
    t = SEP.join(para(AR, 12) for _ in range(12))
    out = check(t, "long")
    assert len(out) > 1


def test_giant_entry_is_capped():
    # The al-Tabari-on-2:255 case: tens of thousands of characters.
    t = SEP.join(para(AR, 20) for _ in range(80))
    out = check(t, "giant")
    assert len(out) == MAX_CHUNKS_PER_ENTRY


def test_oversized_single_paragraph_splits_at_sentence_ends():
    t = para(AR, 40)
    out = check(t, "one-para")
    assert len(out) > 1
    # Every chunk but the last should end at a sentence terminator.
    for c in out[:-1]:
        assert c.rstrip()[-1] in ".!?۔؟", f"split mid-sentence: ...{c[-30:]!r}"


def test_english_too():
    t = SEP.join(para(EN, 10) for _ in range(6))
    out = check(t, "english")
    assert "Ibn Abbas" in out[0]


def test_spans_never_duplicate_text():
    # With no overlap the spans partition the entry, so a quotation can never
    # silently repeat a sentence.
    t = SEP.join(para(EN, 6) for _ in range(5))
    _, out = spans_of(t)
    assert len("".join(out)) <= len(t), "spans overlap - a quotation could repeat text"


def test_span_slices_are_exactly_what_was_embedded():
    t = SEP.join(para(AR, 9) for _ in range(4))
    sp, out = spans_of(t)
    for (a, b), text in zip(sp, out):
        assert t[a:b] == text


def test_nothing_meaningful_is_lost():
    t = SEP.join(para(EN, 4) for _ in range(4))
    _, out = spans_of(t)
    joined = " ".join(out)
    for word in ("Ibn", "Abbas", "noble", "verse"):
        assert word in joined


def test_whitespace_is_not_captured_at_span_edges():
    # A span that begins or ends on whitespace quotes badly and, worse, drifts
    # the offsets against what a reader sees.
    t = SEP.join(para(EN, 5) for _ in range(4))
    _, out = spans_of(t)
    for c in out:
        assert c == c.strip(), f"span carries edge whitespace: {c[:20]!r}"


if __name__ == "__main__":
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"  ok   {fn.__name__}")
        except AssertionError as e:
            failed += 1
            print(f"  FAIL {fn.__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    sys.exit(1 if failed else 0)
