/**
 * Team Impact motion vocabulary.
 *
 * Timing values come from the Figma motion specification.
 */
export const duration = {
  instant: 0,
  fast: 120,
  base: 200,
  slow: 320,
  emphasis: 480,
} as const;

export const easing = {
  standard: [0.2, 0, 0, 1],
  enter: [0, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const motion = {
  duration,
  easing,
} as const;

export type Motion = typeof motion;
