/**
 * Reanimated equivalents of the motion tokens. Every value comes from @team-impact/ui-tokens, so
 * the portal (Motion) and the app (Reanimated) stay in step.
 */
import { Easing } from 'react-native-reanimated';
import { duration, easing, spring } from '@team-impact/ui-tokens';

type Bezier = readonly [number, number, number, number];
const bezier = ([a, b, c, d]: Bezier) => Easing.bezier(a, b, c, d);

export const ease = {
  standard: bezier(easing.standard),
  spring: bezier(easing.spring),
  cardDeal: bezier(easing.cardDeal),
};

/** Ready-made `withTiming` configs. */
export const timing = {
  tap: { duration: duration.tap, easing: ease.standard },
  small: { duration: duration.small, easing: ease.standard },
  screen: { duration: duration.screen, easing: ease.standard },
  cardReveal: { duration: duration.cardReveal, easing: ease.cardDeal },
  stamp: { duration: duration.stamp, easing: ease.spring },
} as const;

/** `withSpring` config for earned moments: a short overshoot. */
export const springConfig = { ...spring };
