/**
 * Motion tokens. One source for CSS, Motion (motion.dev) and Reanimated: durations are ms,
 * cubic-beziers are [x1, y1, x2, y2], spring values are plain numbers.
 */
export const duration = {
  tap: 120,
  small: 200,
  screen: 320,
  cardReveal: 600,
  stamp: 520,
} as const;

export const easing = {
  standard: [0.2, 0, 0, 1],
  /** Earned moments: signed stamp, QR join, RSVP. */
  spring: [0.2, 0.8, 0.2, 1],
  cardDeal: [0.16, 1, 0.3, 1],
} as const;

/**
 * Physical spring for earned moments: damping ratio ~0.63, so roughly 7% overshoot and settled in
 * about 350ms. `withSpring` takes these directly; Motion takes them as `{ type: 'spring', ... }`.
 */
export const spring = {
  stiffness: 300,
  damping: 22,
  mass: 1,
} as const;

export const tilt = {
  /** Baseball Card maximum tilt, degrees. Disabled under reduced motion. */
  maxDegrees: 9,
} as const;

export const motion = { duration, easing, spring, tilt } as const;
export type Motion = typeof motion;
