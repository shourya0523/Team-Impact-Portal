import { Pressable, StyleSheet, View } from 'react-native';
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
import { Async } from '@/components/ui';
import {
  DEFAULT_LIST_NAME,
  setSaveTarget,
  useReviewState,
  type SaveTarget,
} from '@/components/recruiter-state';
import { useApi } from '@/hooks/useApi';
import { Button, Icon, Sheet, Text } from '@/ui';

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
  choiceOn: { borderColor: colors.brand, backgroundColor: colors.brandTint },
  grow: { flex: 1, gap: spacing.xs },
});
