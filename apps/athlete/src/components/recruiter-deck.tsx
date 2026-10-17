import { useCallback, useEffect, useImperativeHandle, useMemo, type Ref } from 'react';
import { StyleSheet, View, type AccessibilityActionEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { CardFace } from '@team-impact/contracts';
import { AthleteCard } from '@team-impact/ui-primitives/native';
import { motion, spacing } from '@team-impact/ui-tokens';
import { toCardData } from '@/components/cardData';
import { fullName } from '@/components/recruiter-state';
import { Badge, timing, useReducedMotion } from '@/ui';

/** 1 saves (right), -1 skips (left). */
export type Swipe = 1 | -1;
export type SwipeCardHandle = { fling: (dir: Swipe) => void };

/** Share of the card's width a drag must pass to count as a decision. */
const DECIDE_AT = 0.33;
/** Pixels of drag per degree of rotation, capped at the card tilt token. */
const PX_PER_DEGREE = 18;
/** Stamps sit slightly askew, like the mockup's; flat under reduced motion. */
const STAMP_DEGREES = 12;

/**
 * One card in quick review. Drag right to save, left to skip; the parent's Save and Skip buttons
 * call `fling` so the swipe is never the only way. The card face is display-only here (its own
 * flip gesture is off), so the drag belongs to the deck; the full card screen flips.
 *
 * Reduced motion: the card never moves or tilts. Dragging fades it and its stamp, and a decision
 * fades it out instead of throwing it off screen.
 */
export function SwipeCard({
  ref,
  card,
  width,
  saveTo,
  onDecide,
}: {
  ref?: Ref<SwipeCardHandle>;
  card: CardFace;
  width: number;
  /** The list a save goes to, for the accessibility label. */
  saveTo: string;
  onDecide: (dir: Swipe) => void;
}) {
  const reduced = useReducedMotion();
  const tx = useSharedValue(0);
  const gone = useSharedValue(0);
  const appear = useSharedValue(0);
  const decided = useSharedValue(false);
  const data = useMemo(() => toCardData(card), [card]);

  useEffect(() => {
    appear.value = withTiming(1, timing.small);
  }, [appear]);

  const threshold = width * DECIDE_AT;
  const away = width * 1.5;

  const gesture = useMemo(() => {
    const fling = (dir: Swipe) => {
      'worklet';
      if (decided.value) return;
      decided.value = true;
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) scheduleOnRN(onDecide, dir);
      };
      if (reduced) gone.value = withTiming(1, timing.small, done);
      else tx.value = withTiming(dir * away, timing.small, done);
    };
    return Gesture.Pan()
      .activeOffsetX([-10, 10])
      .failOffsetY([-14, 14])
      .onUpdate((e) => {
        if (!decided.value) tx.value = e.translationX;
      })
      .onEnd((e) => {
        if (e.translationX > threshold) fling(1);
        else if (e.translationX < -threshold) fling(-1);
        else tx.value = withTiming(0, timing.small);
      });
  }, [reduced, threshold, away, tx, gone, decided, onDecide]);

  // Buttons and screen-reader actions: show the stamp for the choice, then leave as a swipe does.
  const fling = useCallback(
    (dir: Swipe) => {
      if (decided.value) return;
      decided.value = true;
      const done = (finished?: boolean) => {
        'worklet';
        if (finished) scheduleOnRN(onDecide, dir);
      };
      if (reduced) {
        tx.value = withTiming(dir * threshold, timing.tap);
        gone.value = withTiming(1, timing.small, done);
      } else {
        tx.value = withTiming(dir * away, timing.screen, done);
      }
    },
    [reduced, threshold, away, tx, gone, decided, onDecide],
  );
  useImperativeHandle(ref, () => ({ fling }), [fling]);

  const cardStyle = useAnimatedStyle(() => {
    if (reduced) {
      const drag = Math.min(Math.abs(tx.value) / away, 1);
      return { opacity: appear.value * (1 - gone.value) * (1 - drag * 0.6), transform: [] };
    }
    const deg = Math.max(
      -motion.tilt.maxDegrees,
      Math.min(motion.tilt.maxDegrees, tx.value / PX_PER_DEGREE),
    );
    return {
      opacity: appear.value,
      transform: [{ translateX: tx.value }, { rotate: `${deg}deg` }],
    };
  });
  const saveStamp = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, tx.value / threshold)),
  }));
  const skipStamp = useAnimatedStyle(() => ({
    opacity: Math.max(0, Math.min(1, -tx.value / threshold)),
  }));

  const onAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'save') fling(1);
    if (e.nativeEvent.actionName === 'skip') fling(-1);
  };

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="none"
        accessibilityLabel={`${fullName(card)}. Swipe right to save to ${saveTo}, left to skip, or use the buttons below.`}
        accessibilityActions={[
          { name: 'save', label: `Save to ${saveTo}` },
          { name: 'skip', label: 'Skip' },
        ]}
        onAccessibilityAction={onAction}
        style={[cardStyle, { width }]}
      >
        <View style={styles.inert}>
          <AthleteCard athlete={data} width={width} />
        </View>
        <Animated.View
          style={[
            styles.stamp,
            styles.inert,
            styles.left,
            !reduced && { transform: [{ rotate: `-${STAMP_DEGREES}deg` }] },
            saveStamp,
          ]}
        >
          <Badge caps variant="success" icon="heart" label="Save" />
        </Animated.View>
        <Animated.View
          style={[
            styles.stamp,
            styles.inert,
            styles.right,
            !reduced && { transform: [{ rotate: `${STAMP_DEGREES}deg` }] },
            skipStamp,
          ]}
        >
          <Badge caps variant="ink" label="Skip" />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  /** The card face's own flip gesture is off here: the drag belongs to the deck. */
  inert: { pointerEvents: 'none' },
  stamp: { position: 'absolute', top: spacing['3xl'] },
  left: { left: spacing.md },
  right: { right: spacing.md },
});
