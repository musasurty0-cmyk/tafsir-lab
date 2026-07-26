# TafsirLab — Intro Reel · Storyboard

**Format** 1080×1920 (9:16) · 30 fps · 24.0 s · silent-first (no VO, no BGM)
**Render** `renders/tafsirlab-intro.mp4`

Every product image is a **real screenshot of the running app**, captured by
`../shared/capture-product.mjs` (demo session → seeded workspace → real API).
Nothing is a mockup or a redraw.

---

## Shot inventory

| # | Time | Product screen shown | Feature demonstrated | Why it belongs | Device frame |
|---|------|----------------------|----------------------|----------------|--------------|
| 1 | 0.0–2.5 | — (type only) | — | The hook. Curiosity before product; no logo, no UI. | none |
| 2 | 2.5–5.0 | `mushaf-desktop.png` — Canvas mode, Al-Baqarah 1–5 | Real QCF Mushaf page; a word already carries the app's own highlight | Establishes that this is a genuine Mushaf, not a text list | full-bleed page card |
| 3 | 5.0–8.0 | same capture, zoomed to the word `الْكِتَٰبُ` | Word-level note space + handwriting, **without leaving the page** | The core differentiator | full-bleed page card |
| 4 | 8.0–11.0 | `editor-desktop.png` — real typed notes | OneNote-style freeform editor, movable container, `/ayah` embed | Shows structure is the user's, not imposed | full-bleed card |
| 5 | 11.0–14.0 | `split-desktop.png` — Mushaf + notes | Tafsir sources: Ibn Kathīr (EN), Maʿārif al-Qurʾān (EN), Al-Saʿdī (AR) | Proves the Arabic **and** English claim | full-bleed card |
| 6 | 14.0–17.0 | `workspace-home-desktop.png` — surah grid | Group workspace, members, a collaborator's note | Private *and* shared study | full-bleed card |
| 7 | 17.0–20.5 | `mushaf-desktop` + `-tablet` + `-mobile` | Same study context across devices | Availability, with correct hierarchy | laptop + tablet + phone |
| 8 | 20.5–24.0 | — (brand) | — | Resolve + CTA, held ~1.7 s to read | none |

### Device hierarchy (Scene 7)

Deliberate, and encoded in both size and z-order:

1. **Laptop** — 960 px wide, centre, hero. Full workspace.
2. **Tablet** — 500 px, foreground-left. The strongest annotation surface.
3. **Phone** — 240 px, smallest, offset right. *Access and review.*

The phone is never the hero. The qualifier reads **“Best experienced on desktop
and tablet.”** — phrased positively; the reel never says mobile is unsupported.

---

## Copy

| Scene | On screen |
|---|---|
| 1 | Have you ever wanted to study the Qur’an… |
| 2 | Study every word. |
| 3 | Write. Draw. Reflect. |
| 4 | Your study. Your structure. |
| 5 | Explore tafsir in Arabic and English. |
| 6 | Study alone. Or together. |
| 7 | Available across your devices. / Best experienced on desktop and tablet. |
| 8 | TafsirLab · Go deeper with every ayah. · **Open the lab — free** · tafsirlab.com |

### Claim audit

- **“tafsir in Arabic and English”** — verified against
  `lib/services/tafsir.service.ts`: Ibn Kathīr (en), Maʿārif al-Qurʾān (en),
  Al-Saʿdī (ar). Truthful.
- **CTA** — the product has **no waitlist**, and the live landing page offers
  “Open the lab — free →”. A “Join the waitlist” CTA would lead nowhere, so the
  reel uses the real, working CTA.
- No testimonials, no usage statistics, no invented screens.

---

## Motion language

Curves are fitted to Apple's damping/response pairs (`apple-design` §4):

| Purpose | Curve | Apple equivalent |
|---|---|---|
| Default UI move | `power3.out` | damping 1.0, response ~0.4 |
| Large surface | `expo.out` | damping 1.0, response ~0.6 |
| Device placement | `back.out(1.05)` | damping ~0.8 — momentum only |
| Reversible exit | `power2.inOut` | mirrored path (§7) |

Applied rules:

- **§7 spatial consistency** — Scene 2's Mushaf grows from the *same screen
  position* the question's text occupied (`transform-origin: 50% 22%`); Scene 3
  stays on that page and zooms rather than cutting; Scene 7's devices collapse
  toward the point Scene 8's brand mark arrives at.
- **§1 response / §13 harmony** — the word note in Scene 3 begins materialising
  on the **same frame** as the tap indicator, never after it.
- **§4 bounce discipline** — overshoot appears *only* on device placement.
  Never on text, and never on Qur'anic content.
- **§15 typography** — tracking is size-specific: display type at `-0.032em`,
  body near `0`, all-caps micro-type at `+0.14em`.
- **§12 materials** — note cards are translucent so the Mushaf stays visible
  underneath; opacity resolves in 0.28 s while blur/scale keep arriving, so text
  never sits at partial contrast.
- **§14 reduced motion** — `prefers-reduced-motion`, `prefers-reduced-transparency`
  and `prefers-contrast` are all handled in `kit/reel-kit.css`. They do not
  affect the MP4 (a render has no user preference) but make the kit safe to
  embed as live HTML.

### On interruptibility

`apple-design`'s central claim is that springs win because they are
**interruptible and velocity-aware**. A rendered video has no input to
interrupt, so that machinery cannot literally apply. What carries over is the
*character*: critically-damped settling, motion originating at its trigger, and
symmetric enter/exit paths. The kit primitives are written to be reused in
interactive contexts, where a real spring library should replace these curves.

---

## Instagram safe zones

Tokens in `kit/reel-kit.css`; key content stays inside them.

- top **300 px** — account / audio row
- bottom **470 px** — caption + like/comment/share stack
- sides **96 px**, right **190 px** — action rail

All headlines sit between y≈400 and y≈1500. The CTA lands at y≈1200, clear of
the caption band. Verified in `snapshots/`.
