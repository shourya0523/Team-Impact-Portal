import { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, duration, layout, radius, spacing } from '@team-impact/ui-tokens';
import { haptics } from './haptics';
import { ease, timing } from './motion';
import { Stamp } from './Stamp';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type HoldLook = 'sign' | 'danger';

/** How long each look has to be held. A signature is quicker than a referee's call. */
const HOLD_MS: Record<HoldLook, number> = { sign: 1000, danger: 1200 };
/** Letting go from a full hold rolls back in this long; a partial hold rolls back pro rata. */
const ROLLBACK_MS = duration.small;
/** `sign` ticks at 25, 50 and 75%. */
const QUARTERS = 4;
/** Below this, letting go is a tap, not an abandoned hold: no warning. */
const EARLY_MIN = 0.02;
/** The danger shake: a flag on the play. Offsets in points, split evenly across duration.screen. */
const SHAKE = [-spacing.sm, spacing.sm * 0.75, -spacing.xs, spacing.xs / 2, 0];
/**
 * Progress is the affordance, not decoration, so it runs even under reduced motion (Reanimated
 * would otherwise jump it straight to the end and complete the hold on touch).
 */
const always = ReduceMotion.Never;
const progressTo = (ms: number) => ({ duration: ms, easing: Easing.linear, reduceMotion: always });

/**
 * The signature drawn under a `sign` label (viewBox 0 0 270 26). Its length is computed once from
 * the path itself, so the dash animation doesn't depend on `pathLength` support.
 */
const SIGNATURE =
  'M4 18 C 18 2, 26 24, 38 12 S 58 4, 64 16 S 84 22, 96 8 C 104 0, 110 22, 122 14 S 146 6, 156 18 C 168 26, 176 4, 190 12 S 214 20, 226 10 S 252 8, 266 16';
const SIGNATURE_BOX = { width: 270, height: 26 };
const SIGNATURE_HEIGHT = 18;
const SIGNATURE_STROKE = 2.5;
const DANGER_BORDER = 2;

/** Length of a path made of absolute M, C and S commands, by sampling each cubic. */
function pathLength(d: string): number {
  const tokens = d.match(/[MCS]|-?\d*\.?\d+/g) ?? [];
  type Pt = [number, number];
  let i = 0;
  let cmd = '';
  let cur: Pt = [0, 0];
  let lastCtrl: Pt = [0, 0];
  let total = 0;
  const num = () => Number(tokens[i++]);
  const pt = (): Pt => [num(), num()];
  const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt) => {
    const steps = 32;
    let prev = p0;
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      const u = 1 - t;
      const x =
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0];
      const y =
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1];
      total += Math.hypot(x - prev[0], y - prev[1]);
      prev = [x, y];
    }
  };
  while (i < tokens.length) {
    if (/[MCS]/.test(tokens[i]!)) cmd = tokens[i++]!;
    if (cmd === 'M') {
      cur = pt();
      lastCtrl = cur;
    } else if (cmd === 'C') {
      const [c1, c2, end] = [pt(), pt(), pt()];
      cubic(cur, c1, c2, end);
      [lastCtrl, cur] = [c2, end];
    } else {
      const c1: Pt = [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]];
      const [c2, end] = [pt(), pt()];
      cubic(cur, c1, c2, end);
      [lastCtrl, cur] = [c2, end];
    }
  }
  return total;
}
const SIGNATURE_LENGTH = pathLength(SIGNATURE);

export type HoldButtonProps = {
  /** What holding does, starting "Hold to …" ("Hold to publish card"). Also the a11y label. */
  label: string;
  /** `sign` for commitments (publish, accept), `danger` for destructive actions. */
  look: HoldLook;
  /**
   * Runs when the hold completes (or a screen reader activates the button). If it returns a
   * promise that rejects, the button resets so it can be held again.
   */
  onComplete: () => unknown;
  disabled?: boolean;
  /**
   * The screen's own busy state. A string replaces the label while busy ("Joining…"). When busy
   * goes back to false while the button is still on screen (the action failed), it resets.
   */
  busy?: boolean | string;
  testID?: string;
};

/**
 * Hold-to-confirm button.
 *
 * - `sign` (Hold to sign): navy; a yellow signature writes itself under the label while the fill
 *   darkens left to right, with a selection tick at each quarter. On completion the SIGNED stamp
 *   lands over the button (Heavy as it hits), then `onComplete` runs. The screen plays
 *   `haptics.success()` or `haptics.error()` when its call answers, so the buzz tells the truth.
 * - `danger` (Referee hold): red outline; a red fill sweeps left to right and the label turns
 *   white under it. On completion, Heavy, then `onComplete`.
 * - Letting go early rolls the progress back and plays Warning; `danger` also shakes.
 * - Reduced motion: progress still fills (it is the affordance), the stamp fades in, no shake.
 * - Screen readers: double-tap completes it directly (`activate`). On web, a click that wasn't a
 *   press (assistive tech) does the same; holding Space or Enter works like holding the button.
 */
export function HoldButton({ label, look, onComplete, disabled, busy, testID }: HoldButtonProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const holding = useSharedValue(false);
  const shake = useSharedValue(0);
  const [done, setDone] = useState(false);
  const [width, setWidth] = useState(0);
  const doneRef = useRef(false);
  const pressedIn = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const holdMs = HOLD_MS[look];
  const inert = !!disabled || !!busy || done;

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    doneRef.current = false;
    setDone(false);
    progress.value = withTiming(0, { ...timing.small, reduceMotion: always });
  };

  // The screen's call failed (busy went back to false): let them try again.
  const wasBusy = useRef(!!busy);
  useEffect(() => {
    if (wasBusy.current && !busy && doneRef.current) reset();
    wasBusy.current = !!busy;
    // reset only touches refs, state setters and shared values.
  }, [busy]);

  const finish = () => {
    let result: unknown;
    try {
      result = onCompleteRef.current();
    } catch (e) {
      reset();
      throw e;
    }
    if (result instanceof Promise) result.catch(reset);
  };

  /** The hold (or an assistive activation) went all the way. */
  const complete = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    holding.value = false;
    progress.value = withTiming(1, { ...timing.tap, reduceMotion: always });
    setDone(true);
    if (look === 'danger') {
      haptics.land();
      finish();
    } else {
      // The Stamp calls onLand as it hits; onComplete waits for the stamp to settle.
      timers.current.push(setTimeout(finish, duration.stamp));
    }
  };

  // Only the thud here: the screen plays success or error once its API call answers.
  const onStampLand = () => haptics.land();

  const pressIn = () => {
    pressedIn.current = true;
    if (inert || doneRef.current) return;
    holding.value = true;
    const remaining = holdMs * (1 - progress.value);
    progress.value = withTiming(1, progressTo(remaining), (finished) => {
      if (!finished) return;
      holding.value = false;
      scheduleOnRN(complete);
    });
  };

  const pressOut = () => {
    // The click that follows this release isn't an assistive activation.
    timers.current.push(setTimeout(() => (pressedIn.current = false), duration.tap));
    if (!holding.value || doneRef.current) return;
    holding.value = false;
    const from = progress.value;
    progress.value = withTiming(0, progressTo(from * ROLLBACK_MS));
    if (from <= EARLY_MIN) return;
    haptics.warning();
    if (look === 'danger' && !reduced) {
      const step = { duration: duration.screen / SHAKE.length, easing: ease.standard };
      shake.value = withSequence(...SHAKE.map((x) => withTiming(x, step)));
    }
  };

  // A web click with no press before it comes from assistive tech (or a scripted click).
  const press = () => {
    const wasPress = pressedIn.current;
    pressedIn.current = false;
    if (!wasPress && !inert) complete();
  };

  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'activate' && !inert) complete();
  };

  // Quarter ticks while signing.
  useAnimatedReaction(
    () => Math.floor(progress.value * QUARTERS),
    (q, before) => {
      if (look !== 'sign' || !holding.value || before === null) return;
      if (q > before && q < QUARTERS) scheduleOnRN(haptics.select);
    },
  );

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const shaken = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const ink = useAnimatedProps(() => ({
    strokeDashoffset: SIGNATURE_LENGTH * (1 - progress.value),
  }));

  const text = typeof busy === 'string' && busy ? busy : label;
  const sign = look === 'sign';

  return (
    <View style={styles.wrap}>
      <Animated.View style={shaken}>
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Press and hold to confirm"
          accessibilityState={{ disabled: inert, busy: !!busy }}
          accessibilityActions={[{ name: 'activate' }]}
          onAccessibilityAction={onAccessibilityAction}
          disabled={inert}
          onPressIn={pressIn}
          onPressOut={pressOut}
          onPress={press}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          style={[
            styles.base,
            sign ? styles.sign : styles.danger,
            (disabled || (busy && !done)) && styles.disabled,
          ]}
        >
          <Animated.View
            style={[styles.fill, sign ? styles.signFill : styles.dangerFill, fill]}
            pointerEvents="none"
          />
          {sign ? (
            <>
              <View
                style={styles.signature}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Svg
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${SIGNATURE_BOX.width} ${SIGNATURE_BOX.height}`}
                  preserveAspectRatio="none"
                  style={styles.visible}
                >
                  <AnimatedPath
                    d={SIGNATURE}
                    fill="none"
                    stroke={colors.card.art.yellow}
                    strokeWidth={SIGNATURE_STROKE}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={[SIGNATURE_LENGTH, SIGNATURE_LENGTH]}
                    animatedProps={ink}
                  />
                </Svg>
              </View>
              <Text
                variant="display"
                size="xs"
                color="onBrand"
                accessibilityRole="none"
                numberOfLines={1}
                style={styles.signLabel}
              >
                {text}
              </Text>
            </>
          ) : (
            <>
              <Text weight="semibold" color="action" numberOfLines={1}>
                {text}
              </Text>
              {/* The same label in white, clipped to the fill so it turns white under it. */}
              <Animated.View
                style={[styles.clip, fill]}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <View style={[styles.clipInner, { width: Math.max(0, width - DANGER_BORDER * 2) }]}>
                  <Text weight="semibold" color="onBrand" numberOfLines={1}>
                    {text}
                  </Text>
                </View>
              </Animated.View>
            </>
          )}
        </Pressable>
      </Animated.View>
      {sign && done && (
        <View style={styles.stampLayer} pointerEvents="none">
          <Stamp tone="action" size="sm" onLand={onStampLand} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch' },
  base: {
    minHeight: layout.buttonHeight.lg,
    minWidth: layout.minTouchTarget,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
  },
  sign: {
    backgroundColor: colors.brand,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  danger: {
    backgroundColor: colors.surface,
    borderWidth: DANGER_BORDER,
    borderColor: colors.actionPressed,
    borderRadius: radius.md,
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  signFill: { backgroundColor: colors.card.art.navyDeep },
  dangerFill: { backgroundColor: colors.actionPressed },
  signature: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xs,
    height: SIGNATURE_HEIGHT,
  },
  visible: { overflow: 'visible' },
  signLabel: { textAlign: 'center' },
  clip: { position: 'absolute', left: 0, top: 0, bottom: 0, overflow: 'hidden' },
  clipInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stampLayer: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Disabled controls are exempt from WCAG contrast; dimming keeps them recognisably inactive.
  disabled: { opacity: 0.4 },
});
