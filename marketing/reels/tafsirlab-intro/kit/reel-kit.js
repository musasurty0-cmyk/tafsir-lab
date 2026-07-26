/* ============================================================================
   reel-kit.js — motion language for TafsirLab marketing reels
   ----------------------------------------------------------------------------
   Canonical source: marketing/reels/shared/kit/  → synced into each reel by
   `node marketing/reels/shared/sync-kit.mjs`. Edit it HERE.

   Deterministic by contract (hyperframes-core): no clocks, no Math.random,
   no network, no input state. Everything is a pure function of scene time.

   ── Springs, in a renderer ────────────────────────────────────────────────
   apple-design's core claim is that springs win because they are
   interruptible and velocity-aware. A *rendered* video has no input to
   interrupt, so the honest translation is: keep the spring's CHARACTER
   (critically damped, no overshoot, motion that starts where the trigger is
   and settles rather than stops) and drop the runtime machinery.

   REEL_EASE below are curves fitted to Apple's damping/response pairs:
     damping 1.0 (no overshoot)  → EASE.settle / EASE.settleLong
     damping ~0.8 (momentum)     → EASE.momentum, used ONLY where a device is
                                   physically thrown into place. Never on text,
                                   and never on Qur'anic content.
   ========================================================================== */

/** Scene timing map — the single source of truth for the storyboard.
 *  Edit these to re-pace the reel; every scene reads its window from here. */
const T = {
  s1_question:  { start: 0.0,  dur: 2.5 },
  s2_mushaf:    { start: 2.5,  dur: 2.5 },
  s3_word:      { start: 5.0,  dur: 3.0 },
  s4_editor:    { start: 8.0,  dur: 3.0 },
  s5_tafsir:    { start: 11.0, dur: 3.0 },
  s6_together:  { start: 14.0, dur: 3.0 },
  s7_devices:   { start: 17.0, dur: 3.5 },
  s8_brand:     { start: 20.5, dur: 3.5 },
  total: 24,
};

/** Easing curves. GSAP's CustomEase is a paid plugin, so these are the
 *  closest stock equivalents to Apple's two spring presets. */
const EASE = {
  /** damping 1.0, response ~0.4 — the default. Decisive, then settles. */
  settle: "power3.out",
  /** damping 1.0, response ~0.6 — for larger surfaces travelling further. */
  settleLong: "expo.out",
  /** damping ~0.8 — a *whisper* of overshoot. Momentum-driven moves only. */
  momentum: "back.out(1.05)",
  /** Symmetric partner for reversible/exit motion (apple-design §7: enter and
   *  exit along the same path, mirrored curve). */
  exit: "power2.inOut",
  /** Long, calm camera push. */
  camera: "power1.inOut",
};

/* ============================================================================
   Primitives
   ========================================================================== */

/**
 * Word-by-word emergence. Each word rises out of its own masked line box, so
 * the sentence assembles like type being set rather than a block fading in.
 * Stagger is intentionally slow for Scene 1 (curiosity, not urgency).
 */
function revealWords(tl, selector, at, opts = {}) {
  const { stagger = 0.085, dur = 0.72, y = "108%", ease = EASE.settle } = opts;
  // NOTE: no opacity tween. `.w` is an overflow-hidden mask, so the word is
  // already invisible until it rises into the line box — fading it as well
  // would (a) muddy the type and (b) mean the text renders at partial contrast
  // for the whole reveal, which genuinely fails WCAG mid-animation. Sliding at
  // full opacity keeps every frame legible.
  tl.from(`${selector} .w > span`, {
    yPercent: parseFloat(y),
    duration: dur,
    ease,
    stagger,
  }, at);
  return tl;
}

/** Mirror of revealWords — same path, reversed (apple-design §7). */
function hideWords(tl, selector, at, opts = {}) {
  const { stagger = 0.03, dur = 0.42, ease = EASE.exit } = opts;
  tl.to(`${selector} .w > span`, {
    yPercent: -70, opacity: 0, duration: dur, ease, stagger,
  }, at);
  return tl;
}

/**
 * A surface materialising. Per apple-design §12, glass/blurred surfaces should
 * animate blur + scale together so they read as a real material arriving,
 * not a flat opacity fade.
 */
function materialize(tl, selector, at, opts = {}) {
  const { dur = 0.9, from = 0.94, blur = 22, ease = EASE.settleLong } = opts;
  // Opacity resolves FAST (0.28s) while scale+blur keep arriving — the surface
  // still reads as a material settling into place, but any text it carries hits
  // full contrast almost immediately instead of sitting semi-transparent for
  // the whole tween.
  tl.fromTo(selector, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: "power1.out" }, at);
  tl.fromTo(selector,
    { scale: from, filter: `blur(${blur}px)` },
    { scale: 1, filter: "blur(0px)", duration: dur, ease },
    at);
  return tl;
}

/**
 * Spatial origin reveal: the element grows from a point (its trigger), rather
 * than from its own centre. apple-design §7 — "anchor interactions to their
 * source"; §8 — intermediate motion should telegraph the outcome.
 * `origin` is a CSS transform-origin string, e.g. "50% 18%".
 */
function emergeFrom(tl, selector, at, origin, opts = {}) {
  const { dur = 1.15, from = 0.72, ease = EASE.settleLong } = opts;
  tl.set(selector, { transformOrigin: origin }, at);
  tl.fromTo(selector, { opacity: 0 }, { opacity: 1, duration: 0.3, ease: "power1.out" }, at);
  tl.fromTo(selector,
    { scale: from, filter: "blur(14px)" },
    { scale: 1, filter: "blur(0px)", duration: dur, ease },
    at);
  return tl;
}

/**
 * Camera push — a slow, continuous scale on a capture window. Legibility must
 * survive the move, so the magnitude stays small and the curve has no snap.
 */
function cameraPush(tl, selector, at, { dur = 2.4, from = 1.0, to = 1.06 } = {}) {
  tl.fromTo(selector, { scale: from }, { scale: to, duration: dur, ease: EASE.camera }, at);
  return tl;
}

/* ── ProductCapture crop maths ─────────────────────────────────────────────
   A crop is {sx, sy, scale} in the CAPTURE's own pixel space. GSAP composes
   `translate(x,y) … scale(s)`, and CSS applies that right-to-left, so with
   transform-origin 0 0 the capture point (sx,sy) maps to (s*sx + x, s*sy + y).
   Pinning it to the box origin therefore needs x = -s*sx, y = -s*sy.

   Helper: `crop(capW, boxW, region)` derives scale from the region width, so
   callers think in "show me this rectangle of the screenshot". */

function cropVars(c) {
  return { scale: c.scale, x: -c.scale * c.sx, y: -c.scale * c.sy };
}

/** Region → crop, given the box width the region must fill. */
function crop(boxW, region) {
  const scale = boxW / region.w;
  return { sx: region.x, sy: region.y, scale };
}

/** Set a capture's crop instantly (use for the scene's opening framing). */
function setCrop(tl, selector, at, c) {
  tl.set(selector, cropVars(c), at);
  return tl;
}

/**
 * Feature zoom — animate a ProductCapture's crop from one region to another
 * (wide shot → tight on a single word). This is the move that makes real
 * product UI legible at phone size instead of shrinking a 1440px desktop
 * screen into an unreadable postage stamp.
 */
function featureZoom(tl, selector, at, from, to, opts = {}) {
  const { dur = 1.5, ease = EASE.settleLong } = opts;
  tl.fromTo(selector, cropVars(from), { ...cropVars(to), duration: dur, ease }, at);
  return tl;
}

/**
 * A tap/press indicator. apple-design §1: feedback lives on the press and is
 * instant — so the ring fires on contact, and the target's response begins on
 * the SAME frame (§13 harmony), never after the tap finishes.
 */
function tap(tl, selector, at) {
  tl.fromTo(selector, { opacity: 0, scale: 0.6 },
    { opacity: 1, scale: 1, duration: 0.16, ease: EASE.settle }, at);
  tl.fromTo(`${selector} .tap__ring`, { opacity: 0.85, scale: 0.7 },
    { opacity: 0, scale: 1.9, duration: 0.62, ease: "power2.out" }, at);
  tl.to(selector, { opacity: 0, duration: 0.26, ease: EASE.exit }, at + 0.34);
  return tl;
}

/** Soft focus ring drawing attention to a real UI element. */
function spotlight(tl, selector, at, { dur = 0.7, hold = 1.0 } = {}) {
  tl.fromTo(selector, { opacity: 0, scale: 1.5 },
    { opacity: 1, scale: 1, duration: dur, ease: EASE.settleLong }, at);
  tl.to(selector, { opacity: 0, duration: 0.5, ease: EASE.exit }, at + dur + hold);
  return tl;
}

/**
 * Device reveal. This is the one place a little overshoot is right: the device
 * is a physical object being placed, and the gesture carries momentum
 * (apple-design §4 — bounce only when momentum preceded it).
 */
function revealDevice(tl, selector, at, opts = {}) {
  const { dur = 1.15, y = 90, from = 0.9, ease = EASE.momentum } = opts;
  // Deliberately NO blur filter here. A device frame wraps a very large
  // scaled bitmap (a 2880x1800 capture), and putting a filter on that subtree
  // makes the compositor rasterise the whole scaled layer — in headless
  // rendering it can silently fail to paint, so the device vanishes from the
  // frame even though the DOM says opacity:1. Opacity + y + scale is enough.
  tl.fromTo(selector,
    { opacity: 0, y, scale: from },
    { opacity: 1, y: 0, scale: 1, filter: "none", duration: dur, ease },
    at);
  return tl;
}

/**
 * Scene hand-off. Every scene transforms spatially into the next instead of
 * hard-cutting (apple-design §7). The outgoing surface recedes along the axis
 * the incoming one arrives on, so position and hierarchy stay continuous.
 */
function handOff(tl, outSel, at, { dur = 0.62, scale = 1.06, y = -40 } = {}) {
  tl.to(outSel, {
    opacity: 0, scale, y, filter: "blur(10px)",
    duration: dur, ease: EASE.exit,
  }, at);
  return tl;
}

/** Fade a large surface out during a big reposition and back in once settled
 *  (apple-design §14 — keeps large moving objects from strobing). */
function settleIn(tl, selector, at, { dur = 0.8 } = {}) {
  tl.fromTo(selector, { opacity: 0 }, { opacity: 1, duration: dur, ease: EASE.settle }, at);
  return tl;
}

/* Exported on window so composition HTML (and future reels) can use them
   without a bundler. */
window.ReelKit = {
  T, EASE,
  revealWords, hideWords, materialize, emergeFrom, cameraPush,
  crop, setCrop, featureZoom, cropVars,
  tap, spotlight, revealDevice, handOff, settleIn,
};
