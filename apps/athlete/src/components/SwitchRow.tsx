import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, layout, spacing } from '@team-impact/ui-tokens';
import { Text, timing, useReducedMotion } from '@/ui';

const SWITCH_W = 56;
const SWITCH_H = 32;
const KNOB = 26;
const INSET = (SWITCH_H - KNOB) / 2;
/** How far the knob travels from off to on. */
const TRAVEL = SWITCH_W - KNOB - INSET * 2;

/**
 * A labelled on/off switch row, like the community page's "Recruiters can find me" switch. The
 * whole row is the control (one target, no nested buttons). The knob slides and the track fades
 * between muted and navy (duration.small); under reduced motion the knob jumps and only the
 * colour fades.
 */
export function SwitchRow({
  label,
  detail,
  value,
  onChange,
  disabled,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const on = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(value ? 1 : 0, timing.small);
  }, [value, on]);
  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [colors.text.muted, colors.brand]),
  }));
  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: (reduced ? Math.round(on.value) : on.value) * TRAVEL }],
  }));
  return (
    <Pressable
      onPress={() => onChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View style={styles.text}>
        <Text weight="semibold">{label}</Text>
        {detail && (
          <Text variant="small" color="secondary">
            {detail}
          </Text>
        )}
      </View>
      <Animated.View style={[styles.switch, track]}>
        <Animated.View style={[styles.knob, knob]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  text: { flex: 1, gap: spacing.xs },
  // Disabled controls are exempt from contrast rules; dimming marks them inactive.
  disabled: { opacity: 0.5 },
  switch: {
    width: SWITCH_W,
    height: SWITCH_H,
    borderRadius: SWITCH_H / 2,
    padding: INSET,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, backgroundColor: colors.surface },
});
