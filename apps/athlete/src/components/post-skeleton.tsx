import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors, duration, layout, radius, spacing } from '@team-impact/ui-tokens';
import { Card, ease, useReducedMotion } from '@/ui';

const AVATAR = 40;
const BAR = 12;
const COUNT = 3;
/** One fade down or up; slow, so it reads as waiting rather than flashing. */
const PULSE = { duration: duration.cardReveal * 1.5, easing: ease.standard };

/** A grey card the shape of a `PostCard`: byline, two lines of text, the Rally and comments buttons. */
function PostShape() {
  return (
    <Card>
      <View style={styles.byline}>
        <View style={styles.avatar} />
        <View style={styles.grow}>
          <View style={[styles.bar, styles.name]} />
          <View style={[styles.bar, styles.meta]} />
        </View>
      </View>
      <View style={styles.bar} />
      <View style={[styles.bar, styles.short]} />
      <View style={styles.byline}>
        <View style={[styles.pill, styles.rally]} />
        <View style={[styles.pill, styles.comments]} />
      </View>
    </Card>
  );
}

/**
 * A feed's first page on its way: three placeholder posts, pulsing gently. Under reduced motion
 * they stay still. Screen readers hear "Loading posts" once, not the shapes.
 */
export function FeedSkeleton() {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    opacity.value = withRepeat(withTiming(0.5, PULSE), -1, true);
    return () => cancelAnimation(opacity);
  }, [reduced, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: reduced ? 1 : opacity.value }));
  return (
    <Animated.View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading posts"
      style={[styles.list, style]}
    >
      {Array.from({ length: COUNT }, (_, i) => (
        <PostShape key={i} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.md, gap: spacing.md },
  byline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xs },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.lineSoft,
  },
  bar: { height: BAR, borderRadius: BAR / 2, backgroundColor: colors.lineSoft },
  name: { width: '45%' },
  meta: { width: '30%' },
  short: { width: '65%' },
  pill: {
    height: layout.minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.lineSoft,
  },
  rally: { width: '22%' },
  comments: { width: '32%' },
});
