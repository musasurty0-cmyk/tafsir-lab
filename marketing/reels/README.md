# TafsirLab — marketing reels

Code-driven social video, built with **HyperFrames** (renders video from HTML +
a seekable GSAP timeline). Reproducible, renderable locally, editable
scene-by-scene, exportable to MP4.

```
marketing/reels/
  shared/
    kit/
      reel-kit.css        # design system: type, materials, DeviceFrame, ProductCapture
      reel-kit.js         # motion library: springs, MotionText, feature zoom, transitions
    capture-product.mjs   # drives real Chrome → real screenshots of the running app
    sync-kit.mjs          # copies shared/kit into each reel project
  tafsirlab-intro/        # ← the reel (a HyperFrames project)
    index.html            # composition: 8 scenes + the one paused timeline
    kit/                  # synced copy of shared/kit (do not edit here)
    assets/capture/       # real product screenshots + manifest.json
    snapshots/            # QA still frames + contact sheet
    renders/              # MP4 output
    STORYBOARD.md         # shot inventory, copy, claim audit, motion rules
```

**Why the kit is duplicated into `<project>/kit/`:** HyperFrames serves each reel
project as its own web root, so a composition cannot reference `../shared/...`.
`shared/kit/` is the single source of truth; `sync-kit.mjs` copies it in. Same
pattern as `scripts/copy-mupdf-wasm.mjs` in the main app. **Edit
`shared/kit/`, never `<project>/kit/`.**

---

## Preview

```bash
cd marketing/reels/tafsirlab-intro && npm run dev
```

Long-running server — opens HyperFrames Studio, where the timeline and every
element are editable live.

## Check (always, before rendering)

```bash
cd marketing/reels/tafsirlab-intro && npm run check
```

Runs lint + runtime + layout + motion + WCAG contrast in one pass. Current
status: **0 errors, contrast 39/39 AA**, 2 accepted lint warnings (see below).

## Render

```bash
cd marketing/reels/tafsirlab-intro && npx hyperframes render --quality high --output renders/tafsirlab-intro.mp4
```

Output: `marketing/reels/tafsirlab-intro/renders/tafsirlab-intro.mp4`
(1080×1920, 30 fps, 24.0 s, ~5.1 MB, 720 frames).

## Still frames for QA

```bash
cd marketing/reels/tafsirlab-intro && npx hyperframes snapshot --at 1.4,3.9,6.6,9.6,12.2,15.6,19.4,22.6
```

Writes `snapshots/` plus a `contact-sheet.jpg` grid.

---

## Re-capturing product footage

The reel never uses mockups. To refresh the screenshots after a UI change:

```bash
# 1. start the app (a real dev server, not the reel's)
npm run dev                     # in the repo root, port 3000

# 2. capture — seeds a demo workspace via the real API, then screenshots
node marketing/reels/shared/capture-product.mjs --base http://localhost:3000
```

It signs in with demo mode, creates a workspace + surah + study page, seeds
realistic word/ayah notes, then captures at `deviceScaleFactor` 2–3 so UI text
survives being scaled into a device frame. It also suppresses the Next.js dev
overlay, the "Offline" sync pill, caret blink, and animations, so no debug
chrome or loading flash reaches a capture.

Set `CHROME_PATH` if Chrome is not at the default Windows location.

### Swapping product footage in a scene

Each scene points at one capture and a **crop region in that capture's own
pixels**. In `index.html`:

```js
const MUSHAF_PAGE = { x: 1174, y: 331, w: 1188 };  // region of the screenshot
...
K.setCrop(tl, "#s2-crop", 2.4, K.crop(888, MUSHAF_PAGE));  // 888 = box width
```

`crop(boxWidth, region)` derives the scale, so you think in "show me this
rectangle". This is what keeps real UI legible on a phone instead of shrinking a
1440 px desktop screen into an unreadable stamp. To retarget a scene: change the
`<img src>` and its region constant. **Never** animate the `<img>` itself —
`media.autoProxy` rewrites media elements, which silently detaches a GSAP tween;
always animate the `.pc__inner` wrapper (`#sN-crop`).

---

## Making a new reel

```bash
npx hyperframes init "marketing/reels/<name>" --non-interactive --example=blank
node marketing/reels/shared/sync-kit.mjs
```

Then in the new `index.html`: link `kit/reel-kit.css` + `kit/reel-kit.js`, set
`data-width="1080" data-height="1920"`, and build scenes from the primitives.

### Reusable primitives (`kit/reel-kit.js`)

| Primitive | Use for |
|---|---|
| `revealWords` / `hideWords` | animated headline — word-by-word, masked, symmetric exit |
| `materialize` | a surface arriving (blur + scale, fast opacity) |
| `emergeFrom` | origin-anchored reveal — grows from its trigger |
| `crop` / `setCrop` / `featureZoom` | screen-recording mask + feature zoom |
| `cameraPush` | slow legible push-in |
| `tap` / `spotlight` | cursor / tap indicator, focus ring |
| `revealDevice` | device reveal with momentum |
| `handOff` / `settleIn` | brand/scene transition |
| `T` | scene timing map — the single place to re-pace the reel |

### What to change for a variant

| Want to change | Where |
|---|---|
| headline / any copy | the scene's markup in `index.html` |
| scene order or duration | `data-start` / `data-duration` on the scene clip **and** its tween times |
| overall pacing | `ReelKit.T` in `shared/kit/reel-kit.js`, then re-sync |
| product footage | `<img src>` + the scene's crop region constant |
| CTA | Scene 8 markup |
| colours / type | tokens at the top of `shared/kit/reel-kit.css` |
| audio | add `<audio>` as a **direct child of the composition root** (framework owns playback) |

---

## Audio

The reel is **silent by design** and is built to work muted-first: every claim
is on-screen text, so it reads with sound off (how most Reels are watched).

If audio is added later: keep it to restrained interface ticks and a soft
cinematic rise, mixed low. **Do not** use Qur'anic recitation as decorative
background, and never cut recitation into beat-synced fragments. `<audio>` must
be a direct child of the composition root — the framework owns playback and
seeking.

---

## Accepted lint warnings

Both are deliberate and safe:

1. **`duplicate_media_discovery_risk`** — `mushaf-desktop.png` is intentionally
   reused by Scenes 2, 3 and 7. Every `<img>` has a unique `id`, which is the
   actual failure mode the rule guards against (duplicate ids render blank).
2. **`composition_file_too_large`** — one file keeps all eight scenes and their
   timing readable in a single diff. Split into `compositions/` sub-comps if the
   reel grows.

## Known limitations

- **No Arabic text is set in HTML.** The renderer has no deterministic Arabic
  font mapping, so live Arabic would fall back to tofu boxes. All Arabic in the
  reel comes from real app captures (correct and crisp, typeset by the app's own
  QCF renderer); the note card uses scholarly transliteration.
- **No blur filters on device frames.** A filter over a large scaled bitmap can
  silently fail to rasterise headless — the devices vanished from the frame
  while the DOM still reported `opacity: 1`. Device reveals use opacity + y +
  scale only.
- Scenes 3, 4 and 6 compose real captures with **kit-drawn overlays** (the word
  note, the `/ayah` chip, collaborator avatars) rather than screenshotting those
  exact UI states. The overlays restate real product behaviour and real seeded
  note text, but they are reel furniture, not pixel-exact app UI.
- No sound design, no captions track, and no `--describe` vision QA
  (`GEMINI_API_KEY` unset).
