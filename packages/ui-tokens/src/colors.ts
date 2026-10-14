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
  /** Hairlines inside cards and the segmented-control track. Decorative only. */
  lineSoft: '#ECE8DF',
  /** Navy: brand, links, focus rings, selection. */
  brand: NAVY,
  brandPressed: NAVY_PRESSED,
  /** Selected chips and icon fills on light grounds. */
  brandTint: '#E4E9F2',
  /** Big decorative numbers and monograms on navy. Decorative only. */
  brandRaised: '#2B5296',
  /** Text on navy surfaces. */
  onBrand: {
    text: '#FFFFFF',
    secondary: '#C5CFE3',
    muted: '#A9B6D3',
  },
  /** Logo red, exact. Decorative only (fails AA with white text). */
  red: RED,
  /** Main actions (primary buttons). */
  action: ACTION,
  actionPressed: ACTION_PRESSED,
  /** A pressed "Rally" and other soft action states; text on it uses `actionPressed`. */
  actionTint: '#FBE3E7',
  /** Interest communities and the teammate avatar. Ink text on `bg`, `text` on light grounds. */
  accent: {
    bg: '#F2C14E',
    deep: '#E3AC2B',
    text: '#7A5200',
  },
  success: {
    bg: '#DDF1EA',
    text: '#0B3D30',
  },
  danger: '#B3261E',
  /** Avatar backgrounds by role, so a coach reads differently from a parent at a glance. */
  role: {
    staff: ACTION,
    coach: '#111418',
    athlete: NAVY,
    parent: '#5B3FA0',
    teen: '#F2C14E',
    recruiter: '#0B3D30',
    alumni: '#0F6B5F',
  },
  /** Default team colour. Real values are supplied per team at runtime, see `team.ts`. */
  team: NAVY,
  card: {
    surface: '#111418',
    textMuted: '#B9BDC4',
    label: '#8D939C',
    /** The Baseball Card's generated art (ui-primitives athlete-card). */
    art: {
      navyDeep: '#0D2244',
      blue: '#0F407F',
      blueBright: '#3185F7',
      yellow: '#FFDA00',
      tint: '#F5F7FB',
      tintDeep: '#C4DAEB',
      inkMuted: '#404145',
    },
  },
  warning: {
    bg: '#FCEBD2',
    text: '#8A4A00',
  },
} as const;

export type Colors = typeof colors;
