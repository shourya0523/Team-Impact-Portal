import { useEffect, type ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { spacing } from '@team-impact/ui-tokens';
import { timing } from './motion';
import { useReducedMotion } from './useReducedMotion';

/** Fade and slide up on mount. Under reduced motion the slide is dropped and only the fade stays. */
export function FadeSlideIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withTiming(1, timing.screen));
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * spacing.md }],
  }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
