---
workflow: motion-graphics
flow: automation
storyboard: no
message: "Lab AI is now live in TafsirLab"
destination: instagram-reel
aspect: "1:1"
canvas: 1080x1080
language: en
length: 20.7s
angle: problem-solution
---

## Intent (v4 — current)

Light mode, no green, the real product throughout. Reference (an assistant-launch
reel) supplies structure and pacing only: mark card → lockup reveal → into the
assistant → typing → send → thinking → the answer streaming in the chat → close.
Every visual is TafsirLab's: the T tile + italic serif wordmark, the app's light
tokens, Inter + Source Serif 4, and Lab AI's real UI states with its real copy
(empty-state text, suggestion chips, placeholder, "Thinking…", "Searched 12
sources"). Close: "Lab AI is now live." + tafsir-lab.com.

## Flow

Three clips, two Z-seams (push in at 3.4, pull out at 12.3), everything else
continuous: the row-slide wordmark reveal, chip cascade, humanised typing, the
typed line itself flying up to become the user bubble, thinking dots, the trace,
the word-by-word stream with citations, stillness, close.

## Iteration log

- v1: abstract clone of first reference — rejected (not the aesthetic, "random").
- v2: workspace + drawer board — superseded by the new reference mid-build.
- v3: dark/green Gemini-structure build — rejected (dark, green, invented glyph).
- v4 cycle 1: light rebuild, real UI. Critique: lockup reveal mangled the two
  T's; flyer landed ~130px off its bubble slot; empty state lingered under the
  flight; stream left the bubble half-empty too long. All four fixed.
- v4 cycle 2: seam audit at ±0.1s — both Z-seams mid-motion, signs matched.
- v4 cycle 3: typing cadence humanised (patterned 24–48ms + word breaths).
- v5: owner's note — "feels like an animated slideshow." Diagnosis: the 8.9s
  middle was one static camera; every beat faded in place. Rebuilt as a
  five-move camera performance (punch to the typing, glance to send, dolly up
  riding the sent message, settle onto the reply, pull wide over the stream),
  each move caused by a story beat, every framing edge-pinned so wide content
  survives the crop (cycle 1 caught the landed bubble clipping off-canvas at
  centre-zoom). Close line now waterfall-enters word by word. Seams untouched.
- v6: owner's note — "doesnt feel like it solves any problems, just feels
  like a new feature." Diagnosis: the reel opened on a logo and demoed;
  nothing was at stake. Restructured as problem → turn → payoff (16.5s): the
  logo intro is gone (the brand signs the close), the open is three kinetic
  text beats — "One question." / "The answer sits in twelve books." /
  "Finding it takes hours." — chained by word-level waterfall cuts on one
  leftward current; the Z-push into the panel is now the TURN, the panel
  answers that exact question, "Searched 12 sources" pays off "twelve
  books", and the close answers the open: "Seconds, not hours." Cycle 1
  caught the §4 immediateRender ghost (future beats visible at 0.35 alpha
  from frame zero) — fixed with immediateRender: false + build-time rest
  states.
- v7: owner's note — "doesnt flow seamlessly; every screen should transition
  into the next around a point — review the links reel's search bar as a
  vehicle." Applied the SearchIntro pattern (trailer/src/reel/SearchIntro):
  ONE container carries every screen change. The ask bar arrives out of the
  problem act (riding the same leftward current "hours." exits on), holds
  through an invisible match cut, morphs into the composer's exact slot —
  same width/height/radius/centre at the swap — while the app assembles
  around it (header from above, empty state rising, the dot desk clearing),
  then runs the SAME morph backwards at the end (chrome shedding the way it
  came, desk returning) into a second invisible cut; the close arranges
  around the bar's fixed slot and the reel ends on it, empty — asked,
  answered, ready to be asked again. Both Z blur-cuts deleted. Audit caught
  a latent camera bug the invisible cuts exposed: cam fromTos rendered their
  from-states at build (last-created won — c2 opened at scale 1.08/y 43
  since v5); all cam tweens now immediateRender: false. Vertical morph
  travel rides transform y, not `top` (layout snapping under seek capture).
- v8: owner's note — "show off the embed to notes feature, use a mouse as
  the anchor." New act inside the panel take (total 19.5s), authored to the
  oversized-cursor spec: the answer offers "Add to editor" (the app's real
  affordance), the 7%-frame cursor enters off bottom-right on one vector,
  tip-clicks the chip (asymmetric tap, chip presses back), and the click
  ignites the split — the panel docks right as a floating card, the editor
  page ("The Names of al-Fātiḥah", the demo's real page) rises to receive,
  and the note block flies from the answer into the page with its citations
  and an "Added from Lab AI · 12 sources" tag, the cursor leading and then
  exiting off-frame; its exit cues the room to settle back before the bar
  comes home. Audit fixes: docked panel overlapped the editor (page → 480
  wide, dock → 0.5× flush at x 520); cursor tip landed low on the chip;
  cursor rested on the note's tag (parked below the block); eyebrow + tag
  ink-4 failed 4.5:1 (→ ink-3).
- v9: owner's notes — "finding it takes hours? then show the ai? does the
  ai take hours?" and "add sfx and nasheed". (a) The turn beat: a fourth
  problem line — "Not any more." (italic, setting up the close's "Seconds,
  not hours.") — contradicts the pain BEFORE the product appears, so the
  panel reads as the proof. Everything from the old seam shifts +1.2s
  (20.7s total; seams now 5.8 / 17.7). (b) Sound: the owner's own
  AI-generated nasheed (Downloads) as the bed — trimmed to 20.7s from 12s
  in, loudnorm −18 LUFS, 1.2s/1.7s fades — plus the owner's downloaded
  typing/whoosh/click SFX and bundled pop/ping/notification/sparkle,
  pinned to beats: the three text cuts, the bar's morphs, typing, the send
  click + flight, the bubble landing, "Searched 12 sources", the
  add-to-editor click + dock, the note landing, the chrome shed, and the
  payoff line.

- v10: owner's notes — "use the ila rabbi nasheed", "the whoosh is too
  loud", "the last sound effect is bad", and "the first three scenes up
  till the search bar feel like a slide show". (a) Bed re-cut from the
  al-Jarallah/al-Nufais nasheed (the "ila rabbi" one — the owner's other
  ZapCap download), from 10s in, same loudnorm/fades. (b) Every whoosh
  roughly halved (0.16–0.22). (c) The sparkle under the close line
  deleted, nothing in its place. (d) The CONVEYOR: no problem-act line
  ever sits still — each beat's whole line rides a slow constant leftward
  creep (+18 → −18px, the current made visible) from ignition to exit,
  with word entries/exits composing on top; the dot ground drifts to rest
  across the act and lands at exactly scale 1 on the cut frame, keeping
  the invisible seam.

## Notes (audio)

- The bed is `[ZapCap AI] - فيّ حبٌ ‖ عبدالله الجارالله - أحمد النفيس`
  ("ila rabbi") from the owner's Downloads — AI-generated cover, so no
  licensing exposure; swap `audio/bed-nasheed.mp3` and re-render to
  change the track. The previous bed was the "On My Way" instrumental.

## Notes

- Silent — supply a track and the beats are on clean timestamps.
- The answer text is a tightened paraphrase of Lab AI's real output from the
  live test earlier this session; "Searched 12 sources" is its real trace.
