"""
Cut the cues on his pauses, not on Whisper's convenience.

Whisper's own segmentation is built for transcript files: it runs long, breaks
mid-clause, and its boundaries have nothing to do with how the man speaks. For
burned-in subtitles the boundaries ARE the edit, so they get rebuilt here from
the word-level timings, under three rules:

  A card never appears before its words are spoken. Start on the first word.

  A card holds through a pause rather than blinking out. When the next card is
  more than a breath away, the current one stays up into the gap instead of
  leaving the screen empty — but never past the moment the next word lands.

  A card is short enough to read. Long spans are split at the widest internal
  pause, so the break falls where he breathed rather than where a character
  counter ran out.

Quotation spans are kept whole where possible: splitting an ayah across two
cards reads badly and makes the English impossible to place.

Whisper's word timings are cross-attention estimates, not measurements, so the
boundaries this produces are checked against the actual RMS envelope in
check_timing.py rather than trusted.
"""
import sys as _sys
if hasattr(_sys.stdout, "reconfigure"):
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json, os

SP = os.path.dirname(os.path.abspath(__file__))

MAX_CHARS   = 62     # Arabic characters on one line at 88px, comfortably
MIN_DUR     = 1.10   # nothing flashes
MAX_DUR     = 6.50
PAUSE_FRAC  = 0.28   # threshold sits this far from floor up towards speech
HOLD_LIMIT  = 0.90   # how far a card may hold into silence
LEAD        = 0.04   # tiny lead-in so the card is never late either

words = json.load(open(os.path.join(SP, "words.json"), encoding="utf-8"))

# ── where he is actually quiet, measured from the audio ───────────────────
# Whisper's word timings CANNOT be used to find pauses: within one of its
# segments the words are laid end to end with no gaps at all, so the gap
# distribution is identical whether you threshold at 0.20s or 0.40s — 137 either
# way, which is just the number of segment boundaries. Every real pause inside a
# segment is invisible. So quietness is read off the waveform instead, and a
# break is placed at the quietest candidate rather than wherever the character
# counter happened to run out.
import wave, array, math

_w = wave.open(os.path.join(SP, "audio.wav"), "rb")
_sr = _w.getframerate()
_pcm = array.array("h"); _pcm.frombytes(_w.readframes(_w.getnframes()))
_hop = int(_sr * 0.01)
_env = []
for _i in range(0, len(_pcm) - _hop, _hop):
    _c = _pcm[_i:_i + _hop]
    _env.append(math.sqrt(sum(x * x for x in _c) / len(_c)) + 1e-9)
_peak = max(_env)
DB = [20 * math.log10(e / _peak) for e in _env]

# The pause threshold CANNOT be a constant. Video 1 sat at a -57 dB noise floor
# with speech at -21; video 2 arrived limited to a -49 dB floor with speech at
# -10. Carrying the -47 dB figure tuned on the first one across to the second
# would put the threshold BELOW its noise floor, so nothing would ever count as a
# pause and every cut would fall back to the character counter — precisely the
# failure this whole approach exists to avoid. So it is derived: a fixed fraction
# of the way from this recording's own floor up towards its own speech level.
_s = sorted(DB)
FLOOR  = _s[int(len(_s) * 0.05)]
SPEECH = _s[int(len(_s) * 0.75)]
PAUSE_DB = FLOOR + PAUSE_FRAC * (SPEECH - FLOOR)
print(f"  audio: floor {FLOOR:.1f} dB, speech {SPEECH:.1f} dB "
      f"-> pause threshold {PAUSE_DB:.1f} dB")

def quietness(t, half=0.12):
    """Lowest level in a short window — how much of a pause is at time t."""
    a = max(0, int((t - half) / 0.01)); b = min(len(DB), int((t + half) / 0.01) + 1)
    return min(DB[a:b]) if b > a else 0.0

# ── group into cards ──────────────────────────────────────────────────────
# Breaking greedily the moment the character limit is hit puts the boundary
# wherever the counter happened to run out — measured against the audio, only
# 46% of those boundaries landed in silence. So on reaching the limit, step BACK
# to the widest gap among the recent words and cut there instead. The card comes
# out a little shorter and the break falls where he actually breathed.
MIN_FILL = 0.45      # a backtracked card must still be this fraction of the limit

def best_break(card):
    """Index to cut after: the QUIETEST word boundary in the tail of the card."""
    floor = MIN_FILL * MAX_CHARS
    run, best, bestdb = 0, len(card) - 1, 1e9
    for i in range(len(card) - 1):
        run += len(card[i]["w"]) + 1
        if run < floor:
            continue
        d = quietness((card[i]["e"] + card[i + 1]["s"]) / 2)
        if d < bestdb:
            bestdb, best = d, i
    return best

cards, cur = [], []
for w in words:
    prev = cur[-1] if cur else None
    if prev is not None:
        same_quote = prev["quran"] and w["quran"] == prev["quran"]
        text = " ".join(x["w"] for x in cur)
        too_long = len(text) + 1 + len(w["w"]) > MAX_CHARS
        too_slow = w["e"] - cur[0]["s"] > MAX_DUR
        # a clearly audible pause ends the card outright, whatever its length
        real_pause = quietness((prev["e"] + w["s"]) / 2) < PAUSE_DB and len(text) > 12

        if real_pause and not same_quote:
            cards.append(cur); cur = []
        elif (too_long and not same_quote) or too_slow:
            at = best_break(cur)
            cards.append(cur[:at + 1]); cur = cur[at + 1:]
    cur.append(w)
if cur:
    cards.append(cur)

# ── times ─────────────────────────────────────────────────────────────────
cues = []
for n, card in enumerate(cards):
    s = card[0]["s"] - LEAD
    e = card[-1]["e"]
    nxt = cards[n + 1][0]["s"] if n + 1 < len(cards) else e + 3
    # hold into the pause, but always clear before the next word is spoken
    e = min(e + HOLD_LIMIT, nxt - 0.06)
    if e - s < MIN_DUR:
        e = min(s + MIN_DUR, nxt - 0.06)
    if e <= s:
        e = s + 0.35
    keys = [x["quran"] for x in card if x["quran"]]
    cues.append({
        "i": len(cues), "s": round(max(0, s), 3), "e": round(e, 3),
        "ar": " ".join(x["w"] for x in card),
        "quran": max(set(keys), key=keys.count) if len(keys) >= len(card) * 0.6 else None,
    })

json.dump(cues, open(os.path.join(SP, "cues.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

durs = sorted(c["e"] - c["s"] for c in cues)
lens = sorted(len(c["ar"]) for c in cues)
n = len(cues)
print(f"  {n} cards (from {len(set(w['cue'] for w in words))} Whisper segments)")
print(f"  duration  median {durs[n//2]:.2f}s   p10 {durs[n//10]:.2f}s   max {durs[-1]:.2f}s")
print(f"  length    median {lens[n//2]:3d}      p90 {lens[int(n*.9)]:3d}     max {lens[-1]:3d} chars")
print(f"  quotation cards: {sum(1 for c in cues if c['quran'])}")
print(f"  under {MIN_DUR}s: {sum(1 for d in durs if d < MIN_DUR - 1e-9)}   overlapping: "
      f"{sum(1 for a, b in zip(cues, cues[1:]) if b['s'] < a['e'] - 1e-9)}")
