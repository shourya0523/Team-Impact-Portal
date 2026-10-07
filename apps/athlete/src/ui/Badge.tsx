import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { Text } from './Text';

export type BadgeProps = {
  label: string;
  variant?: 'neutral' | 'brand' | 'warning';
};

const look = {
  neutral: { bg: colors.line, fg: colors.ink },
  brand: { bg: colors.brand, fg: colors.surface },
  warning: { bg: colors.warning.bg, fg: colors.warning.text },
} as const;

export function Badge({ label, variant = 'neutral' }: BadgeProps) {
  const { bg, fg } = look[variant];
  return (
    <View style={[styles.base, { backgroundColor: bg }]}>
      <Text variant="caption" weight="semibold" style={{ color: fg }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
