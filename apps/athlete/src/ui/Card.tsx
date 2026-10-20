import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, spacing } from '@team-impact/ui-tokens';

export type CardProps = ViewProps & {
  /** `plain` is the surface card; `dark` is the Baseball Card base (card.surface, 18 radius). */
  variant?: 'plain' | 'dark';
  /** Makes the whole card a button. Don't nest other buttons inside one. */
  onPress?: () => void;
  /** Accessibility label when the card is a button. */
  label?: string;
};

/** Outline weight for cards and outlined buttons. */
export const OUTLINE = 1.5;

export function Card({ variant = 'plain', style, onPress, label, ...rest }: CardProps) {
  const base = [styles.base, variant === 'dark' ? styles.dark : styles.plain, style];
  if (!onPress) return <View {...rest} style={base} />;
  return (
    <Pressable
      {...rest}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    />
  );
}

const styles = StyleSheet.create({
  base: { padding: spacing.md, gap: spacing.sm },
  // Floodlight: an ink outline, so cards stand off the white ground without a shadow.
  plain: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: OUTLINE,
    borderColor: colors.outline,
  },
  dark: { backgroundColor: colors.card.surface, borderRadius: radius.card },
  pressed: { opacity: 0.8 },
});
