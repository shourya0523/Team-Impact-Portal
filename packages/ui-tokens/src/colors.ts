/**
 * Signing Day colour tokens (TI-72). Plain hex only, so they work on native, React Native Web and CSS.
 */

/** Team IMPACT logo colours. Navy is brand and selection; red is main actions. Change them here only. */
const NAVY = '#1E3F7B';
const NAVY_PRESSED = '#15305F';
const RED = '#EA2642';
/**
 * Red for filled actions, nudged darker than the logo red: white on #EA2642 is 4.33:1, which fails
 * AA for button labels. This is 4.59:1. Use `red` itself only for decoration and the logo.
 */
const ACTION = '#E3233F';
const ACTION_PRESSED = '#B01A2D';

export const colors = {
  ground: '#F6F4EF',
  surface: '#FFFFFF',
  ink: '#111418',
  text: {
    secondary: '#4A4F57',
    muted: '#5C616A',
  },
  line: '#DDD8CD',
  /** Navy: brand, links, focus rings, selection. */
  brand: NAVY,
  brandPressed: NAVY_PRESSED,
  /** Logo red, exact. Decorative only (fails AA with white text). */
  red: RED,
  /** Main actions (primary buttons). */
  action: ACTION,
  actionPressed: ACTION_PRESSED,
  /** Default team colour. Real values are supplied per team at runtime, see `team.ts`. */
  team: NAVY,
  card: {
    surface: '#111418',
    textMuted: '#B9BDC4',
    label: '#8D939C',
  },
  warning: {
    bg: '#FCEBD2',
    text: '#8A4A00',
  },
} as const;

export type Colors = typeof colors;
