"""
Is a mismatch Whisper's spelling, or the man's own words?

This decides whether the mushaf text may be substituted at all, so the answer
comes in three buckets rather than two:

  SPELLING   identical once pure orthography is folded — alif seats, hamza
             carriers, alif maqsura. Same sound, different pen. Writing the
             mushaf form changes no word he said.

  ENDING     differs only in the trailing syllable: خفية/خَفِيًّا, شقية/شَقِيًّا,
             عاقرة/عَاقِرًا. Those are case endings, which a reciter pausing at a
             phrase end does not pronounce, so Whisper has no acoustic basis on
             which to write them either way. Also safe.

  STEM       a different word body: عزيناه against ءَاتَيْنَـٰهُ. From text alone
             that is indistinguishable from him genuinely paraphrasing, so it is
             never auto-replaced — every one is listened to.

Normalisation lives in arabic.py, in escapes, for reasons documented there.
"""
import sys as _sys
if hasattr(_sys.stdout, "reconfigure"):
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, os
from difflib import SequenceMatcher
from arabic import spelling, stem, skeleton

SP = os.path.dirname(os.path.abspath(__file__))

matches = json.load(open(os.path.join(SP, "matches.json"), encoding="utf-8"))
rows = []
for m in matches:
    heard = m["heard"].split()
    mush  = m["verse_ar"].split()[m["vstart"]:m["vstart"] + m["nwords"]]
    sm = SequenceMatcher(None, [spelling(w) for w in heard], [spelling(w) for w in mush])

    verdict, diffs = "SPELLING", []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        h, g = heard[i1:i2], mush[j1:j2]
        # Judge WORD BY WORD, then take the worst. A group graded as a unit fails
        # both tests whenever it mixes kinds — `أولئك رفيقة` against
        # `أُو۟لَـٰٓئِكَ رَفِيقًا` is one alif and one case ending, neither of them a
        # different word, and grading the pair together called it STEM.
        def word_kind(a, b):
            if skeleton(a) == skeleton(b): return "SPELLING"
            if stem(a) == stem(b):         return "ENDING"
            return "STEM"
        kinds = ([word_kind(a, b) for a, b in zip(h, g)] if len(h) == len(g)
                 else ["STEM"])
        kind = ("STEM" if "STEM" in kinds
                else "ENDING" if "ENDING" in kinds else "SPELLING")
        diffs.append({"heard": " ".join(h) or "—", "mushaf": " ".join(g) or "—", "kind": kind,
                      "words": [{"heard": a, "mushaf": b, "kind": k}
                                for a, b, k in zip(h, g, kinds)] if len(h) == len(g) else []})
        if kind == "STEM":
            verdict = "STEM"
        elif kind == "ENDING" and verdict == "SPELLING":
            verdict = "ENDING"
    rows.append({**m, "verdict": verdict, "diffs": diffs})

json.dump(rows, open(os.path.join(SP, "classified.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

for v, note in (("SPELLING", "identical sound — safe to use mushaf text"),
                ("ENDING",   "case endings only — safe"),
                ("STEM",     "a real word differs — LISTEN")):
    print(f"  {v:9} {sum(r['verdict'] == v for r in rows):2d}   {note}")

stems = [r for r in rows if r["verdict"] == "STEM"]
print(f"\n  ── the {len(stems)} needing an ear ──\n")
for r in stems:
    a, b = int(r["s"]), int(r["e"])
    print(f"  {a//60:02d}:{a%60:02d}–{b//60:02d}:{b%60:02d}  {r['key']}  ({r['nwords']}w)")
    for d in r["diffs"]:
        if d["kind"] == "STEM":
            print(f"        heard   {d['heard']}")
            print(f"        mushaf  {d['mushaf']}")
    print()
