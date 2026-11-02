/**
 * Motion maths for the card's tilt, holo shine, spring-back and deal-in (TI-114), shared by both
 * renderers. Written from scratch for this project (no third-party tilt or holo code). The
 * 'worklet' directives let Reanimated run these on the UI thread; elsewhere they're inert.
 */

export interface TiltPose {
  /** Degrees around the horizontal axis: positive tips the top edge away from the viewer. */
  rotateX: number;
  /** Degrees around the vertical axis: positive turns the right edge away from the viewer. */
  rotateY: number;
  /** Where the shine's hotspot sits, as fractions of the card (0..1, left/top to right/bottom). */
  shineX: number;
  shineY: number;
}

/** At rest: flat, shine centred. */
export const FLAT_POSE: TiltPose = { rotateX: 0, rotateY: 0, shineX: 0.5, shineY: 0.5 };

const clamp01 = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

/**
 * Tilt toward a pointer or finger at (`x`, `y`) inside a `width` × `height` card. The card leans
 * so the touched point sinks away from the viewer (like pressing a corner), reaching `maxDegrees`
 * at the edges and never more, even for points outside the card. The shine follows the point.
 */
export const tiltFromPoint = (
  x: number,
  y: number,
  width: number,
  height: number,
  maxDegrees: number,
): TiltPose => {
  'worklet';
  const nx = width > 0 ? clamp01(x / width) : 0.5;
  const ny = height > 0 ? clamp01(y / height) : 0.5;
  // `+ 0` turns -0 into 0 so the centre reads as exactly flat.
  return {
    rotateX: (0.5 - ny) * 2 * maxDegrees + 0,
    rotateY: (nx - 0.5) * 2 * maxDegrees + 0,
    shineX: nx,
    shineY: ny,
  };
};

/** Linear interpolation, `t` = 0 gives `from`, 1 gives `to`. */
export const mix = (from: number, to: number, t: number) => {
  'worklet';
  return from + (to - from) * t;
};

export interface SpringParams {
  stiffness: number;
  damping: number;
  mass: number;
}

export interface SpringCurve {
  /** Progress samples from 0 to 1 at even time steps; values above 1 are the overshoot. */
  points: number[];
  /** Time until the spring has settled, ms. */
  durationMs: number;
}

/**
 * Samples a damped spring released from rest at 0 toward 1, so the web can spring back with a
 * CSS `linear()` easing that matches Reanimated's `withSpring` on the same token values.
 */
export const springCurve = (
  { stiffness, damping, mass }: SpringParams,
  samples = 40,
  tolerance = 0.005,
): SpringCurve => {
  const dt = 1 / 1000;
  const trace: number[] = [];
  let x = 0;
  let v = 0;
  let settledAt = -1;
  // Semi-implicit Euler at 1 ms. Settled = position and speed stay inside the tolerance for
  // 50 ms; the curve ends where that started (5 s at most, whatever the parameters).
  for (let t = 0; t < 5000; t++) {
    trace.push(x);
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * dt;
    x += v * dt;
    const inside = Math.abs(x - 1) < tolerance && Math.abs(v) < tolerance * 10;
    if (!inside) settledAt = -1;
    else if (settledAt < 0) settledAt = t + 1;
    else if (t + 1 - settledAt >= 50) break;
  }
  const end = settledAt > 0 ? settledAt : trace.length - 1;
  const points = Array.from({ length: samples + 1 }, (_, i) => {
    if (i === samples) return 1;
    const value = trace[Math.round((i / samples) * end)] ?? 1;
    return Math.round(value * 1000) / 1000;
  });
  return { points, durationMs: end };
};

/** `linear(...)` timing function for CSS transitions and the Web Animations API. */
export const cssLinearEasing = (curve: SpringCurve) => `linear(${curve.points.join(', ')})`;

export interface DealPose {
  opacity: number;
  translateY: number;
  rotate: number;
  scale: number;
}

export const DEALT: DealPose = { opacity: 1, translateY: 0, rotate: 0, scale: 1 };

/**
 * Where the card-reveal ("deal") starts: dropped in from below, slightly turned and small. Reduce
 * Motion keeps only the fade, so nothing moves.
 */
export const dealStart = (
  deal: { offsetY: number; rotate: number; scale: number },
  reduceMotion: boolean,
): DealPose =>
  reduceMotion
    ? { ...DEALT, opacity: 0 }
    : { opacity: 0, translateY: deal.offsetY, rotate: deal.rotate, scale: deal.scale };
