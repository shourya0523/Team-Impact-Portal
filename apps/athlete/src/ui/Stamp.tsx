import { useEffect, useRef } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { springConfig, timing } from './motion';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

/** The stamp drops in large and tilted, then settles at a slight angle. */
const STAMP_FROM = { scale: 2.2, rotate: -14 };
const STAMP_REST = -8;
const BORDER = { lg: 6, sm: 4 };

export type StampProps = {
  /** Second line under SIGNED, e.g. the date. */
  date?: string;
  /**
   * `onBrand`: white outline on a navy ground (the Signed screen). `action`: red on a ground
   * plate, for landing over a navy control (HoldButton `sign`).
   */
  tone?: 'onBrand' | 'action';
  /** `lg` for a screen's hero, `sm` to sit over a button. */
  size?: 'lg' | 'sm';
  /** Runs once, the moment the stamp hits (spring reaches rest; at once under reduced motion). */
  onLand?: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * The SIGNED stamp: lands with the earned-moment spring. Under reduced motion there is no stamp
 * movement at all, only a fade.
 */
export function Stamp({ date, tone = 'onBrand', size = 'lg', onLand, style }: StampProps) {
  const reduced = useReducedMotion();
  const land = useSharedValue(0);
  const fade = useSharedValue(0);
  const onLandRef = useRef(onLand);
  onLandRef.current = onLand;
  const landed = useRef(false);
  const fireLand = () => {
    if (landed.current) return;
    landed.current = true;
    onLandRef.current?.();
  };

  useEffect(() => {
    // The fade is what reduced motion gets instead of the drop, so Reanimated mustn't skip it.
    fade.value = withTiming(1, {
      ...(reduced ? timing.screen : timing.small),
      reduceMotion: ReduceMotion.Never,
    });
    land.value = reduced ? 1 : withSpring(1, springConfig);
    // fireLand only reads refs, so it isn't a dependency.
    if (reduced) fireLand();
  }, [reduced, fade, land]);

  // The spring's first arrival at rest is the hit; the overshoot after it is the ink spreading.
  useAnimatedReaction(
    () => land.value >= 1,
    (hit, before) => {
      if (hit && !before) scheduleOnRN(fireLand);
    },
  );

  const animated = useAnimatedStyle(() => {
    const scale = STAMP_FROM.scale + (1 - STAMP_FROM.scale) * land.value;
    const rotate = STAMP_FROM.rotate + (STAMP_REST - STAMP_FROM.rotate) * land.value;
    return {
      opacity: fade.value,
      transform: reduced
        ? [{ rotate: `${STAMP_REST}deg` }]
        : [{ scale }, { rotate: `${rotate}deg` }],
    };
  });

  const action = tone === 'action';
  return (
    <Animated.View
      style={[
        styles.stamp,
        size === 'sm' ? styles.sm : styles.lg,
        action ? styles.action : styles.onBrand,
        style,
        animated,
      ]}
      accessible
      accessibilityLabel={date ? `Signed, ${date}` : 'Signed'}
    >
      <Text
        variant="display"
        size={size === 'sm' ? 'md' : 'xxl'}
        color="onBrand"
        accessibilityRole="none"
        style={action && styles.actionText}
      >
        Signed
      </Text>
      {date && (
        <Text variant="eyebrow" color="onBrand" style={action && styles.actionText}>
          {date}
        </Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stamp: { alignItems: 'center' },
  lg: {
    borderWidth: BORDER.lg,
    borderRadius: radius.card,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  sm: {
    borderWidth: BORDER.sm,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  onBrand: { borderColor: colors.onBrand.text },
  // Large display text: AA needs 3:1 (see textPairs, "action on ground (SIGNED stamp)").
  action: { borderColor: colors.action, backgroundColor: colors.ground },
  actionText: { color: colors.action },
});
