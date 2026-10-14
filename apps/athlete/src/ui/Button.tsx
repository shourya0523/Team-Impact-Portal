import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { Icon, type IconName } from './Icon';
import { Text, type TextColor } from './Text';

export type ButtonVariant =
  /** Filled action red: the main action on a screen. */
  | 'primary'
  /** Surface with an ink outline. */
  | 'secondary'
  /** Filled navy. */
  | 'brand'
  /** Filled ink. */
  | 'ink'
  /** White fill on a navy ground. */
  | 'onBrand'
  /** Outline on a navy ground. */
  | 'ghostOnBrand';

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  /** sm = 44 (in cards and rows), md = 52, lg = 56. */
  size?: keyof typeof layout.buttonHeight;
  /** Optional leading icon, drawn in the label colour. */
  icon?: IconName;
  /** Grow to fill the row (for side-by-side buttons). */
  stretch?: boolean;
};

type Look = { bg: string; pressed: string; fg: TextColor; border?: string };

const look: Record<ButtonVariant, Look> = {
  primary: { bg: colors.action, pressed: colors.actionPressed, fg: 'onBrand' },
  secondary: { bg: colors.surface, pressed: colors.ground, fg: 'ink', border: colors.ink },
  brand: { bg: colors.brand, pressed: colors.brandPressed, fg: 'onBrand' },
  ink: { bg: colors.ink, pressed: colors.text.secondary, fg: 'onBrand' },
  onBrand: { bg: colors.surface, pressed: colors.brandTint, fg: 'brand' },
  ghostOnBrand: {
    bg: colors.brand,
    pressed: colors.brandPressed,
    fg: 'onBrand',
    border: colors.onBrand.muted,
  },
};

const iconColor: Partial<Record<TextColor, string>> = {
  ink: colors.ink,
  brand: colors.brand,
  onBrand: colors.onBrand.text,
};

/** States: default, pressed, disabled. Focus shows a brand ring (3:1 on ground and surface). */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  stretch,
  disabled,
  ...rest
}: ButtonProps) {
  const l = look[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: layout.buttonHeight[size],
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
          backgroundColor: pressed ? l.pressed : l.bg,
        },
        l.border ? { borderWidth: 1, borderColor: l.border } : null,
        stretch && styles.stretch,
        disabled && styles.disabled,
      ]}
    >
      {icon ? (
        <View style={styles.row}>
          <Icon
            name={icon}
            size={size === 'sm' ? 16 : 18}
            color={iconColor[l.fg]}
            strokeWidth={2.4}
          />
          <Text variant={size === 'sm' ? 'small' : 'body'} weight="semibold" color={l.fg}>
            {label}
          </Text>
        </View>
      ) : (
        <Text variant={size === 'sm' ? 'small' : 'body'} weight="semibold" color={l.fg}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minWidth: layout.minTouchTarget,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  stretch: { alignSelf: 'stretch', flexGrow: 1, flexBasis: 0 },
  // Disabled controls are exempt from WCAG contrast; dimming keeps them recognisably inactive.
  disabled: { opacity: 0.4 },
});
