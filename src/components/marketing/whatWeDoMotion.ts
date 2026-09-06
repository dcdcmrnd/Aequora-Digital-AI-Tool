export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Cosine ease, smoother at both ends than a linear ramp. */
function easeInOut(t: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
}

/**
 * A card's "prominence" (0 = idle/secondary, 1 = fully hero) as a function of overall scroll
 * progress. Ramps up approaching `center`, holds at 1 for a short plateau, ramps back down --
 * three of these overlapping slightly is what makes the hero handoff between cards continuous
 * instead of an abrupt cut.
 */
export function prominence(progress: number, center: number, plateau: number, falloff: number): number {
  const distance = Math.abs(progress - center);
  if (distance <= plateau) return 1;
  if (distance >= plateau + falloff) return 0;
  return easeInOut(1 - (distance - plateau) / falloff);
}

export interface IdleOffset {
  xFrac: number;
  yFrac: number;
  rotate: number;
}

// Fractions of viewport width/height -- resolved to px against the current viewport so the
// asymmetric spread scales naturally with window size instead of needing per-breakpoint tuning.
export const IDLE_DESKTOP: IdleOffset[] = [
  { xFrac: -0.17, yFrac: 0.11, rotate: -4 }, // 01: left / lower
  { xFrac: 0.15, yFrac: 0.15, rotate: 4 }, // 02: right / lower
  { xFrac: 0.21, yFrac: -0.17, rotate: -3 }, // 03: further upper / right
];

export const IDLE_MOBILE: IdleOffset[] = [
  { xFrac: 0, yFrac: -0.19, rotate: -2 },
  { xFrac: 0.05, yFrac: 0.01, rotate: 1.5 },
  { xFrac: -0.03, yFrac: 0.2, rotate: -1.5 },
];

export const HERO_CENTERS = [0.2, 0.5, 0.8];
export const PLATEAU = 0.05;
export const FALLOFF = 0.12;

export const HERO_SCALE_DESKTOP = 1.42;
export const HERO_SCALE_MOBILE = 1.16;
