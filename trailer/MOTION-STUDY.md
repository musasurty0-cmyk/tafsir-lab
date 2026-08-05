# Motion study — measured from reference reels

Frame-by-frame measurements taken from reference reels. Numbers below are counted
frames and tracked pixels, not estimates.

Part I is what the references *do*. Part II is how to find that out without wasting
three render cycles guessing — written after doing exactly that.

Sources (outside the repo):
- `~/Downloads/videoexamples/WhatsApp Video 2026-08-04 at 14.13.12.mp4` — iMessage, 14.9s
- `~/Downloads/videoexamples/WhatsApp Video 2026-08-04 at 14.13.14.mp4` — Mail, 19.1s
- `~/Downloads/videoexamples/WhatsApp Video 2026-08-04 at 14.13.18.mp4` — ClickUp, 16.2s
- `~/Downloads/SnapInsta.to_AQOAN…mp4` — Notion `/` command, 13.0s
- `~/Downloads/SnapInsta.to_AQOYcXgpa4…mp4` — **search bar → panels, 1280×714 @ 29.97fps, 18.9s**
  (the source for `SearchReel`; §9 below is tracked from it)

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

## 9. The search reel — a tracked arc

Everything here is the blob's bounding box per frame, in the source's own
1280×714 / 29.97fps space. Threshold `< 100`, largest connected component. The whole
move — an underline that gathers into a dot, flies up, and drops in as a caret —
is 51 frames, **1.70s**.

### 9.1 The arc is badly asymmetric, and that is the whole point

| phase | frames | what the velocity does |
|---|---:|---|
| rule draws | 1–15 | still (cy 421.5, drifts up 3px), w grows 94→201, h 4→13 |
| gather + launch | 15–22 | **one move** — it slingshots: −3, −3.5, −4, −5, −7.5, −12.5, −20.5, **−43.5** px/f |
| decay to apex | 22–35 | −43.5, −20, −10, −6, −4.5, −3.5, −2, −2, −1.5, −1, −1, −0.5, −0.5 |
| **hang** | 31–39 | **9 frames, 300ms**, within 3px of the apex |
| fall | 39–52 | +1, +1.5, +2, +2, +3, +3, +4, +5, +7, +8, +10.5, +15, **+28** |

- Rise: 160px over 34 frames. Fall: 110.5px over 17. **The fall is twice as fast.**
- The decay roughly **halves each frame** — that is damping, not gravity. Gravity
  would decelerate by a constant.
- The rise is an impulse with drag; the fall is an ease-in. They are *different
  curves*, and the hang between them is what makes the object read as thrown rather
  than tweened.
- Geometry relative to the bar's text line: rule sits **+49.5** below, apex is
  **−110.5** above, landing is 0. Dot is 24×24; the caret it becomes is ~11×25.

### 9.2 The camera pans hard, then stops dead

Tracked off the back-arrow glyph's centre x — a fixed point of the *chrome*, so its
movement is the camera's:

```
f4 477.5 → f8 438.5 → f12 417.5 → f16 405 → f20 399 → f24 398   (pan ~78px left, decaying)
f24 398 → f28 400 → f32 400.5 → f36 401.5 → f40 402.5           (STOPPED — 4.5px in 16 frames)
f40 402.5 → f44 404.5 → f48 410.5 → f52 427.5                   (accelerates right as the dot falls)
```

Per-phase motion energy of the source (full-res mean |Δpixel| between consecutive
frames) shows the same shape numerically:

| rule | launch | rise | **hang** | fall |
|---:|---:|---:|---:|---:|
| 0.569 | 0.605 | 0.188 | **0.054** | 0.418 |

**The hang is a dead stop, not a slow drift.** Everything else quits so the one
floating object has the frame. An even camera drift — which is what instinct says to
add, because a locked frame feels dead — fills that silence in and destroys the shape
of the sequence. See §11.3.

### 9.3 The address is painted, not typed

- **19 frames of nothing** after the landing: the caret just sits there.
- Then all 26 characters in **18 frames (0.6s)** — far too fast to read as typing.
- Width growth per frame: 7, 8, 12, 15, 20, 27, 40, **46**, 41, 36, 24, 9 — a clean
  S-curve, over half the string inside a third of the time.

"Painted, not typed" is **a different curve**, not a texture applied to typing. A
linear ramp with sine wobble on it — the obvious way to fake a human hand — is the
wrong shape entirely.

### 9.4 Proportions, sampled

| | source | note |
|---|---|---|
| Bar assembly | **35.9%** of frame width | ink span 393–854 |
| Field, unfocused | ~218 source-px | bounded by the menu glyph ending 514 and refresh starting 738, symmetric about the placeholder's centre at 623 |
| Field: unfocused / focused-empty / full | 350 / 406 / 489 | **back-arrow↔refresh distance — this is NOT the field**, it also spans two buttons and two gutters |
| Chrome glyph ink | mean **83** | mine rendered at 124 — half again as pale |
| Type size | **0.600** of the field's height | mine was 0.479, which left the field looking empty |
| Page | `252,249,253` | flat. blue-minus-red **+0.90** — neutral. **There is no bloom.** |
| Layout | `< ☰ [field] ↻ ⧉` | **two buttons each side** — see §11.2 |

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

`SearchReel` now closes (2), (4) and (5) *for itself only* — it has a tracked camera,
speed-proportional smear on the mark, and depth blur on the panel stack. The other
compositions have not been re-checked against this list.

---

# Part II — Method

Everything below was learned by getting it wrong first. The measurements in Part I
took about ten minutes to produce once I decided to produce them; the three attempts
that preceded them cost a full build-render-review cycle each.

## 10. Measure the source before building, not after failing

Three attempts at the search arc were made by reasoning about what the motion *should*
be. All three were rejected. Tracking the reference gave a **0.52px mean error over a
242px arc** on the first try afterwards.

The data also contained things no amount of looking would have produced: that the
gather and the launch are one move, that the decay is damping rather than gravity, and
that there is a 300ms hang at all. **For anything with a reference, extracting ground
truth is step one.**

### The recipe

```python
# per-frame bounding box of the one dark object
im   = np.asarray(Image.open(f).convert("L"), dtype=np.int16)
mask = im < 100                      # the mark is solid black; text/chrome is grey
# → flood-fill connected components, take the largest, record (x0,x1,y0,y1,cx,cy,w,h)
```

Then convert once, into a table baked straight into the composition rather than
approximated by hand:

```
scale x = 1920/1280 = 1.5      scale y = 1080/714 = 1.512      time = 60/29.97 ≈ 2×
```

Other measurements worth having in the kit:

- **Motion energy**: `mean |frame[n] − frame[n−1]|` at full resolution. Compare
  *per phase*, never in aggregate (§11.3).
- **Noise floor**: run the same metric on an empty corner first. On this source it
  came back `0.000`, which proved the motion was real and not codec churn. Do this
  before trusting any energy number.
- **Ink**: `(frame < 200).mean()` — how much dark matter is on screen. This is the
  metric that finally explained a residual gap I was about to over-fit (§11.6).
- **Colour cast**: `(b − r).mean()` over a region. Caught a blue bloom I had invented
  and believed was in the source.

## 11. The six traps, and what to do instead

### 11.1 A "feel" complaint is usually a measurable defect

*"Doesn't feel smooth, almost low frames"* was not a taste note. The keyframe tracks
were piecewise **linear**, so velocity was constant inside each segment and *stepped*
at every stop — C0 but not C1. Measured: **six discontinuities, worst 11.69px/frame**,
including a direction reversal between two adjacent frames with no deceleration.

The eye reads a velocity step as a dropped frame.

**Do instead:** treat any perceptual complaint as a search for the numeric property
that would cause it. And check C1 continuity as a cheap invariant before rendering:

```
v[i] = track(i+1) − track(i)          # velocity per frame
max |v[i+1] − v[i]|                   # want this small relative to peak |v|
```

Monotone cubic Hermite (Fritsch–Carlson) fixes it: velocity carries through every
stop, a reversal sets the tangent to zero so an apex decelerates into itself, and the
limiter stops the spline bulging past a flat run — so an overshoot has to be an
explicit keyframe rather than an accident. Worst step went **11.69 → 1.90 px/frame**.

### 11.2 Never anchor a check to the assumption under test

**The most expensive mistake in the whole run, twice.**

The rule sat 50px right of the field for its entire visible life. My verification drew
the centre line at `W/2 + camX` and the rule lined up on it *perfectly* — because that
expression was the row's centre, which is the same assumption that produced the bug.
The row had one button on the left and two on the right, so the *field's* centre was
50px away. **The test could not have failed.** The same error had already happened
once: I derived the rule's sweep by subtracting the back-arrow's motion, treating it
as a fixed point, when it carries both the camera and the layout.

**Do instead:**
- Derive the expected value from the code, measure the actual from **independently
  observable pixels** — the pill's own box, the placeholder's ink — and require the
  two to agree. If both sides come from one source, it is not a check.
- Anchor to **what the eye reads against**. The rule looks centred under the *field*,
  so the field's centre is the anchor; the row's centre is a number, not a thing
  anyone sees.
- Before running a check, name the result that would falsify it. If none exists,
  rewrite the check.

### 11.3 Instincts about motion are hypotheses; test them per phase

Two plausible theories, both backwards:

| I believed | The source actually does |
|---|---|
| "A locked frame reads as dead, so drift the camera throughout" | Pans hard and early, then **stops dead** through the hang (0.054 vs my 0.196 — **3.6× too busy**) |
| "Typing needs an uneven, human rhythm" | Does not type. 26 chars in 18 frames on a clean S-curve |

The aggregate hid it: overall I was 1.4× too still, while *inside* that I was 2.6× too
still in one phase and 3.6× too busy in another. **Aggregates average away exactly the
errors that matter.** Always split the timeline into named phases and compare each.

### 11.4 When you fix an artifact, measure what the fix could break

The crossfade added to remove a visible cut made the card **vanish for six frames** —
two independently-eased opacities both sit near zero in the middle, and these are white
cards on an off-white page. I had checked centre and width, both fine; I had not
checked brightness, so the metric was blind to the new bug.

Fix: drive both sides from **one value** so the opacities always sum to 1.

**Do instead:** measure *through* a transition, not at its endpoints, on the property
the fix could plausibly damage. Afterwards the handover read: width 539→559 smooth,
centre stable ±1px, peak brightness never below 254.7.

### 11.5 Numbers and frame strips catch disjoint bugs

No metric ever flagged that the dot floated in empty space for nearly a second, or
that it crossed the placeholder twice on its way up and back down. That was pure
choreography — *transitions happening for no reason* — and it was only ever visible.
Conversely, no amount of looking would have found the 11.69px/frame velocity step.

**Do instead:** pull a contact sheet every render, not only when the numbers look bad.

```bash
ffmpeg -i out.mp4 -vf "select='between(n,54,166)*not(mod(n-54,4))',\
  crop=W:H:X:Y,scale=270:-1,tile=5x6:margin=2:padding=3" -frames:v 1 -update 1 strip.png
```

A frame-matched side-by-side against the source (`vstack` two tiled strips at matched
moments) is the single most useful image to produce, and the fastest way to see a
difference you have no metric for.

### 11.6 Know when a metric has stopped informing

After the arc matched to half a pixel, motion energy still read 1.4× low and I kept
tuning toward it. The residual was not motion at all: my UI had **0.147% ink against
the source's 0.256%** — fewer dark pixels to move. It was missing a button, a glyph,
and carried strokes half again too pale.

**Do instead:** before optimising further against a number, check whether the gap is
explained by something outside that metric's scope.

## 12. Sound — what survives measurement and what does not

The source's hits sit under a **128 BPM** bed, so nothing about them can be read
directly. Subtracting the median spectrum of a neighbouring music-only window
gets you *part* of the way. Knowing which part is the whole lesson.

### 12.1 The envelope survives. The timbre does not.

**Envelope — trustworthy.** Gross energy per event is robust to imperfect
subtraction, and it comes back with the same shape as the picture:

| rule | launch | rise | **HANG** | fall | landing | typing | collapse | cards |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| +28.2 | +26.7 | +9.7 | **+5.9** | +20.2 | +21.3 | +19.9 | **+34.3** | +30.6 / +32.3 |

Two things fall out: the **collapse and the card arrivals are the loudest
moments in the reel, not the launch**, and the **hang is near-silent** — the
audio quits exactly where the camera does, so the float has the mix to itself
as well as the frame.

**Timbre — worthless.** The same subtraction returned spectral flatness of
**0.02–0.09** for those events. That is a pure tone. No whoosh, click or impact
is ever tonal — real ones measure 0.35–0.75. Those readings were the source's
*music* leaking through the subtraction.

I then matched a library against them, which asked for tonal sounds and got
exactly that: an **8.4kHz scan tone** under the typing and a **773Hz pitched
boom** on the collapse. Two beeps, both of which I had requested. And ranking
on envelope alone — duration, centroid, attack, flatness — had already
returned a **pistol shot** for the rule and a **cash register** for the launch,
all three matching numerically. Envelope features describe a shape, not an
identity.

### 12.2 Gate on tonality, and pick on intrinsic quality

Filter to a plausible family per cue, then require of every candidate:

```
flatness > 0.32                     # it must BE noise
pitch-locked fraction < 0.35        # no bin stays the loudest across frames
```

A "beep" is both together: a **locked pitch WITH energy behind it**. The old
collapse held one bin at 86% of frames carrying 8.1% of total energy. A clean
whoosh can read 50% locked at 1.2% — that is a broadband peak wandering, not a
tone, so both numbers are needed.

Useful finding: **zero files named impact / hit / boom passed the gate, in
either pack.** A bass hit is tuned by nature. Weight on a big moment has to
come from layered whooshes instead.

### 12.3 Two mechanical faults worth not repeating

- **Place a one-shot by its transient, not its first sample.** `Deep, Mini,
  Whoosh 9` carries 0.88s of near-silence before it swells. Placed by sample
  zero it lands a third of a second late; trimmed blind, the trim removes the
  very peak the gain was computed from and the file bakes **33dB quiet**.
  Measure each file's peak offset when baking and pass it as a lead.
- **Fade tails.** Remotion's `Sequence` stops audio dead at
  `durationInFrames`, and chopping a decaying tail mid-sample is an audible
  click. Every cue in the first set ended on one.

### 12.4 Measure flatness IN BAND

Spectral flatness is a geometric mean, so empty bins destroy it. An mp3 zeroes
everything above ~16kHz, which made my own baked files read 0.13–0.19 —
"tonal" — when band-limited to 120Hz–15.5kHz they were 0.47–0.96. Always
restrict to where the format actually has content, or you will fail good files
and chase a fault that is in the ruler.

## 13. Two things that are just true about this work

**A passing test is not evidence against a report.** At the centring point I had
"verified" it green. Weighting that over what was actually on screen would have meant
arguing instead of finding a real layout bug. When something is reported wrong, the
job is to go find the mechanism — not to re-run the check that already lied.

**Structural fidelity beats magnitude fidelity.** The reel became convincing when the
*shape* matched — phase order, the hang, the asymmetry, the ramp of the fall
(correlation 0.832) — not when the absolute numbers did. Chase the curve's shape
first; scale is a second-order fix and often turns out to be a different problem
entirely.
