# -*- coding: utf-8 -*-
"""
Split subtitle cards that are too long to sit inside the band.

segment.py cuts on PAUSES, which is right: a card should break where the
speaker breathes, not where a character counter says so. But an uninterrupted
recitation has no pause in it, and 48:29 recited straight through produced one
card of 170 Arabic characters against a median of 29 for that lecture. Burned,
it wrapped to two Arabic lines that climbed clear of the band and sat across
the speaker's face, unbacked and over his eyes -- the one thing the band exists
to prevent.

So this is a post-pass, not a change to segment.py: pause-timing stays the
authority, and only the cards it could not help are divided. One in 496 on
episode 08.

Splits at a sentence boundary near the middle where there is one, otherwise at
the nearest word boundary, and divides the duration in proportion to the
characters on each side so the halves stay in step with the speech. Renumbers
cues and rebuilds en.json against the new numbering, because en.json is keyed
by cue index and would otherwise silently slide by one from the split onward --
every remaining card carrying the previous card's English.
"""
import json, io, os, sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SP = os.path.dirname(os.path.abspath(__file__))
LIMIT = 110          # measured: ep06 peaked at 107 and sat correctly in the band


def halve(text):
    """Split near the middle, preferring a sentence end. Returns (a, b)."""
    mid = len(text) // 2
    best, bestd = None, 1e9
    for mark in (". ", "؟ ", "! ", "، ", " "):
        start = 0
        while True:
            k = text.find(mark, start)
            if k < 0:
                break
            d = abs((k + len(mark)) - mid)
            if d < bestd:
                best, bestd = k + len(mark), d
            start = k + 1
        if best is not None and bestd < len(text) * 0.30:
            break                      # a good break at this level; stop looking
    if best is None:
        best = mid
    return text[:best].strip(), text[best:].strip()


def main():
    cues = json.load(io.open(os.path.join(SP, "cues.json"), encoding="utf-8"))
    enp = os.path.join(SP, "en.json")
    en = json.load(io.open(enp, encoding="utf-8")) if os.path.exists(enp) else {}

    out, newen, split = [], {}, 0
    for c in cues:
        ar = c["ar"]
        eng = en.get(str(c["i"]), "")
        if len(ar) <= LIMIT:
            c2 = dict(c, i=len(out))
            newen[str(len(out))] = eng
            out.append(c2)
            continue

        a1, a2 = halve(ar)
        e1, e2 = halve(eng) if eng else ("", "")
        # time in proportion to characters, so the halves track the speech
        frac = len(a1) / float(len(a1) + len(a2))
        cut = c["s"] + (c["e"] - c["s"]) * frac
        for txt, eng_part, s, e in ((a1, e1, c["s"], round(cut, 2)),
                                    (a2, e2, round(cut, 2), c["e"])):
            newen[str(len(out))] = eng_part
            out.append(dict(c, i=len(out), ar=txt, s=s, e=e))
        split += 1
        print("  split cue %d (%d chars) at %.1fs -> %d + %d"
              % (c["i"], len(ar), c["s"], len(a1), len(a2)))

    json.dump(out, io.open(os.path.join(SP, "cues.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    if en:
        json.dump(newen, io.open(enp, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=1)
    longest = max(len(c["ar"]) for c in out)
    print("  %d cards split; %d cues now; longest Arabic card %d chars"
          % (split, len(out), longest))


if __name__ == "__main__":
    main()
