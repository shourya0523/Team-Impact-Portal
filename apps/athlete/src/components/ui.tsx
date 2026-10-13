import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Role } from '@team-impact/contracts';
import type { Loadable } from '@/hooks/useApi';
import { c, font, initials, ROLE_COLOR } from '@/theme';
import { Icon, type IconName } from './Icon';

/**
 * The app's building blocks, from the approved design canvas. Screens own their header (eyebrow
 * plus a condensed uppercase title), so the stack's native header is hidden on them.
 */
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
    <View style={{ flex: 1, backgroundColor: c.ground }}>
      <Stack.Screen options={{ headerShown: false, title }} />
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 120, gap: 16 }}
      >
        <View style={styles.header}>
          {back && <IconButton icon="back" label="Back" onPress={() => router.back()} />}
          <View style={{ flex: 1, gap: 2 }}>
            {eyebrow && <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>}
            <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
              {title.toUpperCase()}
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
export function Gutter({ children, gap = 12 }: { children: ReactNode; gap?: number }) {
  return <View style={{ paddingHorizontal: 16, gap }}>{children}</View>;
}

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
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: c.lineSoft }]}
    >
      <Icon name={icon} size={20} color={c.ink} />
      {dot && <View style={styles.dot} />}
    </Pressable>
  );
}

export function Avatar({
  firstName,
  lastName,
  role,
  size = 40,
  ring,
}: {
  firstName: string;
  lastName: string;
  role: Role;
  size?: number;
  /** Border colour, for overlapping facepiles. */
  ring?: string;
}) {
  const { bg, fg } = ROLE_COLOR[role];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
      }}
    >
      <Text style={{ color: fg, fontFamily: font.bold, fontSize: size * 0.35 }}>
        {initials(firstName, lastName)}
      </Text>
    </View>
  );
}

type ButtonKind = 'red' | 'navy' | 'ink' | 'outline' | 'white' | 'onNavy';

const BUTTON: Record<ButtonKind, { bg: string; fg: string; border?: string }> = {
  red: { bg: c.red, fg: '#ffffff' },
  navy: { bg: c.navy, fg: '#ffffff' },
  ink: { bg: c.ink, fg: '#ffffff' },
  outline: { bg: c.surface, fg: c.ink, border: c.line },
  white: { bg: '#ffffff', fg: c.navy },
  onNavy: { bg: 'transparent', fg: '#ffffff', border: c.onNavyMuted },
};

export function Button({
  label,
  onPress,
  kind = 'red',
  icon,
  size = 'md',
  disabled,
  stretch,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  stretch?: boolean;
}) {
  const k = BUTTON[kind];
  const height = { sm: 40, md: 46, lg: 56 }[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        {
          minHeight: height,
          paddingHorizontal: size === 'sm' ? 14 : 18,
          borderRadius: height / 2,
          backgroundColor: k.bg,
          borderWidth: k.border ? 1 : 0,
          borderColor: k.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          alignSelf: stretch ? 'stretch' : 'auto',
          flexGrow: stretch ? 1 : 0,
        },
        (pressed || disabled) && { opacity: 0.65 },
      ]}
    >
      {icon && <Icon name={icon} size={16} color={k.fg} strokeWidth={2.4} />}
      <Text style={{ color: k.fg, fontFamily: font.bold, fontSize: size === 'lg' ? 17 : 14 }}>
        {label}
      </Text>
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
      <Text style={{ fontFamily: font.semibold, fontSize: 14, color: selected ? '#fff' : c.ink }}>
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
            style={[styles.segment, on && { backgroundColor: c.surface }]}
          >
            <Text
              style={{
                fontFamily: on ? font.bold : font.semibold,
                fontSize: 14,
                color: on ? c.ink : c.text2,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Card({
  children,
  onPress,
  style,
  label,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  label?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.8 }]}
    >
      {children}
    </Pressable>
  );
}

/** Small uppercase badge, e.g. COACH or OFFICIAL. */
export function Tag({
  label,
  bg = c.navyTint,
  fg = c.navy,
  icon,
}: {
  label: string;
  bg?: string;
  fg?: string;
  icon?: IconName;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={12} color={fg} strokeWidth={2.6} />}
      <Text style={{ color: fg, fontFamily: font.bold, fontSize: 11, letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.section}>{children.toUpperCase()}</Text>;
}

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
      style={{ flexDirection: 'row', gap: 6, flex: 1 }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            backgroundColor: i < step ? c.red : onNavy ? c.navyRaised : c.line,
          }}
        />
      ))}
    </View>
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
    return <ActivityIndicator color={c.navy} style={{ marginTop: 24 }} />;
  if (state.status === 'error') {
    return (
      <Text style={styles.error} accessibilityRole="alert">
        Couldn’t load this: {state.error.message}
      </Text>
    );
  }
  return <>{children(state.data)}</>;
}

export const type = StyleSheet.create({
  name: { fontFamily: font.bold, fontSize: 15, color: c.ink },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 23, color: c.ink },
  meta: { fontFamily: font.medium, fontSize: 12, color: c.muted },
  small: { fontFamily: font.body, fontSize: 13, lineHeight: 18, color: c.text2 },
  display: { fontFamily: font.display, color: c.navy },
});

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 20 },
  eyebrow: { fontFamily: font.bold, fontSize: 12, letterSpacing: 1.9, color: c.red },
  title: { fontFamily: font.display, fontSize: 44, lineHeight: 42, color: c.navy },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 9,
    right: 10,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.red,
    borderWidth: 2,
    borderColor: '#fff',
  },
  chip: { minHeight: 36, paddingHorizontal: 16, borderRadius: 18, justifyContent: 'center' },
  chipOn: { backgroundColor: c.ink },
  chipOff: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  segmented: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 16,
    backgroundColor: c.track,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.lineSoft,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  section: {
    fontFamily: font.bold,
    fontSize: 13,
    letterSpacing: 1.5,
    color: c.text2,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  error: { color: c.danger, fontFamily: font.medium, fontSize: 15, paddingHorizontal: 20 },
});
