/**
 * Signing Day colour tokens (TI-72). Plain hex only, so they work on native, React Native Web and CSS.
 */

/** Stand-in until the real Team IMPACT blue arrives (TI-13). Swap these two lines and nothing else. */
const BRAND = '#1B3FBF';
const BRAND_PRESSED = '#122C8A';

export const colors = {
  ground: '#F6F4EF',
  surface: '#FFFFFF',
  ink: '#111418',
  text: {
    secondary: '#4A4F57',
    muted: '#5C616A',
  },
  line: '#DDD8CD',
  brand: BRAND,
  brandPressed: BRAND_PRESSED,
  /** Default team colour. Real values are supplied per team at runtime, see `team.ts`. */
  team: BRAND,
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
