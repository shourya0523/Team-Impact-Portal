import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { OUTLINE } from './Card';
import { withAlpha } from './color';
import { Icon, type IconName } from './Icon';
import { haptics } from './haptics';
import { timing } from './motion';
import { Text, type TextColor } from './Text';
import { useReducedMotion } from './useReducedMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** How far an outline button sinks while held. Small enough to read as give, not as a jump. */
const PRESSED_SCALE = 0.97;
/** Depth of the solid lip under filled buttons; pressing pushes the face down into it. */
const LIP = spacing.xs;
/** Tape stripes on a jersey button's right edge. */
const TAPE = { count: 4, width: spacing.sm, height: spacing.xs - 1 };

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
  /**
   * Game-day look for a screen's main commitment (Approve, Join, Publish): a condensed uppercase
   * label, a number slot (this string, e.g. "07", or the `icon`) and tape stripes. Filled
   * variants only; md and lg sizes.
   */
  jersey?: string | true;
};

type Look = { bg: string; pressed: string; fg: TextColor; border?: string; lip?: string };

const look: Record<ButtonVariant, Look> = {
  // Floodlight: filled and outlined buttons all sit on the same hard ink lip.
  primary: { bg: colors.action, pressed: colors.actionPressed, fg: 'onBrand', lip: colors.outline },
  secondary: {
    bg: colors.surface,
    pressed: colors.lineSoft,
    fg: 'ink',
    border: colors.outline,
    lip: colors.outline,
  },
  brand: { bg: colors.brand, pressed: colors.brandPressed, fg: 'onBrand', lip: colors.outline },
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
 * Every press plays a light tap haptic.
 *
 * - Filled red and navy buttons sit on a solid lip and press down into it, like a stadium
 *   button. Under reduced motion they don't move; the face darkens instead.
 * - Other variants sink slightly while their fill eases to the pressed colour (duration.tap);
 *   under reduced motion only the colour changes.
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  stretch,
  jersey,
  disabled,
  onPressIn,
  onPressOut,
  ...rest
}: ButtonProps) {
  const l = look[variant];
  const reduced = useReducedMotion();
  const press = useSharedValue(0);
  const lip = l.lip;
  // Jersey mode is for filled buttons only (its tape and slot are drawn in white).
  const isJersey = !!jersey && !!lip && !l.border && size !== 'sm';

  const face = useAnimatedStyle(() =>
    lip
      ? {
          backgroundColor: reduced
            ? interpolateColor(press.value, [0, 1], [l.bg, l.pressed])
            : l.bg,
          transform: [{ translateY: reduced ? 0 : LIP * press.value }],
        }
      : {
          backgroundColor: interpolateColor(press.value, [0, 1], [l.bg, l.pressed]),
          transform: [{ scale: reduced ? 1 : 1 - (1 - PRESSED_SCALE) * press.value }],
        },
  );

  const height = layout.buttonHeight[size];
  const fg = iconColor[l.fg];
  const content = isJersey ? (
    <View style={styles.jerseyRow}>
      <View style={styles.slot}>
        {typeof jersey === 'string' ? (
          <Text
            variant="display"
            size="xs"
            style={[styles.number, { color: variant === 'brand' ? colors.card.art.yellow : fg }]}
          >
            {jersey}
          </Text>
        ) : (
          <Icon
            name={icon ?? 'check'}
            size={20}
            color={variant === 'brand' ? colors.card.art.yellow : fg}
            strokeWidth={3}
          />
        )}
      </View>
      <Text variant="display" size="xs" color={l.fg} style={styles.grow} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.tape} accessibilityElementsHidden importantForAccessibility="no">
        {Array.from({ length: TAPE.count }, (_, i) => (
          <View key={i} style={styles.tapeBar} />
        ))}
      </View>
    </View>
  ) : icon ? (
    <View style={styles.row}>
      <Icon name={icon} size={size === 'sm' ? 16 : 18} color={fg} strokeWidth={2.4} />
      <Text variant={size === 'sm' ? 'small' : 'body'} weight="semibold" color={l.fg}>
        {label}
      </Text>
    </View>
  ) : (
    <Text variant={size === 'sm' ? 'small' : 'body'} weight="semibold" color={l.fg}>
      {label}
    </Text>
  );

  const handlers = {
    onPressIn: (e: Parameters<NonNullable<PressableProps['onPressIn']>>[0]) => {
      press.value = withTiming(1, timing.tap);
      haptics.tap();
      onPressIn?.(e);
    },
    onPressOut: (e: Parameters<NonNullable<PressableProps['onPressOut']>>[0]) => {
      press.value = withTiming(0, timing.tap);
      onPressOut?.(e);
    },
  };
  const padding = { paddingHorizontal: size === 'sm' ? spacing.md : spacing.lg };

  if (lip) {
    // The Pressable is the lip: one touch target covering face and lip, so nothing shifts.
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        accessibilityLabel={label}
        disabled={disabled}
        {...rest}
        {...handlers}
        style={[
          styles.lip,
          { backgroundColor: lip, minHeight: height + LIP },
          stretch && styles.stretch,
          disabled && styles.disabled,
        ]}
      >
        <Animated.View
          style={[
            styles.base,
            { minHeight: height },
            isJersey ? styles.jerseyPadding : padding,
            l.border ? { borderWidth: OUTLINE, borderColor: l.border } : null,
            face,
          ]}
        >
          {content}
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...rest}
      {...handlers}
      style={[
        styles.base,
        { minHeight: height },
        l.border ? { borderWidth: 1, borderColor: l.border } : null,
        stretch && styles.stretch,
        disabled && styles.disabled,
        face,
      ]}
    >
      {/* Padding sits on the content, not the pressable, so stretched buttons share a row
          equally whatever their variant (flex-basis 0 still counts a pressable's padding). */}
      <View style={padding}>{content}</View>
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
  lip: { borderRadius: radius.md, minWidth: layout.minTouchTarget, justifyContent: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  jerseyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'stretch' },
  jerseyPadding: { paddingLeft: spacing.md, paddingRight: spacing.sm },
  slot: {
    alignItems: 'center',
    paddingRight: spacing.sm,
    borderRightWidth: 2,
    borderRightColor: withAlpha(colors.onBrand.text, 0.35),
  },
  number: { fontStyle: 'italic' },
  grow: { flex: 1 },
  tape: { gap: TAPE.height, opacity: 0.55 },
  tapeBar: {
    width: TAPE.width,
    height: TAPE.height,
    borderRadius: TAPE.height / 2,
    backgroundColor: colors.onBrand.text,
  },
  stretch: { alignSelf: 'stretch', flexGrow: 1, flexBasis: 0 },
  // Disabled controls are exempt from WCAG contrast; dimming keeps them recognisably inactive.
  disabled: { opacity: 0.4 },
});
