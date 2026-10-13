import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { timing } from './motion';
import { Text } from './Text';
import { useReducedMotion } from './useReducedMotion';

export type SheetProps = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

/** Bottom sheet. Slides up and fades the scrim; under reduced motion it only fades. */
export function Sheet({ visible, title, onClose, children }: SheetProps) {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withTiming(1, timing.screen);
    } else {
      progress.value = withTiming(0, timing.small, (done) => {
        if (done) setMounted(false);
      });
    }
  }, [visible, progress]);

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value * 0.5 }));
  const panel = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: reduced ? 0 : (1 - progress.value) * spacing['3xl'] }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrim]} />
        </Pressable>
        <Animated.View accessibilityViewIsModal style={[styles.panel, panel]}>
          <Text variant="display" size="sm">
            {title}
          </Text>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: colors.ink },
  panel: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: layout.maxContentWidth,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
