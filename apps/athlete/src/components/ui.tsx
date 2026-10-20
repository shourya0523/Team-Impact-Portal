import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { G, Path } from 'react-native-svg';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import type { Loadable } from '@/hooks/useApi';
import { haptics, Icon, Text, type IconName } from '@/ui';

/**
 * App-level composites built on the src/ui primitives. Screens own their header (eyebrow plus a
 * condensed uppercase title), so the stack's native header is hidden on them.
 */

/** Room under scrolling content for the tab bar and the floating compose button. */
export const SCROLL_END = spacing['4xl'] + spacing.xl;

export function Screen({
  eyebrow,
  title,
  right,
  back,
  children,
  floating,
}: {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  /** Show a round back button before the title. */
  back?: boolean;
  children?: ReactNode;
  /** Pinned over the content, e.g. the compose button. */
  floating?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title }} />
      {/* Light status-bar text over the dark header band. */}
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: SCROLL_END, gap: spacing.md }}>
        <View style={styles.band}>
          <Contours />
          <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
            {back && <IconButton icon="back" label="Back" onPress={() => router.back()} />}
            <View style={styles.headerText}>
              {eyebrow && (
                <Text variant="eyebrow" style={styles.eyebrowOnBand}>
                  {eyebrow}
                </Text>
              )}
              <Text variant="display" size="lg" color="onBrand" numberOfLines={2}>
                {title}
              </Text>
            </View>
            {right}
          </View>
          <View style={styles.stripe} accessibilityElementsHidden importantForAccessibility="no">
            <View style={[styles.stripeHalf, { backgroundColor: colors.brand }]} />
            <View style={[styles.stripeHalf, { backgroundColor: colors.action }]} />
          </View>
        </View>
        {children}
      </ScrollView>
      {floating}
    </View>
  );
}

/** Stroke weight of the header's contour lines. */
const CONTOUR_STROKE = 1.1;

/**
 * Topographic contour lines, the Baseball Card's own motif (ui-primitives patterns.ts), drawn in
 * the top-right of the header band. Decorative only.
 */
function Contours() {
  return (
    // The View hides it from assistive tech; react-native-svg would pass those props to the DOM.
    <View
      style={styles.contours}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={300} height={170} viewBox="0 0 300 170">
        <G
          fill="none"
          stroke={colors.card.art.blueBright}
          strokeOpacity={0.3}
          strokeWidth={CONTOUR_STROKE}
        >
          <Path d="M250 20c40 10 55 60 25 90s-95 30-120 0 5-100 95-90z" />
          <Path d="M248 36c30 8 40 46 18 68s-72 22-90 0 4-76 72-68z" />
          <Path d="M246 52c20 6 26 30 12 45s-48 14-60 0 3-50 48-45z" />
          <Path d="M244 68c10 3 13 15 6 22s-24 7-30 0 2-25 24-22z" />
          <Path d="M252 4c55 12 78 84 36 124S152 170 120 128 140-12 252 4z" />
          <Path d="M256-14c70 16 104 110 52 160S128 196 88 142 120-34 256-14z" />
        </G>
      </Svg>
    </View>
  );
}

/** Horizontal padding for screen content. */
export function Gutter({
  children,
  gap = 'md',
}: {
  children: ReactNode;
  gap?: keyof typeof spacing;
}) {
  return <View style={[styles.gutter, { gap: spacing[gap] }]}>{children}</View>;
}

const DOT = 10;

export function IconButton({
  icon,
  label,
  onPress,
  dot,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  dot?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: colors.lineSoft }]}
    >
      <Icon name={icon} size={20} color={colors.ink} />
      {dot && <View style={styles.dot} />}
    </Pressable>
  );
}

/** How long after a press a chip waits for its `selected` to change before giving up. */
const CHANGE_WINDOW_MS = 500;

/**
 * A filter or choice chip. Plays a selection tick when pressing it actually changes its
 * `selected` (so an action chip like "Edit filters", or re-pressing the chosen one, stays quiet).
 */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const pressedFrom = useRef<boolean | null>(null);
  useEffect(() => {
    if (pressedFrom.current !== null && pressedFrom.current !== selected) haptics.select();
    pressedFrom.current = null;
  }, [selected]);
  return (
    <Pressable
      onPress={() => {
        pressedFrom.current = selected;
        setTimeout(() => (pressedFrom.current = null), CHANGE_WINDOW_MS);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.chipOn : styles.chipOff]}
    >
      <Text variant="small" weight="semibold" color={selected ? 'onBrand' : 'ink'}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A segmented control, like the design's All / My team / Going. A change plays a selection tick. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (on) return;
              haptics.select();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: colors.surface }]}
          >
            <Text variant="small" weight="semibold" color={on ? 'ink' : 'secondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="eyebrow" color="secondary" style={styles.section}>
      {children}
    </Text>
  );
}

const BAR = 4;

/** Step bars for the join flow. */
export function Progress({
  step,
  total,
  onNavy,
}: {
  step: number;
  total: number;
  onNavy?: boolean;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={styles.progress}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.bar,
            {
              backgroundColor: i < step ? colors.action : onNavy ? colors.brandRaised : colors.line,
            },
          ]}
        />
      ))}
    </View>
  );
}

/** An error line under a form or list. */
export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Text weight="medium" color="danger" accessibilityRole="alert">
      {children}
    </Text>
  );
}

/** Loading and error states, the same on every screen. */
export function Async<T>({
  state,
  children,
}: {
  state: Loadable<T>;
  children: (data: T) => ReactNode;
}) {
  if (state.status === 'loading')
    return <ActivityIndicator color={colors.brand} style={styles.loading} />;
  if (state.status === 'error') {
    return (
      <View style={styles.gutter}>
        <ErrorText>Couldn’t load this: {state.error.message}</ErrorText>
      </View>
    );
  }
  return <>{children(state.data)}</>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ground },
  // Floodlight header: an ink band with contour lines, ending in a navy and red stripe.
  band: { backgroundColor: colors.outline, overflow: 'hidden' },
  contours: { position: 'absolute', top: 0, right: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  eyebrowOnBand: { color: colors.highlight },
  stripe: { flexDirection: 'row', height: spacing.xs + 1 },
  stripeHalf: { flex: 1 },
  headerText: { flex: 1, gap: spacing.xs },
  gutter: { paddingHorizontal: spacing.md },
  iconButton: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    borderRadius: layout.minTouchTarget / 2,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.action,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  chip: {
    minHeight: layout.chipHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink },
  chipOff: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  segmented: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: colors.lineSoft,
  },
  segment: {
    flex: 1,
    minHeight: layout.chipHeight,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.xs },
  progress: { flexDirection: 'row', gap: spacing.xs, flex: 1 },
  bar: { flex: 1, height: BAR, borderRadius: BAR / 2 },
  loading: { marginTop: spacing.lg },
});
