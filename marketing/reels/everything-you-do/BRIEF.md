---
workflow: general-video
flow: automation
storyboard: no
message: "Worship is not worship without tawḥīd; actions are by intentions; so sleeping and revising are worship too — Islam exists in everything you do"
destination: instagram-reels
aspect: 1080x1920
language: en
length: 57.4s
angle: narrative
---

## Intent

An excerpt from the khuṭbah **"An introduction to Tawḥīd"** — Musa Surty, SGS
ISOC, 25 September 2026 / 14 Rabīʿ al-Thānī 1448 — set in the Tafsir Lab
language: warm paper, ink serif, a hairline that advances as he speaks, every
word darkening at the instant it is said, and the two hadith phrases held as
Arabic cards.

Carries a second mark: **TafsirLab × SGS ISOC**, in the running foot and on the
closing card.

Same build as `../seeing-his-face`, which this is the sibling of — the
stylesheet is that reel's verbatim (see `style.css`), minus its circled
numerals, plus the co-brand lockup.

## The edit

Three clips arrived; all three are used, in the order the khuṭbah argues them
rather than the order the files came in:

| # | clip | what it carries |
| - | ---- | --------------- |
| A | `cleaned-video (3).mp4` | the premise — worship is not worship without tawḥīd |
| B | `cleaned-video (8).mp4` | the question — what does living *lā ilāha illā Allāh* look like? |
| C | `cleaned-video (8).mp4` | the hadith — *innamā l-aʿmālu bi-n-niyyāt* |
| D | `cleaned-video (7).mp4` | the examples — sleeping for fajr, revising for the ummah |
| E | `cleaned-video (7).mp4` | the bridge — these could be your intention in everything you do |
| F | `cleaned-video (7).mp4` | the close — *Islam exists in everything you do* |

Six segments, 52.7s of speech in a 57.4s piece. The brief was "no longer than a
minute" with the choice left open; all three fit inside it once the sourcing of
the hadith (Nawawī, Bukhārī), the *kuntum khayra ummah* quotation and the
restatement after it are left out. Each of those is good; none of them is
load-bearing for this argument.

## Cuts

Every in/out point is the quietest 40 ms in its neighbourhood, found by
measuring the envelope (`trough.py` in the working notes), not taken from the
recogniser. The recogniser drifts: on clip 3 its word times run about 0.45s
late, which is how the first attempt cut into the middle of *verily* and the
last one caught the tail of *true* before *Islam*. The joined edit was then
transcribed end to end and had to read back as one coherent passage before
anything was built on it.

## Audio

The three clips were exported separately and arrived at −21.8 / −22.7 / −23.5
LUFS, so each is trimmed to a common level before the join — no seam lands on a
step in loudness. Then +10 dB into a limiter at −1.5 dBFS.

Result: **−11.8 LUFS, LRA 3.1**, which is `seeing-his-face/audio/voice.flac`
(−11.6, LRA 3.1) to within 0.2 dB.

A compressor was tried first and rejected on measurement: it bought 2.9 LU
while costing half the dynamic range (LRA 4.1 → 2.0), because the peaks here
are short transients a 10 ms attack cannot catch. The limiter is the right tool
and 0.9 LU is what it costs.

No denoising: the owner had already cleaned all three, and the floors measure
−62 to −65 dB. No music bed either — the sibling reel has one because it was
asked for; this one was not.

## Line breaks

`check-wraps.mjs` reports how every caption actually breaks and fails the build
on a stranded word. It exists because counting characters got three captions
wrong in a row — *"so I can put myself in a / position"*, *"in a position with
good / grades"*, *"That these could be your / intention"* — and because the
renderer and the checker do not always break a boundary case the same way, so
lines are kept clear of the 900px limit rather than just inside it.

One orphan is kept deliberately: **tawḥīd.** alone on the last line of the
opening caption. It is the word the sentence turns on and the word the ochre
bar marks.
