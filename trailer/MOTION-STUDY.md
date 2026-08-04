# Motion study — measured from reference reels

Frame-by-frame measurements taken from four reference reels (dnyxstudios / @thednyx),
all 30fps square. Numbers below are counted frames, not estimates.

Sources (outside the repo):
- `~/Downloads/videoexamples/WhatsApp Video 2026-08-04 at 14.13.12.mp4` — iMessage, 14.9s
- `~/Downloads/videoexamples/WhatsApp Video 2026-08-04 at 14.13.14.mp4` — Mail, 19.1s
- `~/Downloads/videoexamples/WhatsApp Video 2026-08-04 at 14.13.18.mp4` — ClickUp, 16.2s
- `~/Downloads/SnapInsta.to_AQOAN…mp4` — Notion `/` command, 13.0s

---

## 1. Stage vs. surface

Sampled from settled frames of two different reels:

| | value | share of frame |
|---|---|---|
| Stage (background) | `#e5e4e9` | 67–74% |
| Card / control fill | `#ffffff` | 24% |

Both reels use the **same** stage colour. The stage is a cool light grey ~10% darker
than the card. Contrast ratio is only ~1.25:1 — enough to separate white UI from the
backdrop without borders or heavy shadow.

**The app never fills the frame.** It floats as one object on a neutral stage,
centred, occupying roughly a quarter to a half of the frame area. There is always
dead stage around it. That empty margin is what lets the object read as a *thing
being looked at* rather than a screen recording.

## 2. The blur-through morph

The only transition used. A container never cuts, never fades — it blurs, resizes,
and comes back with different content inside.

Measured on the Notion pill → "Empty Page" card:

| phase | frames | seconds |
|---|---:|---:|
| hold before | 9 | 0.30 |
| content blur-out | 2 | 0.07 |
| peak blur + container resize | 3 | 0.10 |
| container sharp, primary content lands | 1 | 0.03 |
| secondary content catch-up | 6 | 0.20 |
| **total morph** | **12** | **0.40** |

Measured on the same pill → slash menu (a bigger size change):

| phase | frames | seconds |
|---|---:|---:|
| hold before | 14 | 0.47 |
| blur ramp | 4 | 0.13 |
| peak blur, content fully gone | 4 | 0.13 |
| container resolves at new size (**overshoots wider**) | 2 | 0.07 |
| content resolves, per-word stagger | 5 | 0.17 |
| settle back from overshoot | 7 | 0.23 |
| **total morph** | **~20** | **0.67** |

Bigger size delta buys a longer morph. Both are bracketed by holds of 0.3–0.5s.
During peak blur the old content is **completely** gone — there is no crossfade of
two legible states, which is what keeps it from looking like a dissolve.

The blur is **directional**: content smears along +X while the container scales, so
the old content appears to exit through the container's right edge.

## 3. Per-word catch-up

The most distinctive text move, and the cheapest to miss.

A two-word label does not fade in as a unit. Word 1 lands at its final position
first. Word 2 arrives **from the right and slightly below the baseline**, then
decelerates into place over 5–6 frames. Visible on "Empty · Page", "Numbered · list",
"To-do · list", "Table · view", "Board · view", "Gallery · view" — all at once, each
offset 2–4 frames from its neighbour.

## 4. The cursor is never still

It drifts continuously, even through a 0.5s hold where nothing else moves. Its
motion blur scales with speed: heavily smeared during fast travel, crisp when nearly
parked. It arrives *before* the thing it clicks and lingers *after*.

This one detail does more than anything else to make the frame feel filmed rather
than assembled.

## 5. Rack focus as a pointing device

Not just transition blur — *sustained* depth of field. In the Notion chip list, most
items sit heavily blurred while one is sharp, held for ~1s, then focus racks to the
next. Blur is used to say "look here", not to cover a cut.

## 6. One container, all the way through

ClickUp reel, in order, without a single cut:

> logo → blank pill → `+ New` → vertical feature list → Create List modal →
> Bookmarks card → Docs card → `Add anything.`

One rounded rectangle for the whole run. It resizes and re-rounds; the content is
swapped underneath the blur. Seven "screens" from one object.

## 7. Structure and the loop

- Pacing: a state change every **1.3–2.0s**, metronomically. Never faster, never slower.
- The Mail reel plays its entire sequence **twice**, the second pass ~2× faster, then
  goes to the outro. Its 7.0s frame is compositionally identical to frame 0 — the loop
  is real, not implied.
- Every reel closes the same way: subject wordmark on dark → studio wordmark with a
  radial bloom → platform outro with a glitch bar resolving into a search pill.

## 8. What the outro glow actually is

`dnyxstudios` white text over black, with a wide soft radial bloom centred behind it.
The text also rotates in from roughly −25° to 0° while the bloom's radius grows. The
bloom is far wider than the text — roughly 3× the text width.

---

## Applying this to the TafsirLab reel

Gaps between the above and the current `src/reel/`:

1. **The app is full-bleed.** `APP_W` fills the frame at `s≈1.5`. The references always
   float the UI on a darker stage with real margin. Needs a stage colour distinctly
   darker than `R.bg`, and the app inset from the frame edge.
2. **Transitions are camera moves and opacity fades.** There is no blur-through morph
   anywhere. The modal appears; it does not grow out of the slash menu.
3. **Text arrives as whole blocks** via `revealAt`. No per-word catch-up.
4. **The cursor teleports between legs and parks dead still.** No idle drift, no
   speed-proportional motion blur.
5. **No rack focus.** Everything is uniformly sharp at all times.
6. **No loop.** The end card is a dead stop; frame 0 is the start screen.
