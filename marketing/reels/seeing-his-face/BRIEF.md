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

- `audio/voice.flac` — the speech. Source: `cleaned-video (2).mp4`, the owner's
  second and much cleaner denoise, supplied already trimmed. It is **0.38s
  ahead** of the caption grid — it keeps the "If you" before "Live this life" —
  so it is cut at 0.38s rather than used as handed over.
  That offset was measured acoustically, not inferred: cross-correlating the
  two takes' 100 Hz amplitude envelopes gives a sharp peak at +0.38s (score
  0.0415 against 0.0193 at zero lag) and every one of seven 4-second windows
  agrees on the same value, so it is a uniform shift and not a re-time. The ASR
  could not have told us this — its word boundaries disagree between passes and
  on this take it lost the taʿẓīm phrase entirely, lumping three seconds into
  one word.
  Verified end to end afterwards: twelve distinctive word onsets against the
  live grid, mean drift +0.023s, most of them exact. The two that move (0.22s)
  both follow a pause, where onset detection is ambiguous either way.
- Earlier sources, superseded: `cleaned-video.mp4` (first denoise) and the
  original `WhatsApp Video 2026-09-19 at 21.09.21.mp4`.
- `transcript.json` — whisper word-level transcript of that exact trim, the grid
  every caption is synced to.

## Customizations

- Starts on "Live this life", ends on "…show you His face." — the owner's two
  cut points, measured against the transcript, not eyeballed.
- Volume raised: the source sits at −18.9 LUFS (the second denoise needs 3.2 dB
  less lift than the first, so it amplifies less of everything else); the delivered file is
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

- Nasheed bed (`audio/bed-nasheed.flac`, the same *ila rabbi* used in
  labai-live), with a 2.4s fade in and a 1.8s fade out baked into the file —
  the renderer owns audio playback, so a fade that existed only as a GSAP tween
  would never reach the mix. Taken down 20% (−1.94 dB) on the owner's ear;
  measured in the delivered file it now sits **13.2 dB below his voice**,
  against 11.2 dB before.
- Both tracks are FLAC rather than MP3. The voice arrives as 128k AAC and the
  nasheed as 160k MP3, and the renderer encodes to AAC on the way out — handing
  it an MP3 in between added a third lossy generation, and for the nasheed that
  generation was MP3 at the *same bitrate as its source*, the worst case there
  is. The 44.1→48k resample now goes through soxr at precision 28.
  Measured honestly: above 16 kHz the new path is 2.8 dB cleaner, which is
  mostly resampling junk the old one was carrying rather than detail it was
  losing. The structural fix is right; the audible difference is small, and
  the change you can actually hear is the bed coming down.
- A train passes behind the first three seconds. On the second denoise it is
  already 19.8 dB further down than it was — 46.7 dB below the speech in the
  first gap, against 26.9 — but it is still there, and the compressor's makeup
  gain would bring it back up. So the downward expander stays: `agate` at
  −36 dBFS, ratio 6, 10ms attack / 250ms release, 8 dB knee, range capped at
  −30 dB, ahead of the compressor. Without it the residual floor sits only
  26 dB under the speech; with it, 56 dB. Every speech probe — word onset,
  mid-phrase boundary, decay tail — matches the ungated build to 0.1 dB.
  Spectral denoise was tried and rejected: it bought 0.7 dB and cost 2 dB off
  a word onset.
- No green — the app's emerald accent is excluded from reels by standing owner
  decision. The accent here is the app's warm ochre.
- Bottom 340px and top 220px stay clear of content: Instagram's caption,
  handle, audio ticker and action rail sit there.
