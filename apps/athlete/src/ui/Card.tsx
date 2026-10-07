import { StyleSheet, View, type ViewProps } from 'react-native';
import { colors, radius, spacing } from '@team-impact/ui-tokens';

export type CardProps = ViewProps & {
  /** `plain` is the surface card; `dark` is the Baseball Card base (card.surface, 18 radius). */
  variant?: 'plain' | 'dark';
};

export function Card({ variant = 'plain', style, ...rest }: CardProps) {
  return (
    <View {...rest} style={[styles.base, variant === 'dark' ? styles.dark : styles.plain, style]} />
  );
}

const styles = StyleSheet.create({
  base: { padding: spacing.md, gap: spacing.sm },
  plain: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
  },
  dark: { backgroundColor: colors.card.surface, borderRadius: radius.card },
});
