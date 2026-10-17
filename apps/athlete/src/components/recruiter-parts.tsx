import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { CardFace } from '@team-impact/contracts';
import {
  colors,
  layout,
  onTeamColor,
  radius,
  resolveTeamColor,
  spacing,
} from '@team-impact/ui-tokens';
import { api } from '@/api';
import { DrawnCheck } from '@/components/game-day';
import { Async } from '@/components/ui';
import {
  DEFAULT_LIST_NAME,
  setSaveTarget,
  useReviewState,
  type SaveTarget,
} from '@/components/recruiter-state';
import { useApi } from '@/hooks/useApi';
import { Button, Icon, Sheet, springConfig, Text, timing, useReducedMotion } from '@/ui';

/** The jersey number on the team's colour, like the card's corner badge. */
export function JerseyTile({ card }: { card: Pick<CardFace, 'jerseyNumber' | 'team'> }) {
  const bg = resolveTeamColor(card.team?.color);
  return (
    <View style={[styles.tile, { backgroundColor: bg }]} aria-hidden>
      <Text variant="display" size="xs" style={{ color: onTeamColor(bg) }}>
        {card.jerseyNumber ?? '–'}
      </Text>
    </View>
  );
}

/** A list's colour, chosen by the recruiter (runtime data from the API, always a token value). */
export function ListDot({ color }: { color: string }) {
  return <View aria-hidden style={[styles.dot, { backgroundColor: color }]} />;
}

/**
 * "Save swipes to": pick the list a right swipe saves to. "Saved" is the default and is made on
 * the first save if the recruiter has no list by that name.
 */
export function ListPickerSheet({
  visible,
  onClose,
  onNew,
}: {
  visible: boolean;
  onClose: () => void;
  onNew: () => void;
}) {
  const { target } = useReviewState();
  const { state } = useApi(() => (visible ? api.lists() : Promise.resolve([])), [visible]);
  const pick = (t: SaveTarget) => {
    setSaveTarget(t);
    onClose();
  };
  return (
    <Sheet visible={visible} title="Save swipes to" onClose={onClose}>
      <Async state={state}>
        {(lists) => {
          const saved = lists.find((l) => l.name.toLowerCase() === DEFAULT_LIST_NAME.toLowerCase());
          const others = lists.filter((l) => l !== saved);
          const isOn = (id: string | null) =>
            id === null ? !target || target.id === saved?.id : target?.id === id;
          return (
            <View style={styles.choices}>
              <Choice
                label={DEFAULT_LIST_NAME}
                detail={saved ? count(saved.athleteCount) : 'Made on your first save'}
                color={saved?.color ?? colors.brand}
                selected={isOn(null)}
                onPress={() => pick(saved ? { id: saved.id, name: saved.name } : null)}
              />
              {others.map((l) => (
                <Choice
                  key={l.id}
                  label={l.name}
                  detail={count(l.athleteCount)}
                  color={l.color}
                  selected={isOn(l.id)}
                  onPress={() => pick({ id: l.id, name: l.name })}
                />
              ))}
              <Button label="New list" icon="plus" variant="secondary" onPress={onNew} />
            </View>
          );
        }}
      </Async>
    </Sheet>
  );
}

/** A save that landed, for the list chip: `seq` goes up once per save. */
export type Landed = { seq: number; listId: string; count: number };

/** How far the list chip grows when a save lands, before it springs back. */
const BUMP = 1.12;

/**
 * "Deal to list": the chip that names the list a right swipe saves to, with its colour and how
 * many athletes are on it. Opens the list picker. When a save lands (`landed.seq` goes up) the
 * count updates and the chip bumps (spring); under reduced motion only the count changes.
 */
export function SaveListChip({ landed, onPress }: { landed: Landed | null; onPress: () => void }) {
  const { target } = useReviewState();
  const reduced = useReducedMotion();
  const key = target?.id ?? DEFAULT_LIST_NAME;
  const { state } = useApi(() => api.lists(), [key]);
  const lists = state.status === 'ready' ? state.data : [];
  const list = target
    ? lists.find((l) => l.id === target.id)
    : lists.find((l) => l.name.toLowerCase() === DEFAULT_LIST_NAME.toLowerCase());
  const name = target?.name ?? list?.name ?? DEFAULT_LIST_NAME;
  const n =
    landed && (!list || landed.listId === list.id) ? landed.count : (list?.athleteCount ?? 0);

  const scale = useSharedValue(1);
  const seen = useRef(landed?.seq ?? 0);
  useEffect(() => {
    if (!landed || landed.seq === seen.current) return;
    seen.current = landed.seq;
    if (!reduced)
      scale.value = withSequence(withTiming(BUMP, timing.tap), withSpring(1, springConfig));
  }, [landed, reduced, scale]);
  const bump = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={bump}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Swipe right saves to ${name}, ${count(n)}. Change list`}
        style={({ pressed }) => [styles.listChip, pressed && { backgroundColor: colors.lineSoft }]}
      >
        <ListDot color={list?.color ?? colors.brand} />
        <Text variant="small" weight="semibold">
          {name}
        </Text>
        <Text variant="display" size="xs" color="brand" accessibilityRole="none">
          {n}
        </Text>
        <Text variant="small" weight="semibold" color="secondary">
          ▾
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** How long the button stays "Saved" before it's ready for the next card. */
const SAVED_HOLD_MS = 1200;
const SAVED_CHECK = 18;

/**
 * Wraps a filled Save button. Each time `flash` goes up (a save landed), a green "Saved" face
 * with a check that draws itself fades in over the button, holds briefly, then fades back so the
 * button is ready for the next card. Touches pass through to the button underneath. Under reduced
 * motion the colour still fades and the check appears whole.
 */
export function SavedFlash({
  flash,
  label = 'Saved',
  size = 'md',
  stretch,
  children,
}: {
  flash: number;
  label?: string;
  size?: keyof typeof layout.buttonHeight;
  stretch?: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  const seen = useRef(flash);
  const fade = useSharedValue(0);
  useEffect(() => {
    const fresh = flash > seen.current;
    seen.current = flash;
    if (!fresh) return; // a reset counter is not a save
    setOn(true);
    const t = setTimeout(() => setOn(false), SAVED_HOLD_MS);
    return () => clearTimeout(t);
  }, [flash]);
  useEffect(() => {
    // A colour fade, so it runs under reduced motion too.
    fade.value = withTiming(on ? 1 : 0, { ...timing.small, reduceMotion: ReduceMotion.Never });
  }, [on, fade]);
  const shown = useAnimatedStyle(() => ({ opacity: fade.value }));

  return (
    <View style={stretch && styles.stretch}>
      {children}
      <Animated.View aria-hidden style={[styles.savedLip, shown]}>
        <View style={[styles.savedFace, { minHeight: layout.buttonHeight[size] }]}>
          <DrawnCheck drawn={on} size={SAVED_CHECK} color={colors.onBrand.text} reduced={reduced} />
          <Text variant={size === 'sm' ? 'small' : 'body'} weight="semibold" color="onBrand">
            {label}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export const count = (n: number) => `${n} ${n === 1 ? 'athlete' : 'athletes'}`;

function Choice({
  label,
  detail,
  color,
  selected,
  onPress,
}: {
  label: string;
  detail: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${label}, ${detail}`}
      style={({ pressed }) => [
        styles.choice,
        selected && styles.choiceOn,
        pressed && { backgroundColor: colors.lineSoft },
      ]}
    >
      <ListDot color={color} />
      <View style={styles.grow}>
        <Text weight="semibold" color={selected ? 'brand' : 'ink'}>
          {label}
        </Text>
        <Text variant="small" color="secondary">
          {detail}
        </Text>
      </View>
      {selected && <Icon name="check" size={20} color={colors.brand} />}
    </Pressable>
  );
}

const DOT = spacing.md;

const styles = StyleSheet.create({
  tile: {
    width: layout.avatar.md,
    height: layout.avatar.md * 1.2,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  choices: { gap: spacing.sm },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.buttonHeight.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  listChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.chipHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  // A row cell like Button's own `stretch`; the column lets a stretched Button fill it.
  stretch: { flexGrow: 1, flexBasis: 0, flexDirection: 'column' },
  // The Saved face sits on an ink lip, like the filled button it covers.
  savedLip: {
    ...StyleSheet.absoluteFill,
    pointerEvents: 'none',
    borderRadius: radius.md,
    backgroundColor: colors.ink,
  },
  savedFace: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.success.text,
  },
  choiceOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  grow: { flex: 1, gap: spacing.xs },
});
