import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { Icon, type IconName } from './Icon';
import { timing } from './motion';
import { Text, type TextColor } from './Text';
import { useReducedMotion } from './useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** How far a button sinks while held. Small enough to read as give, not as a jump. */
const PRESSED_SCALE = 0.97;

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

/**
 * States: default, pressed, disabled. Focus shows a brand ring (3:1 on ground and surface).
 * Pressing sinks the button slightly while its fill eases to the pressed colour (duration.tap);
 * under reduced motion only the colour changes.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  stretch,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const l = look[variant];
  const reduced = useReducedMotion();
  const press = useSharedValue(0);
  const animated = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(press.value, [0, 1], [l.bg, l.pressed]),
    transform: [{ scale: reduced ? 1 : 1 - (1 - PRESSED_SCALE) * press.value }],
  }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      onPressIn={(e) => {
        press.value = withTiming(1, timing.tap);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        press.value = withTiming(0, timing.tap);
        onPressOut?.(e);
      }}
      style={[
        styles.base,
        {
          minHeight: layout.buttonHeight[size],
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg,
        },
        l.border ? { borderWidth: 1, borderColor: l.border } : null,
        stretch && styles.stretch,
        disabled && styles.disabled,
        animated,
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
    </AnimatedPressable>
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
