# Motion study — measured from reference reels

Frame-by-frame measurements taken from reference reels. Numbers below are counted
frames and tracked pixels, not estimates.

**Two different disciplines live in this file. Do not read across them.**

- **Parts I–II — motion authored from nothing.** Every pixel is ours. The reference is
  a *target to converge on*, timing is chosen, and a defect is a curve with the wrong
  shape. Failures are found by tracking pixels.
- **Part III — footage we were given.** The material is fixed: the shot cannot be
  re-framed, the backdrop cannot be re-lit, and the speaker pauses where he pauses.
  Here the source is measured to *discover constraints to obey*, not to copy. Failures
  are found with a level meter and a still.

§14 lists exactly what carries between them and what does not. Read it before
borrowing a habit from one part into the other — most of them do not transfer, and the
ones that look like they should are the dangerous ones.

Sources (outside the repo):
- `~/Downloads/videoexamples/WhatsApp Video 2026-08-04 at 14.13.12.mp4` — iMessage, 14.9s
- `~/Downloads/videoexamples/WhatsApp Video 2026-08-04 at 14.13.14.mp4` — Mail, 19.1s
- `~/Downloads/videoexamples/WhatsApp Video 2026-08-04 at 14.13.18.mp4` — ClickUp, 16.2s
- `~/Downloads/SnapInsta.to_AQOAN…mp4` — Notion `/` command, 13.0s
- `~/Downloads/SnapInsta.to_AQOYcXgpa4…mp4` — **search bar → panels, 1280×714 @ 29.97fps, 18.9s**
  (the source for `SearchReel`; §9 below is tracked from it)

Part III sources — note the difference in kind. These are not references to converge
on; the first is raw material with fixed properties, the second is a reference only
for *treatment*:
- `~/Downloads/YTDown.com_YouTube_Media_IzOClzqHQt8_001_1080p.mp4` — lecture, Shaykh
  Yasser al-Dosari. **09:06–09:40** is the cut used by `DosariReel`
- `~/Downloads/SnapInsta.to_AQP7pcGdvpn0J…mp4` — the *same lecture*, already captioned
  by someone else. Used for caption treatment (§15, §16)

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

### 11.7 A mean hides its own outliers — bin it before you believe it

"10–20s feels repetitive, 20s to the end is perfect." Motion energy agreed
emphatically: **0.282 against 1.218, a 0.23× ratio.** That number was close to
worthless. The good section's mean was carried almost entirely by two events — the
dark-mode flip and the closing morph, at 3.57 and 8.52 — and with those excluded it
sat at ~0.35 against ~0.28. Acting on 0.23× would have meant tearing up a section
that was only mildly quieter than the one the viewer liked.

The bins did have something to say, but it was narrower and more useful than the
mean: one 2-second bin at **0.13**, the lowest in the piece, which located the defect
exactly.

**Do instead:** never compare two sections by their means when one contains a
whole-frame event. Print the bins, find the outliers, and read the *distribution*.
The mean tells you a section is different; only the bins tell you which two seconds
are actually wrong.

### 11.8 Repetition is rhythm, not shape

Four consecutive beats read as repetitive. Three separate causes, and only the first
is the one you would guess:

1. **Identical containers.** Two states were both 760×270 r18 — the rectangle never
   changed between them, so only the text swapped, which reads as a slideshow rather
   than a transformation. The whole run was also one shape family monotonically
   inflating: 205k → 410k → 475k → 515k px². Fixed by making aspect ratio swing
   (3.13 → 1.72 → 1.09 → 1.70) instead of area climb.
2. **Identical composition.** The first two captions sat at the *same* y. Same words
   in the same place under the same rectangle, twice running. Alternating above and
   below the card — at a constant gap, so the spacing stays deliberate — changes the
   frame every beat for free.
3. **Identical rhythm.** Every beat did exactly the same thing in the same order:
   morph, content rises in 0.4s, one caption, then **2.1–2.3s of nothing**. Four
   times. This is the one that actually dominates, and no amount of shape variation
   touches it.

**Do instead:** when something reads as repetitive, check all three before changing
timing. Shape, composition, and rhythm are independent, and fixing the wrong one
costs a re-cut of a section that was fine.

### 11.9 Rotation does nothing to a flat card — displacement is what reads

To fill those dead holds I reached for the tilt already in the file, at the same
amplitude the stack uses. Then I did the arithmetic instead of the render:

```
peak tilt 0.221 → rotateY -1.33°
near edge z-shift 9.8px, at perspective 2600
→ 1.3px of on-screen movement, total, across nine seconds
```

Nine seconds of animation worth 1.3px. It survives a code review, it survives a
still, and it is invisible. The stack gets away with the same amplitude only because
it rocks at period 68 — the *rate* was doing the work there, not the angle.

Swapping it for a translate on the same envelope gave **72.8px** of path along a
figure-of-eight (two axes at different rates, so it never retraces itself).

**Do instead:** cost a subtle move in on-screen pixels-per-second before building it.
For anything near-planar, translate; reserve rotation for objects with real depth or
a fast enough rate to read as a rock.

### 11.10 Hand the motion over — never run two slow moves at once

The float is windowed to end exactly as the cursor arrives, rather than continuing
underneath it. The rule the source keeps: something is always moving, but only ever
one thing. A drifting frame *and* a travelling cursor read as neither being
deliberate.

A useful side-effect of windowing it to zero: outside the window the transform is
`undefined`, not `translate(0,0)`, so the untouched section renders identically and
"I did not break the part they liked" is a fact rather than a hope.

### 11.11 "Add an ease" is not the same as "make it smoother"

Asked to smooth the appearance switch, the obvious move is to ease the ramp and give
it more time. I did both — the shared `easeIO`, and 32 frames → 48 — and then checked
the per-frame rate rather than trusting the intent:

```
curve                  frames   peak rate/frame   start   end
linear (before)            32            0.0312  0.0312  0.0312
easeInOutCubic             48            0.0599  0.0000  0.0000   <- 2x FASTER mid
smoothstep                 48            0.0312  0.0013  0.0013
```

Cubic in/out peaks at **three times** its average rate. Even stretched 50% longer it
moved through the midpoint twice as fast as the linear ramp it replaced. It fixes the
ends and breaks the middle, and for a change that repaints the entire frame the
middle is the part that jolts.

Smoothstep peaks at 1.5× average, so over 48 frames it matches the old rate exactly
while both ends come to rest. Strictly better on every measure, and the difference
between the two is invisible in code review — they are both "an ease".

**Do instead:** for object motion, a fast middle is momentum and cubic is right. For
anything global — tone, exposure, a full-frame crossfade — cap the peak rate at what
the linear version had, and pick the curve that achieves it.

### 11.12 A hard edge hides inside a smooth transition

The switch had three separate roughnesses, and easing the tone only addressed one:
the knob also travelled linearly, and the label and track colour **snapped** on
`k > 0.5`. A boolean threshold sitting in the middle of an otherwise smooth 26-frame
travel is the hardest edge in the moment — one element of the frame teleporting while
everything around it eases.

**Do instead:** when smoothing a transition, grep it for `> 0.5`, ternaries on
progress, and anything else that reads a continuous value as a boolean. Crossfade
them. They are cheap to fix and they are usually what you were actually seeing.

### 11.13 A whole-frame mean hides a small object entirely

Building `OneDesk` I measured per-frame motion energy across the frame and the
opening beat read **63 of 64 frames dead** — apparently a static title card,
the worst possible open. It was not static. Cropped to the 360×360 the mark
actually occupies, the same frames measure mean 0.616 with ink coverage going
388px → 1466px: the mark demonstrably builds.

A 76px glyph fading in inside a 1080×1920 frame moves ~400 of 129,600 sampled
pixels. Its contribution to a whole-frame mean is ~0.02, under any threshold you
would set for "something happened".

**Do instead:** scale the measurement window to the object, not the format. A
frame-wide mean answers "did the composition change", never "is this element
alive". Both readings were correct; only one was about the thing being asked.
This is §11.7's binning problem in space rather than in value.

### 11.14 Give each object a destination, not just a departure

Four collaborator chips flew in from four different directions and landed in one
illegible pile. Each had its own entry vector and they all shared `left: 50%;
top: 40%` — so the animation was correct and the layout was not. Every one
converged on the same pixel the moment it arrived.

The bug is invisible at both ends of the timeline you tend to check: at p=0 they
are off-screen and separate, and in code each row plainly differs. It only
exists at p=1.

**Do instead:** when several objects animate to a shared surface, write the
FINAL positions first and derive the entry offsets from them. And check a frame
after the move settles, not only during it.

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

### 12.5 Level-match by MEAN for sustained sounds, by peak for transients

Swapping the appearance switch's magnetic snap for a granular select: peak-matched
they would have been level, and the granular would have sat ~3 dB hot. A snap puts
nearly all its energy in one transient (magnetic: peak −4.5, mean −31.7 — a 27 dB
gap); a granular texture sustains (peak −1.0, mean −19.8 — 19 dB). Peak says they
are within 3.5 dB of each other; mean says the granular is 12 dB louder, and mean is
what you hear.

**Do instead:** match transients on peak, anything with a body on mean. Bake the
difference into the file so playback gains stay in one range across the pack.

### 12.6 One family of sound should not carry a whole section

The intro measured **−26.4 LUFS against the body's −26.9** — five seconds holding
more level than the following forty-five, off four swooshes and two taps. `whoosh.mp3`
is the hottest file in the pack (peak −2.1 dB, next loudest −4.5), so four of them
inside five seconds is not a design, it is one file's headroom leaking into the mix.

Cut per-cue, not in the file, when the same sample is used correctly elsewhere. And
note what the cut *promotes*: leaving the transients untouched while the wind drops
6 dB means the intro now arrives on the object landing rather than on air moving.

## 13a. Why the polished rebuild is worse than the crude original

`OneDesk` has everything the original 70s trailer lacks — a morph instead of a
cut, a tracked throw, rack focus, per-word catch-up, a live cursor, a designed
sound bed. It is still the weaker piece. Measured against `TafsirTrailer`:

| | original | OneDesk |
|---|---:|---:|
| product area of frame | **100%** | 39% |
| ink density INSIDE the product | 1.07% | 1.17% |
| ink pixels on screen | **22,108** | 9,527 |
| informational elements | **~294** | ~128 |
| dwell per screen | **10.0s** | 3.3s |

The surfaces are not sparse — internal density is identical, marginally higher
in the rebuild. They are **small**, and they are **brief**. Content × time, the
original delivers roughly **seven times** the information.

### The cause: a reference whose subject was a different kind of object

§1 says the app never fills the frame; it floats at a quarter to a half of frame
area with real stage around it. That was measured from iMessage, Mail, ClickUp
and Notion — reels whose subject is **a pill, a chip, a button**, holding one or
two words. Floating a two-word pill in dead space works because there is nothing
in it to read.

TafsirLab's subject is a page of Arabic with a translation and two scholars'
notes. It is a **reading tool**. At 39% of a 1080-wide frame its own text has to
shrink until the thing that proves the product exists — a linguistic note citing
Ibn Taymiyyah — no longer fits on screen at all.

**The rule to carry:** before importing a compositional constant from a
reference, check that the reference's SUBJECT is the same kind of object as
yours. Stage-to-object ratio is a function of how much the object has to say.
This is the Part I / Part III category error committed *inside* Part I.

### Two more, both structural rather than visual

**Caption and evidence must be simultaneous.** The original captions a frame
that already proves the claim: "Anchor notes directly to verses — linguistic,
thematic, or cross-references" sits under an actual linguistic note and an
actual thematic note, both with real content. The rebuild says "See how the
scholars read it" over four names and four dates. When the caption outruns what
is on screen the line stops being a description and becomes an advertisement.

**Continuity belongs to the SUBJECT, not the frame.** The rebuild's headline
achievement is one container with no cut in thirty seconds. But its *contents*
reset every beat — nine unrelated screens inside one rectangle. The original
cuts freely and still feels more continuous, because all seven scenes are the
same study page: same āyah, same workspace, same sidebar, progressively worked
on. It has narrative continuity without a single narrative caption.

A morph between two unrelated screens is a very smooth way of changing the
subject. Continuity of the container bought nothing because the thing the viewer
is actually tracking — the document — was replaced each time.

### 13d. "True to product" is about WHAT is shown, not HOW MUCH

The note on cut 1 was: *the effects are good, it does not feel true to product.*
I read that as a density problem, measured density, found the original trailer
carried 2.3x the ink, and spent three cuts chasing it — fill the frame, lengthen
the page, put a camera in it. Each cut fixed a real defect and none of them
fixed the reported one, because the report was never about quantity.

Cut 1's surfaces were rows with coloured dots, four bare command names, and
scholar name/date pairs. Every one of those could belong to any note app. What
makes a surface THIS product costs almost no pixels:

    verse keys              2:255 · AL-BAQARAH
    Arabic surah names      البقرة  beside Al-Baqarah, with its note count
    note-type labels        LINGUISTIC in amber, THEMATIC in green
    what a scholar SAID     not "Ibn Kathīr · 774 AH" but one line of his words
    the Connection marks    2:255 ↔ 3:2, tagged munāsabāt
    what a command DOES     "/ayah — Embed a verse", not "/ayah"

Same container, same sizes, same beats, same seventeen seconds. The reel became
product-true by replacing generic content with specific content, not by showing
more of it.

**The rule:** when a report names a QUALITY ("doesn't feel true to product",
"feels cheap", "looks unfinished"), resist converting it into the nearest
QUANTITY you know how to measure. Measurement is how you verify a hypothesis,
not how you form one. §13a's numbers were all correct and all beside the point.

### 13c. Neither float it nor squash it — put a camera in it

Three cuts swung between two wrong answers for showing a desktop-shaped product
in a 9:16 frame:

| | cut 2 | cut 3 | cut 4 |
|---|---|---|---|
| approach | float the app on a stage | fit the whole app to the frame | camera into the app |
| product area | 39% | 100% | 100% |
| vertical fill | — | **49%** | 100% |
| 20px body text renders at | small | **14px** | **34px** |
| mean ink | 0.47% | 1.24% | 2.24% |

Cut 3 was a correction of cut 2 that reproduced its defect in a new place.
"The original fills the frame" is a fact about a **landscape** piece whose
layout already matched its aspect ratio. Carried into portrait it means
scaling a 1500×1300 desktop layout down by 0.72 — which leaves half the frame
empty and renders body copy at 14px, unreadable on the device it is made for.

The answer is neither. Render the app at its own proportions and make the frame
a WINDOW onto it. At 1.7× the frame shows a 635×1129 column — one column of the
page, or the page and a note, or the drawer. Nothing is shrunk, the frame is
always full, and moving between regions is itself the motion.

**Enforce the bounds in code.** For the window to stay inside the app,
`x ∈ [W/2z, APPW−W/2z]` and `y ∈ [H/2z, APPH−H/2z]`. My first camera sat at
y=250 with z=1.72, which needs y≥558, so the top-left corner of every early
frame was bare stage. That is arithmetic, not taste — it belongs in a clamp,
not in an eye.

And the canvas has to hold as much content as the pan crosses. Raising APPH to
2100 without lengthening the page just moved the emptiness from the frame into
the app; the fix was more āyāt, not more canvas.

### 13b. Motion energy does not predict quality for a reading tool

Chasing dead-frame counts through three cuts of `OneDesk`, I finally measured
the thing I was trying to beat:

| | original (preferred) | cut 3 |
|---|---:|---:|
| dead frames | **76%** | 73% |
| longest freeze | **4.90s** | 3.12s |

The piece that reads better is **stiller than mine**. Every cycle spent making
the rebuild busier was spent on a metric that does not separate good from bad
in this genre — and I had already written §11.6 about exactly this failure.

The measure that DID separate them was density × dwell: ink on screen, and how
long it stays there. Cut 2 had 9,527 ink pixels at 3.3s per screen; the
original had 22,108 at 10.0s. Cut 3 reaches 1.24% mean ink against the
original's 1.07%, with the āyah on screen for thirty-five continuous seconds.

**The rule:** pick the metric from the failure mode, not from the toolbox.
"Feels dead" and "shows nothing" both look like low numbers, and motion energy
only answers the first. A reading tool holds still because the viewer is
reading; a slideshow holds still because there is nothing to look at. The
difference is on the screen, not in the derivative.

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

---

# Part III — Cut footage

**This part is not about animation.** Nothing above it was involved in making
`DosariReel`, and nothing in it applies to `SearchReel`, `LinkTrailer` or anything
else built frame by frame. It is kept in the same file because both are "the reel
work", not because the techniques are related.

The distinction that matters: in Parts I–II the material is infinite and taste is the
constraint — if a curve is wrong, change the curve. Here the material is fixed and
*it* is the constraint. He pauses for four and a half seconds whether or not that
suits the caption plan. The backdrop is white and the thawb is gold whether or not
cream text sits well on them. **The job is to find what the footage already does and
build to it.**

## 14. What transfers, and what does not

Carries across:

- **Measure the source before building** (§10). Same rule, opposite purpose — there it
  produces a target to hit, here it produces limits to respect.
- **A "feel" complaint is a measurable defect** (§11.1). "The captions don't line up"
  turned out to be an exact 4.5s hole, not a vibe.
- **A passing check is not evidence against a report** (§13).

Does **not** carry across, and assuming it does costs a render:

| Authored motion | Cut footage |
|---|---|
| Timing is chosen; put the beat where it reads best | Timing is dictated by when he actually speaks |
| Contrast is a colour choice — change the ground | Contrast must be *graded in*; the ground is a photograph |
| Frame rate is ours; 60fps for smoothness | Match the source. Resampling 30→60 invents frames on a face |
| Verify by tracking pixels against a reference | Verify with a level meter, a still, and a transcript |
| Errors are visible — a wrong curve looks wrong | **Errors are silent** — a wrong Arabic word renders beautifully |

That last row is the important one. In authored motion a mistake announces itself on
screen. In cut footage the most serious defects — a mistranscribed word, a doubled
audio track, a caption over silence — all produce output that *looks* completely
finished.

## 15. Caption timing comes from the source's silences

Whisper's segment boundaries are useless for captions. Segments run five to eight
seconds and are cut on the model's own convenience, so they **cannot see a pause**.

Measured in this clip: he stops speaking at **19.0s** and does not resume until
**23.56s**. A segment-timed caption sat on screen through all 4.56s of that, and every
card after it felt late — which is what was reported as "the captions don't line up".
It was not an offset. Adding a global delay would have made it worse.

`word_timestamps=True` makes the hole visible in one pass. Thirteen phrase-length
cards cut from word timings fixed it, with **no card at all** across the pause.

> **Rule.** Cut captions from word-level timings, never segment boundaries. Silence is
> content — find every gap over ~1s in the source and decide deliberately what is on
> screen during it. Usually the answer is nothing.

## 16. Legibility is a property of the picture, not the type

The source is a white backdrop and a brightly lit gold thawb. Cream captions on that
washed out, so the first attempt put a heavy `text-shadow` behind them. It did not
work, and it could not have: **a halo cannot supply contrast that the picture does not
have.** It only darkens the few pixels touching each glyph.

The captioned reference read cleanly because they had graded the whole image down —
which had looked like a stylistic choice until this failed. It is load-bearing.

What worked, in this order:

1. Grade the footage: `brightness(0.82) saturate(0.88) contrast(1.04)`
2. A scrim gradient over the bottom 460px only — `rgba(6,6,6,0)` → `0.78` — so his
   face keeps its exposure and only the caption zone goes dark
3. *Then* set the type, with a soft shadow as a finishing touch rather than the fix

> **Rule.** Fix the ground before setting the type. If text is hard to read on
> footage, the picture is the defect.

## 17. The transcript is a first draft, and its errors are silent

Model size here is a **correctness** question, not a quality one.

| Model | Output | Actual |
|---|---|---|
| `small` | "Come, we worship you and we ask you" | إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ |
| `small` | صورة ("picture") | سورة ("chapter") |
| `medium` | نستعيد ("we retrieve") | نستعين ("we ask for help") |

Every one of those renders as clean, confident, well-set Arabic. Nothing on screen
indicates a problem. For a reel about the Qurʾān, publishing the third one would have
been considerably worse than publishing no captions at all.

> **Rule.** Where the exact words matter, treat the transcript as a draft to be checked
> against text you already know. State plainly which lines were verified and which were
> reconstructed, and get the reconstructed ones heard by someone before publishing.

Outstanding in this reel: **16.6–19.1s** (`إلا لأجل تحقيق لا إله إلا الله`) is a
reconstruction — the model produced garbage there. Editable in
`reel-work/captions.json`.

## 18. Audio must be measured on the render

The rendered file and my arithmetic disagreed by about **25 dB**, and the gap was never
fully explained. Calculating stopped being useful; every level below was read off an
actual render.

Two false starts before it was right:

| Bed gain | Measured in his pause | Verdict |
|---|---|---|
| 0.006 | −62.9 dB | inaudible — might as well not be there |
| 0.20 | 1.6 dB under speech | fighting every word |
| **0.032** | **−43.2 dB** (~15 dB under) | audible in his pauses, never in the way |

Two things that made the measurement trustworthy:

- **Measure in the exposed window.** The bed was read across his 19.0–23.56s pause,
  where it plays alone. Measuring during speech tells you about the speech.
- **Measure the full render, not a probe.** A short probe render re-bases the audio
  timeline, so its levels are not the levels of the finished file. That produced one
  reading I acted on before noticing.

Final delivered: bed −43.2 dB in the pause, speech −29.7 dB, outro −23.4 LUFS.

## 19. Enumerate every node that can emit

`OffthreadVideo` plays the file's own audio track by default. The speech was *also*
mounted as a separate `<Audio>` so it could be ducked against the nasheed — so his
voice played twice, a few samples apart. That is not a doubling you hear as an error;
it reads as phasing, as though the room were wrong.

One second of listening would have caught it. It was found instead by listing every
component in the tree that could produce sound.

> **Rule.** When you cannot perceive the output, audit the graph rather than the
> result. Enumerate every node that can emit and account for each one. The `muted` on
> that `OffthreadVideo` is load-bearing — there is a comment on it saying so.

## 20. Verify the artefact's identity, not just its contents

The most dangerous failure of the whole reel. A render failed, which left the
**previous** file in place. The level check then ran happily and printed the old
numbers as if they were new. Everything looked correct and nothing was.

It was caught only because that particular failure also removed the output file. Had
the render failed *after* writing a partial file, the numbers would have been reported
as verified.

> **Rule.** A measurement of the wrong file is indistinguishable from a measurement of
> the right one. Delete the output before rendering, or check mtime/size before
> trusting anything read from it. Never chain a verification onto a render step without
> gating on the render's exit status.

## 21. "Too faint" was a hierarchy bug, not a brightness bug

The brand lockup was set in `MUTED` at `opacity: 0.62`. The shaykh's credit was set in
`MUTED` at full. So the brand rendered **fainter than the attribution** — the wrong
ranking, since the credit is an obligation and the mark is the reason the reel exists.

Raising the opacity would have treated the symptom. The fix was giving the lockup its
own token, `BRAND = #BAB4A8`, placed deliberately above `MUTED` and well below the
captions' `CREAM`.

> **Rule.** Assign tones by rank in the hierarchy. Taking one element's tone and dimming
> it produces an ordering you did not choose.

## 22. Two mechanical facts about the toolchain

**`No frame found at position N` is a partially-written cache file.** Remotion copies
the source into a temp assets dir and the compositor can start reading before the copy
completes. The tell is that N is small and round — 8192 here. It is intermittent, so it
"fixes itself" on retry and looks like a bad source file. Re-encoding does not help it.
`--concurrency=1` does, reliably. Clearing `%TEMP%/remotion-v*-assets*` clears a
genuinely corrupted one.

**Match the source frame rate.** This reel is 30fps because the lecture is. Resampling
a talking head to 60 invents intermediate frames on a face — the one subject where
interpolation artefacts are most visible — and buys nothing, since there is no authored
motion to smooth.

## 23. The pre-flight that would have saved three passes

Captions, grade, levels and branding were each fixed in a separate render cycle,
because each problem only became visible once the one in front of it was gone. Nothing
about them was actually sequential.

Before the first delivery of any cut, in one pass:

1. **Stills at every caption boundary** — catches timing drift and contrast together
2. **Every gap >1s in the word timings**, listed — catches captions over silence
3. **Levels in the exposed window** — bed alone, speech alone, outro
4. **One still of the full frame with no captions** — catches hierarchy problems in the
   furniture, which are invisible while you are looking at the text
5. **Every audio-emitting node in the tree**, listed and accounted for

Four of the five are text output and cost seconds. The renders are the expensive part,
and this is how you stop needing four of them.
