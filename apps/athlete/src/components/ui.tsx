import { Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, radius, spacing } from '@team-impact/ui-tokens';
import type { Loadable } from '@/hooks/useApi';

/**
 * The app shell's building blocks: a titled scrolling screen, cards, pills and buttons, all from
 * the shared tokens. Feature tickets restyle these against the hi-fi screens.
 */
export function Screen({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title }} />
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actions && <View style={styles.actions}>{actions}</View>}
      {children}
    </ScrollView>
  );
}

export function Card({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.7 }]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={styles.card}>{children}</View>
  );
}

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'brand' | 'warn';
}) {
  const palette = {
    neutral: { bg: colors.surface, fg: colors.textMuted },
    brand: { bg: '#E7EDFB', fg: colors.primary },
    warn: { bg: '#FFF4D6', fg: '#7A5200' },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }]}>
      <Text style={[styles.pillText, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[styles.buttonText, { color: primary ? colors.primaryContrast : colors.primary }]}
      >
        {label}
      </Text>
    </Pressable>
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
  if (state.status === 'loading') return <ActivityIndicator style={{ marginTop: spacing.lg }} />;
  if (state.status === 'error') {
    return (
      <Text style={styles.error} accessibilityRole="alert">
        Couldn’t load this: {state.error.message}
      </Text>
    );
  }
  return <>{children(state.data)}</>;
}

export const text = StyleSheet.create({
  strong: { fontSize: fontSize.md, fontWeight: '700', color: colors.text },
  body: { fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  muted: { fontSize: fontSize.sm, color: colors.textMuted },
  section: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
  },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.sm + 4, paddingBottom: spacing.xl },
  title: { fontSize: fontSize.xl, fontWeight: '800', color: colors.primary },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted, marginTop: -spacing.xs },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs + 2,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  button: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  buttonText: { fontSize: fontSize.sm + 1, fontWeight: '700' },
  error: { color: colors.danger, fontSize: fontSize.md },
});
