---
workflow: general-video
flow: automation
storyboard: no
message: "Sūrat al-Layl 17–21: he gives owing nobody anything, wanting only the face of his Lord — and he will be satisfied"
destination: instagram-reels
aspect: 1080x1920
language: ar
length: 29.3s
angle: narrative
---

## Intent

A recitation of the closing five āyāt of Sūrat al-Layl, captioned in the Tafsir
Lab language: the āyah in Uthmani script, its number held between two
hairlines, the meaning beneath. One page that scrolls, so the passage reads as
a passage rather than as a stack of cards.

Same build as `../maryam-87-95`, which this is the sibling of — the generator,
the stylesheet and the closing card are carried over unchanged. What differs is
the text, the timings, and that **every** āyah is marked here.

## Assets

- `audio/recitation.flac` — the recitation. Source: `WhatsApp Video 2026-09-21
  at 22.49.38.mp4`. No usable footage; the audio is the whole of it.
- `verses.json` — the text and the measured āyah boundaries. The record of
  where every word on screen came from, and of how each number was arrived at.
- `build.py` — generates `index.html` from `verses.json`. The page is
  generated, not hand-written; edit the data or the generator, never the HTML.
- `measure-stops.mjs` — measures the scroll stops with the real fonts loaded,
  at build time. See its header for why that cannot be done in the page.

## The passage

92:17–21 ends the sūrah, and its rhyme is its argument, not decoration on the
end of a line:

| āyah | rhyme      | what it carries                          |
| ---- | ---------- | ---------------------------------------- |
| 17   | al-atqā    | who is spared it                         |
| 18   | yatazakkā  | why he gives                             |
| 19   | tujzā      | the repayment he is not chasing          |
| 20   | al-aʿlā    | whose face he is after instead           |
| 21   | yarḍā      | what he gets                             |

Colour those five and you have read the passage. Maryam left one āyah unmarked
because its rhyme was not part of what that passage argued; here there is no
such āyah.

## Timing

Boundaries were read off the sound, not guessed. A 5 ms envelope gives the
quiet troughs; each candidate slice was then transcribed on its own and had to
come back as exactly one āyah — `1.40–4.90` returns *wa-sayujannabuhā l-atqā*
and nothing more, `4.90–9.70` returns 18 entire, `9.70–18.37` returns 19
entire. The rhyme-word onsets come from word-level transcription.

## Audio

Left channel of the source, which is exactly dual mono (L−R measures −91 dB, so
summing would only risk the ceiling). Trimmed 1.12s–27.90s, 70 Hz highpass,
+1.6 dB, true-peak limited to −2.0 dBFS: **−12.0 LUFS, LRA 5.8** of the dry 6.0.

Left undenoised deliberately. The floor measures p5 −28.3 dB against Maryam's
−26.6 dB — this recording is marginally the cleaner of the two, and that reel
was accepted as it stands. There is nothing here to remove that was not already
there.
