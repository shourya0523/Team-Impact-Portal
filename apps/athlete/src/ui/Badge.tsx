import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { Icon, type IconName } from './Icon';
import { Text, type TextColor } from './Text';

export type BadgeVariant =
  'neutral' | 'brand' | 'brandTint' | 'warning' | 'success' | 'action' | 'ink';

export type BadgeProps = {
  label: string;
  variant?: BadgeVariant;
  /** Optional leading icon, drawn in the label colour. */
  icon?: IconName;
  /** Uppercase eyebrow lettering, e.g. NEXT UP or OFFICIAL. */
  caps?: boolean;
};

const look: Record<BadgeVariant, { bg: string; fg: string; text: TextColor }> = {
  neutral: { bg: colors.line, fg: colors.ink, text: 'ink' },
  brand: { bg: colors.brand, fg: colors.onBrand.text, text: 'onBrand' },
  brandTint: { bg: colors.brandTint, fg: colors.brand, text: 'brand' },
  warning: { bg: colors.warning.bg, fg: colors.warning.text, text: 'warning' },
  success: { bg: colors.success.bg, fg: colors.success.text, text: 'success' },
  action: { bg: colors.action, fg: colors.onBrand.text, text: 'onBrand' },
  ink: { bg: colors.ink, fg: colors.onBrand.text, text: 'onBrand' },
};

export function Badge({ label, variant = 'neutral', icon, caps }: BadgeProps) {
  const { bg, fg, text } = look[variant];
  return (
    <View style={[styles.base, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={12} color={fg} strokeWidth={2.6} />}
      <Text variant={caps ? 'eyebrow' : 'caption'} weight="semibold" color={text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
});
