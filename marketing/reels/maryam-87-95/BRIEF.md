---
workflow: general-video
flow: automation
storyboard: no
message: "Sūrat Maryam 87–95: no one comes to the Most Merciful as anything but a servant, and every one of them comes alone"
destination: instagram-reels
aspect: 1080x1920
language: ar
length: 61.0s
angle: narrative
---

## Intent

A recitation of Sūrat Maryam 87–95, captioned in the Tafsir Lab language: the
āyah in Uthmani script, its number held between two hairlines, the meaning
beneath. Set as pages of the app's own Mushaf view rather than as a video with
subtitles on it.

## Assets

- `audio/recitation.flac` — the recitation. Source: `WhatsApp Video 2026-09-20
  at 19.45.12.mp4`, a screen recording of a voice-memo player ("Qiyam — Sūrah
  Maryam", 12:27 into a 36:47 recording). No usable footage, again.
- `verses.json` — the text and the measured āyah boundaries. The record of
  where every word on screen came from.
- `build.py` — generates `index.html` from `verses.json`. The page is
  generated, not hand-written; edit the data or the generator, never the HTML.

## Customizations

- **The Arabic is verbatim from api.quran.com** (`text_uthmani`), fetched the
  same way `lib/quran-api.ts` fetches it, and the translation is Saheeh
  International (resource 20) — the app's own. Nothing on screen was typed from
  memory. A model asked to write Qur'an from memory writes something that reads
  correctly and is wrong in the wording.
- **The Arabic does not move.** It arrives and then it is still. No word-level
  highlighting: the recitation is being heard, the eye follows the ear, and
  lighting parts of Qurʾānic text on a per-word timing I cannot verify would be
  a claim I am not able to make. What is timed is what was measured — which
  āyah is up, and when its meaning arrives under it.
- No music. Nothing plays under the recitation.
- Ends on the TafsirLab card, as the other reel does.

## Notes

- **Boundaries were measured, not guessed.** `silencedetect` found nothing —
  the room tone never drops below −30 dB — so the splits come from a 20 ms
  amplitude envelope with a threshold set from the distribution. Eight of the
  nine fell out cleanly. The 89→90 split has no pause at all; it was placed by
  transcribing overlapping windows until "iddā" and "takādu" landed either side
  of 15.72. Verified afterwards by transcribing each card's own window in the
  finished render: all nine match.
- **19:90 gets two translation lines**, arriving on the reciter's own breath at
  23.20 — the one place the timing goes finer than the āyah.
- **Scheherazade New, not Amiri Quran.** See `frame.md`; the Google-Fonts build
  of Amiri Quran has broken mark attachment in Chrome.
- **The audio is the LEFT channel only.** The two channels are decorrelated and
  summing them loses about 8 dB to phase cancellation (L −13.0, R −14.2,
  L+R −17.7). Both carry the same recitation with the same spectrum, so one is
  enough and one is louder.
- **Level was set with a single static gain**, not `loudnorm`'s dynamic mode,
  which crushed LRA from 4.3 to 1.6 on the first attempt. A reciter's dynamics
  are the performance. Delivered at −11.9 LUFS with LRA 4.9 intact.
