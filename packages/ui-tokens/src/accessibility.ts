/** WCAG helpers and the list of every text/background pair the design system uses. */
import { colors } from './colors';

export const contrastThreshold = {
  /** WCAG 1.4.3 AA, normal text. */
  normalText: 4.5,
  /** WCAG 1.4.3 AA large text, and 1.4.11 non-text UI components. */
  largeTextOrUi: 3,
} as const;

const channel = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Picks the more legible of white and ink for text on `background` (runtime team colours). */
export function readableOn(background: string): string {
  return contrastRatio(colors.surface, background) >= contrastRatio(colors.ink, background)
    ? colors.surface
    : colors.ink;
}

export interface ColorPair {
  name: string;
  foreground: string;
  background: string;
  /** Minimum ratio this pair must meet. */
  min: number;
}

const text = (name: string, foreground: string, background: string): ColorPair => ({
  name,
  foreground,
  background,
  min: contrastThreshold.normalText,
});

/** Every text/background pair the primitives use. The contrast test fails if one drops below AA. */
export const textPairs: readonly ColorPair[] = [
  text('ink on ground', colors.ink, colors.ground),
  text('ink on surface', colors.ink, colors.surface),
  text('secondary on ground', colors.text.secondary, colors.ground),
  text('secondary on surface', colors.text.secondary, colors.surface),
  text('muted on ground', colors.text.muted, colors.ground),
  text('muted on surface', colors.text.muted, colors.surface),
  text('brand on ground', colors.brand, colors.ground),
  text('brand on surface', colors.brand, colors.surface),
  text('surface on brand', colors.surface, colors.brand),
  text('surface on brand pressed', colors.surface, colors.brandPressed),
  text('ink on line (neutral badge)', colors.ink, colors.line),
  text('warning text on warning bg', colors.warning.text, colors.warning.bg),
  text('card text on card surface', colors.surface, colors.card.surface),
  text('card textMuted on card surface', colors.card.textMuted, colors.card.surface),
  text('card label on card surface', colors.card.label, colors.card.surface),
  text('surface on default team colour', readableOn(colors.team), colors.team),
];

/** Borders and focus rings that identify a control need 3:1 (WCAG 1.4.11). */
export const uiPairs: readonly ColorPair[] = [
  {
    name: 'input border (muted) on surface',
    foreground: colors.text.muted,
    background: colors.surface,
    min: contrastThreshold.largeTextOrUi,
  },
  {
    name: 'input border (muted) on ground',
    foreground: colors.text.muted,
    background: colors.ground,
    min: contrastThreshold.largeTextOrUi,
  },
  {
    name: 'focus ring (brand) on ground',
    foreground: colors.brand,
    background: colors.ground,
    min: contrastThreshold.largeTextOrUi,
  },
  {
    name: 'focus ring (brand) on surface',
    foreground: colors.brand,
    background: colors.surface,
    min: contrastThreshold.largeTextOrUi,
  },
];
