import { router, Stack } from 'expo-router';
import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { describeError, isNotFound } from '@/api/errors';
import type { Loadable } from '@/hooks/useApi';
import { Button, Icon, Text, type IconName } from '@/ui';

/**
 * App-level composites built on the src/ui primitives. Screens own their header (eyebrow plus a
 * condensed uppercase title), so the stack's native header is hidden on them.
 */

/** Room under scrolling content for the tab bar and the floating compose button. */
export const SCROLL_END = spacing['4xl'] + spacing.xl;

type ScreenProps = {
  eyebrow?: string;
  title: string;
  right?: ReactNode;
  /** Show a round back button before the title. */
  back?: boolean;
  /** Pinned over the content, e.g. the compose button. */
  floating?: ReactNode;
};

function ScreenHeader({ eyebrow, title, right, back }: ScreenProps) {
  return (
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
  );
}

/** Same top and bottom room on every screen, scrolling or list. */
const useScreenContent = () => {
  const insets = useSafeAreaInsets();
  return { paddingTop: insets.top + spacing.md, paddingBottom: SCROLL_END, gap: spacing.md };
};

export function Screen({ children, ...props }: ScreenProps & { children?: ReactNode }) {
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: props.title }} />
      <ScrollView contentContainerStyle={useScreenContent()}>
        <ScreenHeader {...props} />
        {children}
      </ScrollView>
      {props.floating}
    </View>
  );
}

/**
 * A screen that is one long list loaded a page at a time (the home feed): `Screen`'s header, then
 * `top` (filters and the like), then the items, each in the gutter. Only the items on screen are
 * rendered. `onEndReached` asks for the next page, pulling down calls `onRefresh`; `empty` shows
 * while there are no items (the first load, its error, or nothing to show), `footer` after them.
 */
export function ScreenList<T extends { id: string }>({
  data,
  renderItem,
  top,
  empty,
  footer,
  onEndReached,
  refreshing = false,
  onRefresh,
  ...props
}: ScreenProps & {
  data: readonly T[];
  renderItem: (item: T) => ReactElement;
  top?: ReactNode;
  empty?: ReactElement;
  footer?: ReactElement | false | null;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: props.title }} />
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <View style={styles.gutter}>{renderItem(item)}</View>}
        ListHeaderComponent={
          <View style={styles.listTop}>
            <ScreenHeader {...props} />
            {top}
          </View>
        }
        ListEmptyComponent={empty}
        ListFooterComponent={footer || null}
        onEndReached={onEndReached}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={useScreenContent()}
      />
      {props.floating}
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

/**
 * Nothing to show, said kindly: the mockups' dashed box with a title, a line on why, and maybe a
 * way forward. For empty lists and for a whole screen that couldn't load.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <Text variant="display" size="xs" color="brand" style={styles.center}>
        {title}
      </Text>
      {children && (
        <Text variant="small" color="secondary" style={styles.center}>
          {children}
        </Text>
      )}
      {action && (
        <Button label={action.label} variant="secondary" size="sm" onPress={action.onPress} />
      )}
    </View>
  );
}

type PageFailure = { error: Error; during: 'more' | 'refresh' } | null;

/**
 * Under a paged list: a spinner while the next page loads, why it failed with a way to try again,
 * or a line saying that's everything. The items already shown stay above it. A failed refresh
 * shows at the top instead (`RefreshError`), where the pull was.
 */
export function PageFooter({
  loading,
  failure,
  caughtUp,
  onRetry,
}: {
  loading: boolean;
  failure: PageFailure;
  caughtUp: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <ActivityIndicator
        color={colors.brand}
        style={styles.loading}
        accessibilityLabel="Loading more posts"
      />
    );
  }
  if (failure?.during === 'more') {
    return (
      <View style={[styles.gutter, styles.footer]}>
        <ErrorText>Couldn’t load more: {describeError(failure.error)}</ErrorText>
        <Button label="Try again" variant="secondary" size="sm" onPress={onRetry} />
      </View>
    );
  }
  if (!caughtUp) return null;
  return (
    <Text variant="small" color="secondary" style={[styles.center, styles.caughtUp]}>
      You’re all caught up
    </Text>
  );
}

/** Above a paged list: a pull to refresh that failed. What's shown stays, and paging still works. */
export function RefreshError({ failure, onRetry }: { failure: PageFailure; onRetry: () => void }) {
  if (failure?.during !== 'refresh') return null;
  return (
    <View style={[styles.gutter, styles.footer]}>
      <ErrorText>Couldn’t refresh: {describeError(failure.error)}</ErrorText>
      <Button label="Try again" variant="secondary" size="sm" onPress={onRetry} />
    </View>
  );
}

/**
 * Loading and error states, the same on every screen. Opt in per screen: `loading` replaces the
 * spinner (the feeds' skeleton), `onRetry` turns the error line into a box with "Try again", and
 * `notFound` replaces the error for a 404 (something removed or hidden from you).
 */
export function Async<T>({
  state,
  children,
  loading,
  onRetry,
  notFound,
}: {
  state: Loadable<T>;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  onRetry?: () => void;
  notFound?: ReactNode;
}) {
  if (state.status === 'loading')
    return loading ?? <ActivityIndicator color={colors.brand} style={styles.loading} />;
  if (state.status === 'error') {
    if (notFound && isNotFound(state.error)) return <>{notFound}</>;
    return (
      <View style={styles.gutter}>
        {onRetry ? (
          <EmptyState title="Couldn’t load this" action={{ label: 'Try again', onPress: onRetry }}>
            {describeError(state.error)}
          </EmptyState>
        ) : (
          <ErrorText>Couldn’t load this: {describeError(state.error)}</ErrorText>
        )}
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
  listTop: { gap: spacing.md },
  footer: { gap: spacing.sm, alignItems: 'flex-start' },
  empty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  center: { textAlign: 'center' },
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
  caughtUp: { marginTop: spacing.lg },
});
