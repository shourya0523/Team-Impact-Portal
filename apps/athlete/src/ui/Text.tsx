import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { colors, fontWeight, typography, type TypeStyle } from '@team-impact/ui-tokens';
import { nativeFont } from './fonts';

export type TextColor =
  | 'ink'
  | 'secondary'
  | 'muted'
  | 'brand'
  | 'onBrand'
  | 'onBrandSecondary'
  | 'onBrandMuted'
  | 'action'
  | 'danger'
  | 'success'
  | 'warning'
  | 'accent';

const textColor: Record<TextColor, string> = {
  ink: colors.ink,
  secondary: colors.text.secondary,
  muted: colors.text.muted,
  brand: colors.brand,
  onBrand: colors.onBrand.text,
  onBrandSecondary: colors.onBrand.secondary,
  onBrandMuted: colors.onBrand.muted,
  // Red text uses actionPressed: `action` itself is 4.2:1 on ground and fails AA for small text.
  action: colors.actionPressed,
  danger: colors.danger,
  success: colors.success.text,
  warning: colors.warning.text,
  accent: colors.accent.text,
};

type Weight = 'regular' | 'medium' | 'semibold';
type DisplaySize = keyof typeof typography.display;
type DecorSize = keyof typeof typography.decor;

/** Font family for a token weight, or the display face. */
export const fontFor = (weight: Weight | 'display') =>
  weight === 'display' ? nativeFont.display : nativeFont[fontWeight[weight]];

/** A type token as a React Native style (for TextInput and other non-Text hosts). */
export function typeStyle(t: TypeStyle, weight?: Weight): TextStyle {
  return {
    fontFamily:
      t.fontWeight === fontWeight.display
        ? nativeFont.display
        : weight
          ? fontFor(weight)
          : nativeFont[t.fontWeight as 400 | 500 | 600],
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: t.letterSpacing * t.fontSize,
    textTransform: t.uppercase ? 'uppercase' : 'none',
  };
}

export type TextProps = RNTextProps & {
  /** `decor` is the oversized monogram/number behind content; hidden from assistive tech. */
  variant?: 'display' | 'decor' | 'body' | 'small' | 'caption' | 'eyebrow';
  /** Size step for `display` (xxl–xs) and `decor` (sm–xl); ignored for other variants. */
  size?: DisplaySize | DecorSize;
  /** UI weight; ignored for display/decor (always 800) and eyebrow (always 600). */
  weight?: Weight;
  color?: TextColor;
};

const pick = (variant: NonNullable<TextProps['variant']>, size: DisplaySize | DecorSize) => {
  if (variant === 'display')
    return typography.display[size as DisplaySize] ?? typography.display.md;
  if (variant === 'decor') return typography.decor[size as DecorSize] ?? typography.decor.md;
  return typography[variant];
};

/** The only way to render text. Maps the Signing Day type tokens onto React Native styles. */
export function Text({
  variant = 'body',
  size = 'md',
  weight = 'regular',
  color = 'ink',
  style,
  ...rest
}: TextProps) {
  const t = pick(variant, size);
  const decor = variant === 'decor';
  return (
    <RNText
      accessibilityRole={variant === 'display' ? 'header' : undefined}
      aria-hidden={decor || undefined}
      accessibilityElementsHidden={decor || undefined}
      importantForAccessibility={decor ? 'no-hide-descendants' : undefined}
      {...rest}
      style={[
        typeStyle(t, variant === 'eyebrow' ? 'semibold' : weight),
        { color: textColor[color] },
        style,
      ]}
    />
  );
}
