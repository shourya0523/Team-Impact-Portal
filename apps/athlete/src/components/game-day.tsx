import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { ease, Icon, Text, withAlpha } from '@/ui';

/**
 * Small "game day" pieces shared by the reactions: scoreboard digits (Rally count), a confetti
 * burst (Rally) and a check that draws itself (Saved). Every one honours reduced motion through
 * its `reduced` prop: digits change without rolling, no confetti, the check appears whole.
 */

/** How long a scoreboard digit takes to roll over to its new value. */
const ROLL_MS = 260;
/** Scoreboard tile; sized for display xs numerals. */
const DIGIT_W = 18;
const DIGIT_H = 28;

function Digit({ value, reduced }: { value: string; reduced: boolean }) {
  const y = useSharedValue(0);
  const shown = useRef(value);
  useEffect(() => {
    if (shown.current === value) return;
    shown.current = value;
    if (reduced) return;
    // The new digit drops in from above, like a flip scoreboard.
    y.value = withSequence(
      withTiming(-DIGIT_H, { duration: 0 }),
      withTiming(0, { duration: ROLL_MS, easing: ease.standard }),
    );
  }, [value, reduced, y]);
  const roll = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <View style={styles.digit}>
      <Animated.View style={roll}>
        <Text variant="display" size="xs" style={styles.numeral}>
          {value}
        </Text>
      </Animated.View>
      <View style={styles.seam} />
    </View>
  );
}

/**
 * A count as scoreboard digits: ink tiles, yellow condensed numerals, at least two digits. Each
 * digit rolls when it changes. Decorative: the control around it carries the count in its label.
 */
export function ScoreDigits({ value, reduced }: { value: number; reduced: boolean }) {
  const digits = String(Math.max(0, value)).padStart(2, '0').split('');
  return (
    <View style={styles.board} aria-hidden accessibilityElementsHidden>
      {digits.map((d, i) => (
        // Keyed from the right, so the ones digit stays the same tile as the count grows.
        <Digit key={digits.length - i} value={d} reduced={reduced} />
      ))}
    </View>
  );
}

/** Confetti flight time and easing, from the approved concept. */
const BURST_MS = 620;
const BURST_COLORS = [
  colors.brand,
  colors.action,
  colors.card.art.yellow,
  colors.card.art.blueBright,
  colors.action,
  colors.card.art.yellow,
  colors.brand,
  colors.card.art.blueBright,
] as const;
const PIECE = 7;
/** How far the pieces fly: three rings, so the burst doesn't look like a clock face. */
const FLIGHT = [34, 44, 54] as const;
const SPIN_DEGREES = 47;

function Piece({ i, p }: { i: number; p: SharedValue<number> }) {
  const a = (i / BURST_COLORS.length) * Math.PI * 2 - Math.PI / 2;
  const d = FLIGHT[i % FLIGHT.length]!;
  const x = Math.round(Math.cos(a) * d);
  const y = Math.round(Math.sin(a) * d);
  const style = useAnimatedStyle(() => ({
    // Hidden at rest; fully visible at launch, gone on landing.
    opacity: p.value === 0 ? 0 : 1 - p.value,
    transform: [
      { translateX: x * p.value },
      { translateY: y * p.value },
      { rotate: `${i * SPIN_DEGREES * p.value}deg` },
    ],
  }));
  return <Animated.View style={[styles.piece, { backgroundColor: BURST_COLORS[i] }, style]} />;
}

/**
 * About eight small squares in the Baseball Card colours fly out from the centre of the parent
 * and fade. Fires each time `shot` goes up. Place it centred on the thing that bursts.
 * Renders nothing under reduced motion.
 */
export function Confetti({ shot, reduced }: { shot: number; reduced: boolean }) {
  const p = useSharedValue(0);
  const last = useRef(shot);
  useEffect(() => {
    if (shot === last.current) return;
    last.current = shot;
    if (reduced) return;
    p.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: BURST_MS, easing: ease.cardDeal }),
      withTiming(0, { duration: 0 }),
    );
  }, [shot, reduced, p]);
  if (reduced) return null;
  return (
    <View style={styles.burst} aria-hidden>
      {BURST_COLORS.map((_, i) => (
        <Piece key={i} i={i} p={p} />
      ))}
    </View>
  );
}

/** How long the Saved check takes to draw. */
const DRAW_MS = 320;

/**
 * A check mark that draws itself left to right when `drawn` turns true (a wipe, so it works the
 * same on native and web). Under reduced motion it appears whole.
 */
export function DrawnCheck({
  drawn,
  size,
  color,
  reduced,
}: {
  drawn: boolean;
  size: number;
  color: string;
  reduced: boolean;
}) {
  const w = useSharedValue(drawn ? 1 : 0);
  useEffect(() => {
    if (!drawn) w.value = 0;
    else if (reduced) w.value = 1;
    else
      w.value = withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: DRAW_MS, easing: ease.standard }),
      );
  }, [drawn, reduced, w]);
  const wipe = useAnimatedStyle(() => ({ width: size * w.value }));
  return (
    <View style={{ width: size, height: size }} aria-hidden>
      <Animated.View style={[styles.wipe, { height: size }, wipe]}>
        <Icon name="check" size={size} color={color} strokeWidth={2.6} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flexDirection: 'row', gap: spacing.xs / 2 },
  digit: {
    width: DIGIT_W,
    height: DIGIT_H,
    borderRadius: radius.sm / 2,
    backgroundColor: colors.ink,
    overflow: 'hidden',
    alignItems: 'center',
  },
  numeral: { color: colors.card.art.yellow, lineHeight: DIGIT_H, textAlign: 'center' },
  seam: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: DIGIT_H / 2,
    height: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(colors.onBrand.text, 0.18),
  },
  burst: {
    pointerEvents: 'none',
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 0,
    height: 0,
    zIndex: 1,
  },
  piece: {
    position: 'absolute',
    left: -PIECE / 2,
    top: -PIECE / 2,
    width: PIECE,
    height: PIECE,
    borderRadius: spacing.xs / 2,
  },
  wipe: { overflow: 'hidden' },
});
