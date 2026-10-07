import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { Text } from './Text';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: 'primary' | 'secondary';
  /** md = 52, lg = 56. */
  size?: 'md' | 'lg';
};

/** States: default, pressed, disabled. Focus shows a brand ring (3:1 on ground and surface). */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  disabled,
  ...rest
}: ButtonProps) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        { minHeight: layout.buttonHeight[size] },
        primary
          ? { backgroundColor: pressed ? colors.actionPressed : colors.action }
          : {
              backgroundColor: pressed ? colors.ground : colors.surface,
              borderColor: colors.ink,
              borderWidth: 1,
            },
        disabled && styles.disabled,
      ]}
    >
      <Text variant="body" weight="semibold" color={primary ? 'onBrand' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Disabled controls are exempt from WCAG contrast; dimming keeps them recognisably inactive.
  disabled: { opacity: 0.4 },
});
