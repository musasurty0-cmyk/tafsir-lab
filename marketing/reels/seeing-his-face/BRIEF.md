---
workflow: general-video
flow: automation
storyboard: no
message: "Travel light through this life, and venerate Allah for no reason but that He is Allah — so He has no excuse but to show you His face"
destination: instagram-reels
aspect: 1080x1920
language: en
length: 28.16s
angle: narrative
---

## Intent

An excerpt from the owner's own khutbah, *Seeing Allah in Jannah*, set as a piece
of kinetic typography in the Tafsir Lab visual language. His recorded voice
carries it; the type is the picture. Every word he says is on screen and lit at
the moment he says it, and the two Arabic phrases he reaches for are given the
weight they carry in the speech rather than being flattened into English.

Tone: quiet and deliberate. This is a reminder, not a promo — no hype cadence,
no ornament that would read as marketing.

## Assets

- `audio/voice.mp3` — the speech, trimmed to the two boundaries the owner named
  and loudness-raised. Source: `cleaned-video.mp4`, the owner's own denoise of
  `WhatsApp Video 2026-09-19 at 21.09.21.mp4` (a screen recording of the voice
  note; no usable footage in either). Same 33.055s timeline, verified word by
  word against the original: mean drift +0.008s.
- `transcript.json` — whisper word-level transcript of that exact trim, the grid
  every caption is synced to.

## Customizations

- Starts on "Live this life", ends on "…show you His face." — the owner's two
  cut points, measured against the transcript, not eyeballed.
- Volume raised: the denoised source sits at −22.1 LUFS; the delivered file is
  −10.4 LUFS at −1.7 dBTP, with the dynamic range pulled to LRA 3.2 and a
  presence lift at 3 kHz. Removing the noise is what let it get this loud —
  with hiss in the recording, every dB of gain raised the hiss too, and the
  best the mix reached was −12.0.
- Noise floor in his 1.3s pause: −45.5 dB, against −32.7 dB before the
  denoise. That is the pause actually being a pause.
- Captions carry every word except the four runs the owner asked to be shown
  another way: "First of all," and "And secondly," are circled numerals, and
  "as if you are a traveller, just simply, merely a traveller." is the first
  Arabic card, held from 4.0s to 7.9s with nothing else on screen.
- "on return" → **"in return"**. The ASR misheard it; he is the speaker.
- The two Arabic phrases the owner identified are set in Arabic with
  transliteration and gloss: مُجَرَّد مُسَافِر and تَعْظِيمُ اللهِ لِأَنَّهُ الله.

## Notes

- Nasheed bed (`audio/bed-nasheed.mp3`, the same *ila rabbi* used in
  labai-live), sitting 16.5 LU under the voice, with a 2.4s fade in and a
  2.56s fade out baked into the file. It reads as atmosphere under the
  speech and only becomes properly audible in his 1.3s silence at 23.9s.
  It costs about 1 dB of voice level, because the renderer normalises the
  sum of the tracks rather than passing them through.
- No green — the app's emerald accent is excluded from reels by standing owner
  decision. The accent here is the app's warm ochre.
- Bottom 340px and top 220px stay clear of content: Instagram's caption,
  handle, audio ticker and action rail sit there.
