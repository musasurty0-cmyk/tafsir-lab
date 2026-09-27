/**
 * lib/glide — momentum for a panned canvas.
 *
 * Before this, lifting your finger stopped the Mushaf dead. That is the one
 * moment an interface most obviously stops feeling physical: nothing in the
 * world you throw comes to rest the instant you let go of it. Panning is the
 * gesture this app is used with most, so it is the one worth getting right.
 *
 * The model is deceleration, not a spring. A spring needs somewhere to land,
 * and these canvases are unbounded — there is no snap point to aim at, only a
 * throw that should run out. So velocity decays exponentially at the same rate
 * a scroll view uses, and the distance travelled is whatever the throw earned.
 *
 * Three things make it feel like a throw rather than an animation:
 *
 *   1. It starts at EXACTLY the release velocity, so there is no seam between
 *      dragging and gliding.
 *   2. Velocity is measured over the last ~80 ms, not the whole drag. What the
 *      hand was doing at the end is the intent; a long slow drag that ends in a
 *      flick should fly, and a fast drag that stops before release should not.
 *   3. It is interruptible. Every frame reads the CURRENT viewport and writes a
 *      delta, so grabbing the canvas mid-glide continues from wherever it has
 *      actually got to — no jump, no waiting for it to finish.
 */

/** One pointer sample. `t` is a `performance.now()` timestamp. */
export interface Sample { x: number; y: number; t: number }

/** Velocity is read from this much of the recent past, in ms. */
const WINDOW_MS = 80;

/** Below this (px/ms) a release is a stop, not a throw. 60 px/s. */
export const FLICK_MIN = 0.06;

/** Per-millisecond velocity decay. The rate a scroll view uses. */
const DECAY = 0.998;

/** Frames can be long after a stall; integrating one as-is would teleport. */
const MAX_FRAME_MS = 32;

/** Keep `history` to the last WINDOW_MS, newest last. */
export function pushSample(history: Sample[], s: Sample): void {
  history.push(s);
  while (history.length > 2 && s.t - history[0].t > WINDOW_MS) history.shift();
}

/**
 * Velocity across the sample window, in px/ms.
 *
 * Taken from the oldest sample still inside the window to the newest, rather
 * than from the last pair: a single pair is one frame of noise, and on a
 * trackpad that noise is most of the signal.
 */
export function velocityOf(history: Sample[]): { vx: number; vy: number } {
  if (history.length < 2) return { vx: 0, vy: 0 };
  const a = history[0];
  const b = history[history.length - 1];
  const dt = b.t - a.t;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
}

/**
 * How far a throw at `v` px/ms travels before it runs out.
 *
 * Exponential decay integrated to infinity: v * dt summed over v *= DECAY^dt,
 * which closes to v / (1 - DECAY) per ms. Useful on its own for deciding what
 * a flick would reach — projecting the landing point BEFORE choosing a target
 * is how a flick gets to feel like it throws a thing rather than nudging it.
 */
export function project(v: number): number {
  return v / (1 - DECAY);
}

export interface Glide {
  /** Throw the canvas at `vx`/`vy` px/ms. Replaces any glide in flight. */
  start(vx: number, vy: number): void;
  /** Stop now. Call on any new touch, so a glide can always be grabbed. */
  stop(): void;
  /** Is a glide running? */
  readonly running: boolean;
}

/**
 * Build a glide that hands each frame's movement to `commit` as a DELTA.
 *
 * A delta, not a position, is what makes it interruptible: the caller adds it
 * to whatever the viewport currently is, so nothing here holds a stale copy of
 * a value the user may have moved in the meantime.
 */
export function createGlide(commit: (dx: number, dy: number) => void): Glide {
  let raf = 0;
  let vx = 0, vy = 0;
  let last = 0;

  function step(now: number) {
    const dt = Math.min(MAX_FRAME_MS, now - last);
    last = now;

    const k = Math.pow(DECAY, dt);
    vx *= k;
    vy *= k;

    if (Math.hypot(vx, vy) < 0.015) { raf = 0; return; }   // 15 px/s: done
    commit(vx * dt, vy * dt);
    raf = requestAnimationFrame(step);
  }

  return {
    get running() { return raf !== 0; },
    stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      vx = vy = 0;
    },
    start(ivx, ivy) {
      this.stop();
      if (Math.hypot(ivx, ivy) < FLICK_MIN) return;
      vx = ivx; vy = ivy;
      last = performance.now();
      raf = requestAnimationFrame(step);
    },
  };
}
