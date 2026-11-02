import { colors, duration, easing, spring, tilt } from '@team-impact/ui-tokens';

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
  navy: colors.brand,
  navyDeep: colors.card.art.navyDeep,
  blue: colors.card.art.blue,
  blueBright: colors.card.art.blueBright,
  yellow: colors.card.art.yellow,
  red: colors.red,
  offWhite: colors.card.art.tint,
  lightBlue: colors.card.art.tintDeep,
  ink: colors.ink,
  inkMuted: colors.card.art.inkMuted,
  white: colors.surface,
} as const;

export const cardLayout = {
  radius: 22,
  padding: 22,
  gap: 12,
  /** Impact-card photo window: full width minus the patterned frame, top ~half of the card. */
  photoInset: 14,
  photoHeight: 280,
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
  /** Rookie card (TI-114): the team colour stripe across the top edge of both faces. */
  stripe: 10,
  /** Jersey number over the photo's top-left corner, from the photo window's edge. */
  jerseyInsetX: 12,
  jerseyInsetY: 2,
  /** Nameplate under the photo: largest and smallest name size, see `fitName`. */
  nameMaxSize: 34,
  nameMinSize: 18,
  /**
   * Average caps width of the display face as a fraction of its size. Barlow Condensed 800 is
   * about 0.47; the extra keeps the estimate safe while the font is still loading.
   */
  nameCharWidth: 0.52,
  /** Gap between the name, the position/team line and the class/major/division row. */
  rookieGap: 4,
  rookieRowPadding: 9,
} as const;

/**
 * Topps-style photo bleed: the photo spans the full card width and dissolves into the card art
 * through an alpha mask instead of sitting in a hard-edged box. Fractions are of `height`.
 */
export const photoBleed = {
  /** The photo covers the card from the top edge down to here (base units). */
  height: 330,
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
  /** Set in the display face (Barlow Condensed 800), see `displayFont`. */
  display?: boolean;
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
  /** Rookie front: big jersey number over the photo, name, position/team line, stat values. */
  jersey: { fontSize: 64, lineHeight: 64, fontWeight: '800', display: true },
  /** `fontSize` is the largest; `fitName` picks the size actually used. Line height is 0.95em. */
  rookieName: { fontSize: 34, lineHeight: 32, fontWeight: '800', uppercase: true, display: true },
  rookieLine: { fontSize: 12.5, lineHeight: 16, fontWeight: '600' },
  rookieValue: { fontSize: 15, lineHeight: 19, fontWeight: '700' },
} as const satisfies Record<string, CardTextStyle>;

export type CardTextVariant = keyof typeof cardText;

/** Name-line height as a fraction of the fitted font size (display face, from ui-tokens). */
export const NAME_LINE_HEIGHT = 0.95;

export const cardMotion = {
  flipDuration: duration.cardReveal,
  pressDuration: duration.tap,
  easing: easing.standard,
  perspective: 1400,
  /** Peak scale halfway through the flip, so the card "lifts" off the surface. */
  lift: 1.05,
  pressScale: 0.97,
  /** Card reveal: the card deals in from below, slightly turned (fade only under Reduce Motion). */
  dealDuration: duration.cardReveal,
  dealEasing: easing.cardDeal,
  deal: { offsetY: 36, rotate: -4, scale: 0.92 },
  /** Tilt toward the pointer or finger, never past this. Off under Reduce Motion. */
  tiltMax: tilt.maxDegrees,
  /** How quickly the tilt catches up with a moving finger or pointer, ms. */
  followDuration: duration.tap,
  /** Spring back to flat on release. */
  spring,
  /** Gyro tilt on phones: tipping the phone this many degrees from how it's held reaches `tiltMax`. */
  gyroRange: 20,
  /**
   * Share of the gap to the phone's current angle closed per sensor reading (about 60 a second),
   * so a new holding angle reads as flat after a few seconds.
   */
  gyroRecenter: 0.02,
  /** Shine fade in and out, ms. */
  shineFade: duration.small,
} as const;

/** `#RRGGBB` + alpha → `rgba()`, so translucent shine colours still come from the tokens. */
export const withAlpha = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/**
 * Holo shine: a white hotspot under the pointer or finger plus an iridescent band that slides
 * with it. Drawn over the face while tilting only; the flat face (PNG export) never has it.
 */
export const cardShine = {
  highlight: { color: colors.surface, opacity: 0.55 },
  /** Hotspot radius as a fraction of the card's larger side. */
  highlightRadius: 0.45,
  holo: [
    { color: cardColors.blueBright, opacity: 0.45 },
    { color: colors.surface, opacity: 0.5 },
    { color: cardColors.yellow, opacity: 0.4 },
    { color: cardColors.red, opacity: 0.35 },
  ],
  /** Band angle in degrees (CSS convention: 0 = upward, 90 = left to right). */
  holoAngle: 115,
  /** Where the band starts and ends along that direction, as fractions. */
  holoStart: 0.3,
  holoEnd: 0.7,
  /** The band's layer is this many card sizes big and slides across as the point moves. */
  holoSpan: 2.5,
  /** Peak opacity of the whole shine layer. */
  opacity: 0.9,
} as const;

/** Evenly spaced offsets for the holo colours between `holoStart` and `holoEnd`. */
export const holoStops = () =>
  cardShine.holo.map((stop, i) => ({
    ...stop,
    offset:
      cardShine.holoStart +
      ((cardShine.holoEnd - cardShine.holoStart) * (i + 1)) / (cardShine.holo.length + 1),
  }));

/** A CSS gradient angle as SVG `x1 y1 x2 y2` fractions across the box. */
export const gradientLine = (angleDeg: number) => {
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.sin(rad) / 2;
  const dy = -Math.cos(rad) / 2;
  return { x1: 0.5 - dx, y1: 0.5 - dy, x2: 0.5 + dx, y2: 0.5 + dy };
};

/** The display face for the name and jersey number. */
export const displayFont = {
  /** Family the Expo app registers in apps/athlete/src/ui/fonts.ts (iOS, Android and RN Web). */
  native: 'BarlowCondensed_800ExtraBold',
  /** The portal loads Barlow Condensed 800 from Google Fonts (apps/portal/index.html). */
  web: '"Barlow Condensed", "Arial Narrow", system-ui, sans-serif',
} as const;

export const cardShadow = '0px 18px 36px rgba(13, 34, 68, 0.32)';

/** Web only: native falls back to the system font until DM Sans is bundled with expo-font. */
export const webFontFamily = '"DM Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
