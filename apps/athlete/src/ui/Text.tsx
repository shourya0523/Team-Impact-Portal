import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, fontWeight, typography } from '@team-impact/ui-tokens';
import { nativeFont } from './fonts';

export type TextColor = 'ink' | 'secondary' | 'muted' | 'brand' | 'onBrand';
const textColor: Record<TextColor, string> = {
  ink: colors.ink,
  secondary: colors.text.secondary,
  muted: colors.text.muted,
  brand: colors.brand,
  onBrand: colors.surface,
};

type Weight = 'regular' | 'medium' | 'semibold';

export type TextProps = RNTextProps & {
  variant?: 'display' | 'body' | 'small' | 'caption' | 'eyebrow';
  /** Display size step; ignored for other variants. */
  size?: keyof typeof typography.display;
  /** UI weight; ignored for display (always 800) and eyebrow (always 600). */
  weight?: Weight;
  color?: TextColor;
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
  const t = variant === 'display' ? typography.display[size] : typography[variant];
  const family =
    variant === 'display'
      ? nativeFont.display
      : nativeFont[variant === 'eyebrow' ? fontWeight.semibold : fontWeight[weight]];
  return (
    <RNText
      accessibilityRole={variant === 'display' ? 'header' : undefined}
      {...rest}
      style={[
        {
          fontFamily: family,
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing * t.fontSize,
          textTransform: t.uppercase ? 'uppercase' : 'none',
          color: textColor[color],
        },
        style,
      ]}
    />
  );
}
