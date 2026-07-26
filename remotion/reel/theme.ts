/**
 * theme.ts — TafsirLab reel design tokens + the camera system.
 *
 * The trailer is ONE white room with ONE camera. Everything (type, the Mushaf,
 * notes, tafsir, chrome, devices) lives at fixed world coordinates; only the
 * camera travels. That makes a "slideshow" structurally impossible — there is
 * no cut to make and no per-scene background to swap.
 */
import { interpolate, Easing } from "remotion";

export const FPS = 30;
export const DURATION = 750; // 25.0s
export const W = 1080;
export const H = 1920;

/** seconds → frames */
export const s = (sec: number) => Math.round(sec * FPS);

export const C = {
  white: "#FFFFFF",
  ink: "#0A0A0A",
  ink2: "#3A3A3A",
  grey: "#8A8A8A",
  grey2: "#B4B0AA",
  hair: "#EDEDED",
  hair2: "#E2E0DC",
  paper: "#FFFFFF",
  /** the ONLY saturated colours, and only inside real note UI */
  amber: "#F7E7A6",
  amberInk: "#8A6D1F",
  green: "#4F9A7A",
  blue: "#6F8FCF",
  shadowSoft: "0 24px 80px rgba(10,10,10,0.06), 0 4px 16px rgba(10,10,10,0.04)",
  shadowLift: "0 40px 120px rgba(10,10,10,0.10), 0 8px 28px rgba(10,10,10,0.06)",
};

export const FONT = {
  sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  ar: '"Amiri", "Scheherazade New", serif',
  hand: '"Caveat", "Segoe Script", cursive',
};

/* ── Camera ────────────────────────────────────────────────────────────────
   A keyframe is a pose of the room: which world point sits at screen centre
   (x,y), how close we are (scale), and a very small amount of 3D attitude
   (rx/ry/rz) — the Vision-Pro-style drift that keeps a long move from feeling
   like a flat zoom. Angles stay tiny on purpose; anything larger reads as a
   gimmick rather than a camera.                                            */

export interface Pose {
  f: number;      // frame
  x: number;      // world x at screen centre
  y: number;      // world y at screen centre
  scale: number;
  rx?: number;    // deg
  ry?: number;
  rz?: number;
  /** easing into this pose */
  ease?: (t: number) => number;
}

const EASE_CINE = Easing.bezier(0.33, 0.0, 0.15, 1.0);   // long, confident settle
export const EASE_SOFT = Easing.bezier(0.4, 0.0, 0.2, 1.0);
export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);   // expo-ish out

export interface CamState { x: number; y: number; scale: number; rx: number; ry: number; rz: number }

/** Sample the camera path at `frame`. */
export function cameraAt(path: Pose[], frame: number): CamState {
  const last = path[path.length - 1];
  if (frame <= path[0].f) return pose(path[0]);
  if (frame >= last.f) return pose(last);
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    if (frame >= a.f && frame <= b.f) {
      const e = b.ease ?? EASE_CINE;
      const t = (v: number, w: number) =>
        interpolate(frame, [a.f, b.f], [v, w], {
          easing: e, extrapolateLeft: "clamp", extrapolateRight: "clamp",
        });
      return {
        x: t(a.x, b.x), y: t(a.y, b.y), scale: t(a.scale, b.scale),
        rx: t(a.rx ?? 0, b.rx ?? 0), ry: t(a.ry ?? 0, b.ry ?? 0), rz: t(a.rz ?? 0, b.rz ?? 0),
      };
    }
  }
  return pose(last);
}

const pose = (p: Pose): CamState => ({
  x: p.x, y: p.y, scale: p.scale, rx: p.rx ?? 0, ry: p.ry ?? 0, rz: p.rz ?? 0,
});

/** The CSS transform that puts world point (cam.x, cam.y) at screen centre. */
export function camTransform(cam: CamState): string {
  return [
    `translate(${W / 2}px, ${H / 2}px)`,
    `rotateX(${cam.rx}deg)`,
    `rotateY(${cam.ry}deg)`,
    `rotateZ(${cam.rz}deg)`,
    `scale(${cam.scale})`,
    `translate(${-cam.x}px, ${-cam.y}px)`,
  ].join(" ");
}

/* ── Small helpers ─────────────────────────────────────────────────────── */

/** 0→1 ramp with easing, clamped. */
export const ramp = (
  frame: number, from: number, to: number, easing = EASE_OUT,
) => interpolate(frame, [from, to], [0, 1], {
  easing, extrapolateLeft: "clamp", extrapolateRight: "clamp",
});

/** fade in then out */
export const pulse = (
  frame: number, inA: number, inB: number, outA: number, outB: number,
) => Math.min(ramp(frame, inA, inB), 1 - ramp(frame, outA, outB));
