"""
Find every Qur'anic quotation in the transcript and pin it to a verse.

Whisper writes what it HEARS. For ordinary speech that is fine; for scripture it
is not. Burning a misquoted ayah into the picture is the one error in this job
that cannot be walked back, so no Arabic belonging to the Qur'an goes on screen
until it has been matched to an actual verse and classified (see classify.py for
what may then be substituted, and what may not).

Matching is seed-and-extend on diacritic-stripped text: an exact 3-gram seed,
then walk outward accepting a word if it is equal or close, stopping after two
consecutive misses. The tolerance is the point — a garbled word in the middle is
exactly what we are here to find, so the matcher must see past it.

CONTEXT DISAMBIGUATION. The Qur'an repeats its own formulae, so a short span can
legitimately match several verses. `عبده زكريا إذ نادى` matched Ayyub in 38:41
on raw length while sitting in the middle of a passage about Zakariyya, and
`إن في ذلك لآية` matched 23:30 when the next thing said is 26:9. Length alone
cannot separate these; the surah the speaker is *in* can. So candidates are
collected first and chosen afterwards, with a bonus for agreeing with the surah
of nearby quotations.
"""
import sys as _sys
if hasattr(_sys.stdout, "reconfigure"):
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, os
from difflib import SequenceMatcher
from arabic import spelling, skeleton, bare

SP = os.path.dirname(os.path.abspath(__file__))
MIN_WORDS = 4          # below this, matches are common phrases, not quotations
SEED = 3

def close(a: str, b: str) -> bool:
    return a == b or (len(a) > 2 and len(b) > 2
                      and SequenceMatcher(None, a, b).ratio() >= 0.6)

quran = json.load(open(os.path.join(SP, "quran.json"), encoding="utf-8"))
vwords, vtext, index = [], [], {}
for v in quran:
    # The mushaf carries recitation marks — ۚ ۖ ۗ — as standalone tokens. They are
    # not words, and counting them as words made a match report that the speaker
    # had said إنه where the verse has a pause sign.
    real = [w for w in v["ar"].split() if bare(w)]
    vtext.append(real)
    ws = [spelling(w) for w in real]
    vwords.append(ws)
    for i in range(len(ws) - SEED + 1):
        index.setdefault(tuple(ws[i:i + SEED]), []).append((len(vwords) - 1, i))

# How many verses each word appears in. A span built only from words the Qur'an
# uses everywhere is not a quotation — `إن شاء الله` is something every Arabic
# speaker says hourly, and it matched the tail of 2:70 while he was simply saying
# "and it will come, God willing". A real quotation carries at least one word that
# is actually rare: زكريا, خفيا, عبادنا.
from collections import Counter
DF = Counter()
for ws in vwords:
    DF.update(set(ws))
def rarity_needed(n_words: int) -> int:
    """How rare the span's rarest matched word must be, given how long it is.

    A long span is self-evidently a quotation. A short one is not: إن شاء الله is
    three words a speaker says hourly plus شاء, which is 'rare' at 54 verses only
    by the standards of a 6236-verse corpus. So a 4-word span has to carry a word
    that is properly distinctive before it counts as scripture, while a 10-word
    span has already earned it by length alone."""
    return 15 if n_words <= 4 else 60 if n_words <= 6 else 400

cues = json.load(open(os.path.join(SP, "ar.json"), encoding="utf-8"))
stream = []
for c in cues:
    for w in (c["words"] or [{"w": c["ar"], "s": c["s"], "e": c["e"]}]):
        stream.append({"w": w["w"], "n": spelling(w["w"]),
                       "s": w["s"], "e": w["e"], "cue": c["i"]})

def extend(ti, vi, vpos, step):
    n = miss = 0
    while True:
        t, p = ti + step * (n + 1), vpos + step * (n + 1)
        if not (0 <= t < len(stream) and 0 <= p < len(vwords[vi])):
            break
        if close(stream[t]["n"], vwords[vi][p]):
            miss = 0
        else:
            miss += 1
            if miss > 1:
                break
        n += 1
    return n - miss

# ── pass 1: every candidate, not just the longest ─────────────────────────
spots, i = [], 0
while i < len(stream) - SEED:
    key = tuple(s["n"] for s in stream[i:i + SEED])
    cands = {}
    for vi, vpos in index.get(key, [])[:600]:
        back = extend(i, vi, vpos, -1)
        fwd  = extend(i + SEED - 1, vi, vpos + SEED - 1, +1)
        total = back + SEED + fwd
        if total >= MIN_WORDS and total > cands.get(vi, (0,))[0]:
            cands[vi] = (total, vpos - back, back)
    if cands:
        best = max(c[0] for c in cands.values())
        spots.append({"i": i, "cands": {vi: c for vi, c in cands.items() if c[0] >= best - 2}})
        i += best
    else:
        i += 1

# ── pass 2: choose, letting neighbours vote on the surah ──────────────────
def surah(vi): return int(quran[vi]["key"].split(":")[0])
prelim = [max(s["cands"].items(), key=lambda kv: kv[1][0])[0] for s in spots]

matches, rejected = [], []
for n, spot in enumerate(spots):
    near = [surah(prelim[k]) for k in range(max(0, n - 3), min(len(spots), n + 4)) if k != n]
    def score(kv):
        vi, (total, _, _) = kv
        return (total + (2 if surah(vi) in near else 0), total)
    vi, (total, vstart, back) = max(spot["cands"].items(), key=score)
    alts = sorted((quran[k]["key"] for k in spot["cands"] if k != vi))

    a, b = spot["i"] - back, spot["i"] - back + total
    b = min(b, len(stream))

    # TRIM THE EDGES. extend() tolerates a mismatch before it stops, so a span
    # can over-reach by a word at either end and swallow something he said in his
    # own voice. That produced الآية ("the verse") aligned onto 19:43's opening
    # يَـٰٓأَبَتِ, and خذوا aligned onto 2:63's وَٱذْكُرُوا۟ — in both cases a real word
    # of his about to be replaced by a different real word. A quotation has to
    # BEGIN and END on words that actually agree; mismatches are only credible in
    # the interior, where a recogniser slip is the likelier explanation than a
    # boundary error.
    def agree1(t, v):
        x, y = skeleton(stream[t]["w"]), skeleton(v)
        return x == y or (len(x) > 2 and len(y) > 2
                          and SequenceMatcher(None, x, y).ratio() >= 0.75)
    while b - a > MIN_WORDS and not agree1(b - 1, vtext[vi][vstart + (b - a) - 1]):
        b -= 1
    while b - a > MIN_WORDS and not agree1(a, vtext[vi][vstart]):
        a += 1; vstart += 1
    total = b - a

    mush = vtext[vi][vstart:vstart + total]
    heard_w = [s["w"] for s in stream[a:b]]
    # A quotation is words the speaker actually read. A handful of common words
    # lining up by chance is not, and `وسيأتي` reported against 2:70's `وَإِنَّآ`
    # was exactly that. Require most of the span to agree on the consonant
    # skeleton before calling it scripture at all.
    # Agreement is FUZZY per word, not exact. Whisper writes بدعايك where the
    # mushaf has بِدُعَآئِكَ and اهل where it has ءَالِ — the hamza seat is a spelling
    # convention it has no acoustic reason to reproduce. Requiring exact skeleton
    # equality here threw out this lecture's three central recitations of 19:4 and
    # 19:6 as "garbled" and would have burned Whisper's spelling of them into the
    # picture. Coincidence is still excluded, but by the rarity test below, which
    # is the check actually designed for it.
    def agrees(h, g):
        a, b = skeleton(h), skeleton(g)
        return a == b or (len(a) > 2 and len(b) > 2
                          and SequenceMatcher(None, a, b).ratio() >= 0.75)
    hit   = [g for h, g in zip(heard_w, mush) if agrees(h, g)]
    agree = len(hit)
    # Rarity must be measured over the words that ACTUALLY MATCHED, not over the
    # whole verse span. 2:70 opens with وَإِنَّآ, a rare form — but that is the word
    # he did not say. What he did say was إن شاء الله, three of the commonest words
    # in the language, and judging by the rare one he never uttered kept it.
    distinctive = min((DF[spelling(w)] for w in hit), default=9999)
    if agree / max(1, len(mush)) < 0.7 or distinctive >= rarity_needed(len(hit)):
        why = "generic" if distinctive >= rarity_needed(len(hit)) else "garbled"
        rejected.append((stream[a]["s"], quran[vi]["key"], why, " ".join(heard_w)))
        continue
    matches.append({
        "key": quran[vi]["key"], "verse_ar": " ".join(vtext[vi]), "verse_en": quran[vi]["en"],
        "vstart": vstart, "vlen": len(vwords[vi]), "nwords": total,
        "full": vstart == 0 and vstart + total >= len(vwords[vi]),
        "wa": a, "wb": b, "s": stream[a]["s"], "e": stream[b - 1]["e"],
        "cue_a": stream[a]["cue"], "cue_b": stream[b - 1]["cue"],
        "heard": " ".join(heard_w), "alts": alts,
    })

json.dump(matches, open(os.path.join(SP, "matches.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

tot = sum(m["nwords"] for m in matches)
amb = [m for m in matches if m["alts"]]
print(f"  {len(matches)} quotations, {tot} words ({tot/len(stream)*100:.0f}% of the transcript)")
print(f"  whole verses {sum(m['full'] for m in matches)}   partial {sum(not m['full'] for m in matches)}")
print(f"  had rival verses, resolved by context: {len(amb)}")
print(f"  rejected as coincidence, not quotation: {len(rejected)}")
for t, k, why, h in rejected:
    print(f"     {int(t)//60:02d}:{int(t)%60:02d}  {k:>7}  {why:8} {h[:52]}")
for m in amb:
    t = int(m["s"])
    print(f"     {t//60:02d}:{t%60:02d}  chose {m['key']:>7}  over {', '.join(m['alts'][:4])}")
