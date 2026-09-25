---
workflow: general-video
flow: automation
storyboard: no
message: "Worship is not worship without tawḥīd; actions are by intentions; so sleeping and revising are worship too — Islam exists in everything you do"
destination: instagram-reels
aspect: 1080x1920
language: en
length: 63.6s
angle: narrative
---

## Intent

An excerpt from the khuṭbah **"An introduction to Tawḥīd"** — Musa Surty, SGS
ISOC, 25 September 2026 / 14 Rabīʿ al-Thānī 1448 — set in the Tafsir Lab
language: warm paper, ink serif, a hairline that advances as he speaks, every
word darkening at the instant it is said, and every Arabic phrase held as a
card with its meaning beneath.

Carries a second mark: **TafsirLab × SGS ISOC**, in the running foot and on the
closing card.

Same build as `../seeing-his-face`, which this is the sibling of — the
stylesheet is that reel's verbatim (see `style.css`), minus its circled
numerals, plus the co-brand lockup and the book.

## The edit

Three clips, all used, in the order the khuṭbah argues them rather than the
order the files arrived:

| seg | clip | what it carries |
| --- | ---- | --------------- |
| a1 | 3 | **Arabic** — *al-ʿibādatu lā tusammā ʿibādatan illā maʿa at-tawḥīd* |
| a2 | 3 | **Arabic** — *kamā anna aṣ-ṣalāta lā tusammā ṣalātan illā maʿa aṭ-ṭahārah* |
| b  | 8 | the question, ending on *lā ilāha illā Allāh* |
| s  | 8 | the first hadith of Nawawī's forty and of Bukhārī, one you all know |
| c  | 8 | the hadith — *innamā l-aʿmālu bi-n-niyyāt* |
| d  | 7 | worship is not limited — sleeping for fajr, revising for the ummah |
| f  | 7 | *Islam exists in everything you do* |

Left out to hold the length: his English gloss of the ṣalāh/purity half (the
card already carries it in English), and the line "these could be your
intention in everything that you do", which the closing line says better.

## The Arabic, and how the first cut got it wrong

Clip 3 opens the khuṭbah in **Arabic**, and the first cut of this reel
captioned those ten seconds in **English**.

The cause is worth writing down. A recogniser asked for English does not fail
on Arabic — it TRANSLATES. Whisper returned *"verily worship cannot be called
worship except with the accompaniment of Tawheed"* as fluent English prose with
plausible word-level timings, and none of it is spoken. Checking it by forcing
Arabic proved nothing either, because forcing Arabic on English audio
translates the other way, so both answers look the same.

What caught it was asking Whisper to **detect** the language over short windows
instead of telling it: over 12.3–16.6s it gives up and writes the literal word
*"Arabic"*, and over 3.5–7.5s it drops an Arabic fragment into the middle of an
English sentence. Scanning the clip that way puts the Arabic at **1.94–16.37**,
with his English translation after it.

Every stretch he speaks in Arabic is now set in Arabic, with the
transliteration and the meaning beneath: both halves of the maxim, *lā ilāha
illā Allāh*, and both halves of the hadith.

10.90–12.46 of clip 3 is him repeating *maʿa at-tawḥīd*; the clause itself
finishes at 10.60, so that is where the trim comes from.

## The book

A drawn book sits beside the sourcing — it opens as he names the collection,
its ruled lines draw on, and it shuts before the hadith card lands. Same
hairline weight as the rules and the same ochre as the marker, so it belongs to
the page rather than arriving from a different stylesheet. It lives above the
caption stage as its own element rather than inside a beat, because the three
captions underneath it change while it is open.

`svgOrigin`, not `transformOrigin`: on an SVG group the percentage form
resolves against the element's own bounding box, which for the left cover is
nowhere near the spine — it would swing open from its outer edge.

## Motion, and the face

The opening was two cards holding still for thirteen seconds while he recited
underneath them. Nothing on screen was tied to the sound, which is the
slideshow problem this project keeps having to solve.

So the recitation IS the animation: every Arabic word is a span with its own
measured onset and inks at the moment he says it, on the same driver the
English captions use. Onsets come from word-level Arabic transcription of each
clip, shifted into final-audio time; the hadith and the second half of the
maxim align token for token, and on the first half only the recogniser own
Arabic tokens were taken, because it also emits spurious English mid-stream.

The transliteration and the meaning now arrive within the first second of each
card and stay. Holding them back to land on a cue left the second card meaning
on screen for 1.5s, which is why it read as absent altogether.

The face is **Scheherazade New**, the mushaf hand, already this app own
--font-uthmanic fallback. Not Amiri Quran: Google Fonts ships that with broken
mark attachment and the harakat float off the letters. Scheherazade sets much
wider than Amiri, so every card size was re-measured after the switch.

## Drawn marks, not a list

When he says worship is not limited to salah, prayers, fasting, hajj, the
screen lists too: a mihrab, a misbaha, a crescent, the Ka'bah, each arriving as
he names it and staying, so by the end of the line all four are on the page and
the list can be seen whole. Four nouns set as a paragraph is the one shape that
sentence should not have. A sunrise lands on fajr for the same reason.

Same hairline ink and same ochre as the book, so the drawn things in this film
read as one set rather than as clip art.

## No transliteration

The cards carry the Arabic and its meaning, nothing in between. The
transliteration was a third line of small type on every card and on a reel it
is read by nobody: whoever can read the Arabic does not need it, and whoever
cannot wants the meaning.

## The salah half is cut

The maxim's second clause -- prayer is not called prayer except with purity --
is out. It was 3.6s for a restatement, and losing it brought the film back
under the minute the brief asked for.

## Cuts

Every in/out point is the quietest 40 ms in its neighbourhood, found by
measuring the envelope (`trough.py`), not taken from the recogniser. The
recogniser drifts: on clip 3 its word times run about 0.45s late, which is how
an earlier attempt cut into the middle of *verily* and another caught the tail
of *true* before *Islam*.

## Audio

The three clips were exported separately and arrived at −21.8 / −22.7 / −23.5
LUFS, so each is trimmed to a common level before the join — no seam lands on a
step in loudness. Then +10 dB into a limiter at −1.5 dBFS: **−11.7 LUFS, LRA
2.8**, alongside `seeing-his-face/audio/voice.flac` at −11.6 / 3.1.

A compressor was tried first and rejected on measurement: it bought 2.9 LU
while costing half the dynamic range (LRA 4.1 → 2.0), because the peaks here
are short transients a 10 ms attack cannot catch. The limiter is the right tool
and the range it costs is what it costs.

No denoising: the owner had already cleaned all three, and the floors measure
−62 to −65 dB. No music bed either — the sibling reel has one because it was
asked for; this one was not.

## Line breaks

`check-wraps.mjs` reports how every caption actually breaks and fails the build
on a stranded word. It exists because counting characters got three captions
wrong in a row, and because the renderer and the checker do not always break a
boundary case the same way, so lines are kept clear of the 900px limit rather
than just inside it.

One trap it exposed: the recogniser gives *"saying,"* and *"I'm"* the **same**
onset, and two words at one timestamp cannot be split across a line boundary.
The monotonic pass now separates equal onsets, not just decreasing ones.
