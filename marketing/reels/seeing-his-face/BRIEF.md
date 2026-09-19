---
workflow: general-video
flow: automation
storyboard: no
message: "Travel light through this life, and venerate Allah for no reason but that He is Allah — so He has no excuse but to show you His face"
destination: instagram-reels
aspect: 1080x1920
language: en
length: 30.4s
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
  −11.6 LUFS at −2.1 dBTP, LRA 3.3. Removing the noise is what let it get this
  loud — with hiss in the recording, every dB of gain raised the hiss too.
- Warmed, after the first pass came back tinny. The cause was the EQ curve
  itself: it cut 260 Hz (a male voice's body) and lifted 3 kHz by 3.5 dB,
  which is the textbook recipe for thin. Measured against the raw take it had
  scooped 640–1280 Hz by 0.9 dB and lifted 2.5–5 kHz by 1.7 dB. The curve is
  now +4 dB at 190 Hz, +2 at 800, +0.5 at 3.2k, −2.5 at 4.5k, and the
  pre-loudnorm limiter is eased from −5.2 to −4.2 dBFS because hard limiting
  reads as harshness too. Presence-minus-body moved 3.4 dB toward body
  (−8.5 → −11.9) at the same delivered loudness.
- The denoise was checked as a suspect and cleared: it costs 1.6 dB at
  60–120 Hz and is otherwise spectrally neutral. The thinness was ours.
- Noise floor in his 1.3s pause: −45.5 dB, against −32.7 dB before the
  denoise. That is the pause actually being a pause.
- Captions carry every word except the four runs the owner asked to be shown
  another way: "First of all," and "And secondly," are circled numerals, and
  "as if you are a traveller, just simply, merely a traveller." is the first
  Arabic card, held from 4.0s to 7.9s with nothing else on screen.
- "on return" → **"in return"**. The ASR misheard it; he is the speaker.
- The two Arabic phrases the owner identified are set in Arabic with
  transliteration and gloss: مُجَرَّد مُسَافِر and تَعْظِيمُ اللهِ لِأَنَّهُ الله.
- Set in Literata at 700 rather than the app's Source Serif 4 — the owner asked
  for something slightly different and thicker. The wordmark stays in Source
  Serif 4 so the mark matches the other reel.
- Ends on the TafsirLab card, 28.60–30.40. The nasheed carries it and fades out
  underneath, reaching silence on the last frame.

## Notes

- Nasheed bed (`audio/bed-nasheed.mp3`, the same *ila rabbi* used in
  labai-live), sitting 16.3 LU under the voice, with a 2.4s fade in and a
  2.56s fade out baked into the file — the renderer owns audio playback, so
  a fade that existed only as a GSAP tween would never reach the mix.
- A train passes behind the first three seconds. It is broadband, loudest in
  the 200–800 Hz band (+12 dB over the rest of the recording), and audible
  only in the two gaps between words — under speech it is 40 dB down. A
  downward expander ahead of the compressor takes 39–41 dB off those gaps
  (`agate` at −36 dBFS, ratio 6, 10ms attack / 250ms release, 8 dB knee,
  range capped at −30 dB). Every speech probe measures identical to the
  untreated take, including the decay tail of "face." at 12.9s. Spectral
  denoise was tried first and rejected: it bought 0.7 dB and cost 2 dB off
  a word onset.
- No green — the app's emerald accent is excluded from reels by standing owner
  decision. The accent here is the app's warm ochre.
- Bottom 340px and top 220px stay clear of content: Instagram's caption,
  handle, audio ticker and action rail sit there.
