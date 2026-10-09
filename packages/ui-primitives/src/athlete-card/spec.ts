import { duration, easing, palette } from '@team-impact/ui-tokens';

/**
 * The card's visual spec, shared by the native and web renderers so both draw the same card.
 * Every size is in base units on a 320 x 448 card (5:7, trading-card proportions); renderers
 * multiply by `width / CARD_WIDTH`.
 */
export const CARD_WIDTH = 320;
export const CARD_HEIGHT = 500; //448;
export const CARD_ASPECT = CARD_HEIGHT / CARD_WIDTH;
export const cardHeightFor = (width: number) => (width * CARD_HEIGHT) / CARD_WIDTH;

export const cardColors = {
  navy: palette.secondary[600],
  navyDeep: palette.secondary[700],
  blue: palette.primary[600],
  blueBright: palette.primary[400],
  yellow: palette.quaternary[100],
  red: palette.quinary[400],
  offWhite: palette.senary[100],
  lightBlue: palette.tertiary[100],
  ink: palette.septenary[700],
  inkMuted: palette.grey[600],
  white: '#ffffff',
} as const;

export const cardLayout = {
  radius: 22,
  padding: 22,
  gap: 12,
  /** Baseball-card photo window: full width minus the patterned frame, top ~half of the card. */
  photoInset: 14,
  photoHeight: 236,
  photoRadius: 16,
  photoBorder: 3,
  jerseyBadge: 42,
  /**
   * Team Impact crest in the photo's top-left corner. assets/team-impact-logo.png is 240px tall
   * (5x this) so it only ever scales down: sharp on every screen density and on React Native Web.
   */
  logoHeight: 48,
  logoAspect: 1295 / 1499,
  positionBadge: 48,
  lowerPaddingX: 20,
  lowerPaddingY: 12,
  avatar: 58,
  /** Height of the back face's header row; the navy band's wave sits just below it. */
  backHeader: 74,
  contactLabel: 46,
  chipRadius: 999,
  chipPaddingX: 9,
  chipPaddingY: 4,
  tileRadius: 12,
} as const;

/**
 * Topps-style photo bleed: the photo spans the full card width and dissolves into the card art
 * through an alpha mask instead of sitting in a hard-edged box. Fractions are of `height`.
 */
export const photoBleed = {
  /** The photo covers the card from the top edge down to here (base units). */
  height: 300,
  /** Fade-in at the very top, so it melts into the frame border. */
  topFade: 0.07,
  /** Where the bottom dissolve starts; it reaches fully transparent at `height`. */
  bottomFadeStart: 0.5,
  /** Fade at the left and right edges. */
  sideFade: 0.13,
  /** Card-coloured shade behind the name: starts at `scrimStart`, peaks at `scrimPeak`. */
  scrimStart: 0.38,
  scrimPeak: 0.74,
  scrimOpacity: 0.8,
  /** The thin frame line drawn over the photo (where the white border used to be). */
  frameWidth: 1.5,
  frameOpacity: 0.9,
} as const;

export interface CardTextStyle {
  fontSize: number;
  lineHeight: number;
  fontWeight: '400' | '500' | '600' | '700' | '800';
  letterSpacing?: number;
  uppercase?: boolean;
}

export const cardText = {
  eyebrow: { fontSize: 9, lineHeight: 12, fontWeight: '700', letterSpacing: 1.8, uppercase: true },
  initials: { fontSize: 72, lineHeight: 78, fontWeight: '800', letterSpacing: -2 },
  firstName: { fontSize: 14, lineHeight: 17, fontWeight: '600', letterSpacing: 0.4 },
  lastName: {
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: 0.5,
    uppercase: true,
  },
  badge: { fontSize: 15, lineHeight: 18, fontWeight: '800', letterSpacing: 0.5 },
  badgeNumber: { fontSize: 17, lineHeight: 20, fontWeight: '800', letterSpacing: -0.5 },
  subtle: { fontSize: 11, lineHeight: 14, fontWeight: '400' },
  statValue: { fontSize: 17, lineHeight: 20, fontWeight: '800' },
  statLabel: {
    fontSize: 8.5,
    lineHeight: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    uppercase: true,
  },
  entryTitle: { fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  entryMeta: { fontSize: 10.5, lineHeight: 15, fontWeight: '400' },
  chip: { fontSize: 10, lineHeight: 13, fontWeight: '600' },
  name: { fontSize: 22, lineHeight: 26, fontWeight: '800' },
  body: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
  factValue: { fontSize: 12, lineHeight: 15, fontWeight: '700' },
  footer: { fontSize: 9, lineHeight: 12, fontWeight: '600', letterSpacing: 1.4, uppercase: true },
} as const satisfies Record<string, CardTextStyle>;

export type CardTextVariant = keyof typeof cardText;

export const cardMotion = {
  flipDuration: duration.emphasis,
  pressDuration: duration.fast,
  easing: easing.standard,
  perspective: 1400,
  /** Peak scale halfway through the flip, so the card "lifts" off the surface. */
  lift: 1.05,
  pressScale: 0.97,
} as const;

export const cardShadow = '0px 18px 36px rgba(13, 34, 68, 0.32)';

/** Web only: native falls back to the system font until DM Sans is bundled with expo-font. */
export const webFontFamily = '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
