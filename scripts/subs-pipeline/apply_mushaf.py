"""
Write the final Arabic: mushaf orthography for scripture, his own words for speech.

Substitution is per WORD, not per span, and each word is decided by a stated rule
so every change can be argued for afterwards. In order:

  0. HIS CONNECTIVE   Whisper's word is the mushaf word with a connective letter
                      stuck on the front (فذكر for ذِكْرُ) and it opens the span.
                      That is him linking the quotation to what he was saying —
                      an addition, not a misreading. Keep his.

  1. SPELLING/ENDING  same sound (see classify.py). Take the mushaf form; it
                      changes no word he said, only how it is spelled.

  2. TWIN READING     he reads the same verse elsewhere in this video and that
                      time it came out matching the mushaf. Proof the recogniser
                      wobbles rather than the reciter. Take the mushaf form. This
                      is checked BEFORE the next rule because it is the stronger
                      evidence: العضو is a perfectly real word (a limb), so calling
                      it unattested would be wrong even though the verdict is right.

  3. UNATTESTED FORM  Whisper's form appears nowhere in the Qur'an and nowhere
                      else in this transcript — عزيناه, واتفطرنا. An invention of
                      the recogniser. Take the mushaf form.

  4. ISOLATED SLIP    one word off inside a span of eight or more that is
                      otherwise verbatim. A reciter fluent enough to get twelve
                      words exactly right does not fumble the thirteenth; a
                      recogniser drops a geminate all day. Take the mushaf form.

  5. OTHERWISE        keep what he said. If it cannot be told from the text, the
                      man's own words win.

Words the mushaf has and he did not say are never inserted.
"""
import sys as _sys
if hasattr(_sys.stdout, "reconfigure"):
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, os
from difflib import SequenceMatcher

SIM_FLOOR = 0.33   # below this, a 'correction' is really an alignment error
from arabic import spelling, stem, skeleton, bare

SP = os.path.dirname(os.path.abspath(__file__))
CONNECTIVES = ("و", "ف", "ل", "ب", "ك", "ثم")

quran   = json.load(open(os.path.join(SP, "quran.json"), encoding="utf-8"))
matches = json.load(open(os.path.join(SP, "classified.json"), encoding="utf-8"))
cues    = json.load(open(os.path.join(SP, "ar.json"), encoding="utf-8"))

stream = []
for c in cues:
    for w in (c["words"] or [{"w": c["ar"], "s": c["s"], "e": c["e"]}]):
        stream.append({"w": w["w"], "s": w["s"], "e": w["e"], "cue": c["i"], "quran": None})

# vocabulary for the "is this even a word" test
QURAN_VOCAB = {spelling(w) for v in quran for w in v["ar"].split() if bare(w)}

# Index for the TWIN VERSE guard below: which verses contain a given word, and
# every verse by key. An inverted index rather than a scan because the guard
# runs per decision and a naive sweep of 6,236 verses per word is minutes.
VERSE_BY_KEY, WORD_IN = {}, {}
for _v in quran:
    VERSE_BY_KEY[_v["key"]] = [skeleton(w) for w in _v["ar"].split() if bare(w)]
    for _w in set(VERSE_BY_KEY[_v["key"]]):
        WORD_IN.setdefault(_w, set()).add(_v["key"])


def twin_verse(m, j):
    """Is the word at position j the ONLY thing identifying this verse?

    The three guards downstream all ask how a word relates to the verse it was
    matched against. None asks whether that verse is the right one -- and Surat
    Maryam is built out of verses that differ in nothing but a name. 19:41 and
    19:56 are word for word identical apart from Ibrahim / Idris. He recited
    19:56 (the next breath is "and We raised him to a high station", which only
    follows Idris); the matcher locked onto 19:41, and every rule downstream
    happily approved renaming the prophet.

    So mask the word about to be overwritten and ask whether the REST of the
    matched span still picks out one verse. If it does not, then the word being
    corrected is the very thing that would have identified the verse, and
    rewriting it manufactures the evidence for its own match. Never let the
    correction be the discriminator.

    Returns the competing verse key, or None.
    """
    span = VERSE_BY_KEY.get(m["key"], [])[m["vstart"]:m["vstart"] + m["nwords"]]
    if len(span) < 4 or j >= len(span):
        return None                      # too short to identify anything anyway
    others = None
    for n, w in enumerate(span):
        if n == j:
            continue                     # masked: this is the word in question
        s = WORD_IN.get(w, set())
        others = set(s) if others is None else (others & s)
        if not others:
            return None
    for key in others:
        if key == m["key"]:
            continue
        vw = VERSE_BY_KEY[key]
        for st in range(0, len(vw) - len(span) + 1):
            if all(n == j or w == vw[st + n] for n, w in enumerate(span)):
                # The rival must DISAGREE here, or this word is not the
                # discriminator and there is nothing to protect. 20:10 and
                # 28:29 are the two fire-on-the-mountain passages and they part
                # company at قبس / خبر, not at لعلي -- which both read. Without
                # this test the guard fired on لعلي and kept Whisper's لألي,
                # protecting a mistranscription in the name of his own words.
                if vw[st + j] != span[j]:
                    return key
    return None
SPOKEN = {}
for s in stream:
    SPOKEN[spelling(s["w"])] = SPOKEN.get(spelling(s["w"]), 0) + 1

def plausible(w):
    k = spelling(w)
    return k in QURAN_VOCAB or SPOKEN.get(k, 0) >= 2

# which mushaf forms this video produced correctly somewhere, per verse
seen_ok = {}
for m in matches:
    mush = m["verse_ar"].split()[m["vstart"]:m["vstart"] + m["nwords"]]
    heard = m["heard"].split()
    sm = SequenceMatcher(None, [spelling(x) for x in heard], [spelling(x) for x in mush])
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for g in mush[j1:j2]:
                seen_ok.setdefault(m["key"], set()).add(spelling(g))

log = []
for m in matches:
    mush  = m["verse_ar"].split()[m["vstart"]:m["vstart"] + m["nwords"]]
    heard = [stream[i]["w"] for i in range(m["wa"], m["wb"])]
    sm = SequenceMatcher(None, [spelling(x) for x in heard], [spelling(x) for x in mush])

    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "insert":
            continue                            # never put words in his mouth
        for k in range(i1, i2):
            idx = m["wa"] + k
            stream[idx]["quran"] = m["key"]
            j = j1 + (k - i1)
            if tag == "delete" or j >= j2:
                continue                        # he said more than the verse has
            h, g = heard[k], mush[j]

            # MISALIGNMENT GUARD. If the word he said already has an exact home
            # somewhere else in this verse, the aligner has put it in the wrong
            # slot and the "correction" would swap a real word for a different
            # real one. 2:63 contains both خُذُوا۟ and وَٱذْكُرُوا۟; his خذوا got
            # aligned onto وَٱذْكُرُوا۟ and every rule downstream happily approved
            # replacing "take" with "and remember". Similarity cannot catch this
            # — that pair scores exactly as high as a legitimate fix — but the
            # word having its own place in the verse can.
            # against the WHOLE verse, not the matched slice: خُذُوا۟ sits before
            # the slice that was matched, so a slice-only check cannot see it
            whole = [w for w in m["verse_ar"].split() if bare(w)]
            # SIMILARITY FLOOR, for misalignments in the INTERIOR of a span,
            # where edge-trimming cannot help and the word has no exact home in
            # the verse either. He said أوتوا ٱلْكِتَـٰب — "those given the Scripture" —
            # and it landed on 4:157's ٱخْتَلَفُوا۟ فِيهِ. A recogniser slip is always
            # phonetically close; measured over every real fix in these five
            # videos the lowest was 0.40 (ويحرق for وَيُهْلِكَ) while both
            # misalignments sat at 0.25, so the floor goes between them.
            if (skeleton(h) != skeleton(g) and stem(h) != stem(g)
                    and SequenceMatcher(None, skeleton(h), skeleton(g)).ratio() < SIM_FLOOR):
                log.append((stream[idx]["s"], m["key"], h, g, "MISALIGNED — kept", False))
                continue

            elsewhere = any(skeleton(h) == skeleton(v)
                            for n2, v in enumerate(whole)
                            if n2 != m["vstart"] + j)
            if elsewhere and skeleton(h) != skeleton(g):
                log.append((stream[idx]["s"], m["key"], h, g, "MISALIGNED — kept", False))
                continue

            # TWIN VERSE. See twin_verse() above -- this is the guard that stops
            # a match rewriting the one word that was holding it up.
            #
            # `plausible(h)` is load-bearing. Ambiguity between twin verses is
            # only a reason to keep his word if his word could BE one of them.
            # Re-checked against the four lectures already delivered, the guard
            # without it also caught 3:44's يوقون -- which is not an Arabic word,
            # so whichever verse he was reciting, that is the recogniser and not
            # him, and keeping it would preserve a defect in the name of
            # faithfulness. With it: إدريس is kept (it is 19:56's actual word),
            # bare اتقوا is kept (the twins 15:69/11:78 differ only in وَ vs فَ,
            # and correcting it would invent a connective he did not say), and
            # يوقون is still repaired to يُلْقُونَ.
            if skeleton(h) != skeleton(g) and plausible(h):
                rival = twin_verse(m, j)
                if rival:
                    log.append((stream[idx]["s"], m["key"], h, g,
                                "TWIN VERSE %s — kept" % rival, False))
                    continue

            if skeleton(h) == skeleton(g):      why = "spelling"
            elif stem(h) == stem(g):            why = "ending"
            elif k == 0 and any(spelling(h) == spelling(c + g) for c in CONNECTIVES):
                                                why = "HIS CONNECTIVE"
            elif spelling(g) in seen_ok.get(m["key"], set()):
                                                why = "twin reading"
            elif not plausible(h):              why = "unattested form"
            elif m["nwords"] >= 8:              why = "isolated slip"
            else:                               why = "KEPT — cannot tell"

            if why not in ("HIS CONNECTIVE", "KEPT — cannot tell"):
                if spelling(h) != spelling(g):
                    log.append((stream[idx]["s"], m["key"], h, g, why, True))
                stream[idx]["w"] = g
            elif spelling(h) != spelling(g):
                log.append((stream[idx]["s"], m["key"], h, g, why, False))

json.dump(stream, open(os.path.join(SP, "words.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

# Every log row now CARRIES its outcome, because inferring it from the reason
# string went wrong twice in a row: a hand-maintained list of reason strings
# filed the twin-verse guard under "rewritten" (its reason embeds the rival
# verse key, so it can never be a fixed string), and the endswith("kept") fix
# that replaced it then flung "KEPT — cannot tell" into the same column.
# This is the log the corrections get audited from. It must not be able to say
# the opposite of what the code did.
changed = [l for l in log if l[5]]
kept    = [l for l in log if not l[5]]
inq     = sum(1 for s in stream if s["quran"])
print(f"  {inq} of {len(stream)} words are inside a quotation ({inq/len(stream)*100:.0f}%)")
print(f"  words rewritten to the mushaf : {len(changed)}")
print(f"  words left exactly as he said : {len(kept)}\n")
print("  ── every rewrite where a real word changed ──")
for t, k, h, g, why, _ in changed:
    if why in ("spelling", "ending"):
        continue
    print(f"    {int(t)//60:02d}:{int(t)%60:02d}  {k:>6}  {h}  ->  {g}    [{why}]")
print("\n  ── kept as spoken ──")
for t, k, h, g, why, _ in kept:
    print(f"    {int(t)//60:02d}:{int(t)%60:02d}  {k:>6}  {h}   (verse has {g})   [{why}]")
