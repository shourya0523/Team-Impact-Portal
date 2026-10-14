import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import type { Loadable } from '@/hooks/useApi';
import { Icon, Text, type IconName } from '@/ui';

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
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: SCROLL_END,
          gap: spacing.md,
        }}
      >
        <View style={styles.header}>
          {back && <IconButton icon="back" label="Back" onPress={() => router.back()} />}
          <View style={styles.headerText}>
            {eyebrow && (
              <Text variant="eyebrow" color="action">
                {eyebrow}
              </Text>
            )}
            <Text variant="display" size="lg" color="brand" numberOfLines={2}>
              {title}
            </Text>
          </View>
          {right}
        </View>
        {children}
      </ScrollView>
      {floating}
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

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
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

/** A segmented control, like the design's All / My team / Going. */
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
            onPress={() => onChange(o.value)}
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
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
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
