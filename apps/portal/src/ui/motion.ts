/**
 * Motion (motion.dev) equivalents of the motion tokens. Durations convert from ms to seconds;
 * everything else is passed through from @team-impact/ui-tokens.
 */
import { duration, easing, spring } from '@team-impact/ui-tokens';

type Bezier = [number, number, number, number];
const bezier = (b: readonly number[]) => [...b] as Bezier;
const seconds = (ms: number) => ms / 1000;

export const ease = {
  standard: bezier(easing.standard),
  spring: bezier(easing.spring),
  cardDeal: bezier(easing.cardDeal),
};

/** Ready-made `transition` props. */
export const transition = {
  tap: { duration: seconds(duration.tap), ease: ease.standard },
  small: { duration: seconds(duration.small), ease: ease.standard },
  screen: { duration: seconds(duration.screen), ease: ease.standard },
  cardReveal: { duration: seconds(duration.cardReveal), ease: ease.cardDeal },
  stamp: { duration: seconds(duration.stamp), ease: ease.spring },
} as const;

/** Spring for earned moments: a short overshoot. */
export const springTransition = { type: 'spring', ...spring } as const;
