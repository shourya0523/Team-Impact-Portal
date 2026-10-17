import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, layout, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { LIST_COLORS, fullName, setSaveTarget } from '@/components/recruiter-state';
import { Async, Chip, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Icon, Input, Text } from '@/ui';

const SWATCH = layout.minTouchTarget;

/**
 * "/lists/new" (R5, R6): name, what it's for, colour, and colleagues to share with. Opened from
 * quick review's list picker (`?pick=1`), the new list becomes where swipes save and the recruiter
 * goes back to the deck; otherwise the new list opens.
 */
export default function NewList() {
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const colleagues = useApi(() => api.colleagues());
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [color, setColor] = useState<string>(LIST_COLORS[0].value);
  const [share, setShare] = useState<string[]>([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameError = tried && !name.trim() ? 'Give the list a name.' : undefined;

  const create = async () => {
    setTried(true);
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let list = await api.createList({
        name: name.trim(),
        color,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      if (share.length) list = await api.updateList(list.id, { sharedWithUserIds: share });
      if (pick) {
        setSaveTarget({ id: list.id, name: list.name });
        router.navigate('/review');
      } else {
        router.replace(`/lists/${list.id}`);
      }
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Screen eyebrow="Lists" title="New list" back>
      <Gutter>
        <Input
          label="List name"
          placeholder="e.g. Summer 2027 interns"
          maxLength={60}
          value={name}
          onChangeText={setName}
          error={nameError}
          autoFocus
        />
        <Input
          label="What it’s for (optional)"
          placeholder="Role, team or hiring cycle"
          maxLength={300}
          value={note}
          onChangeText={setNote}
        />
      </Gutter>

      <SectionLabel>Colour</SectionLabel>
      <Gutter>
        <View accessibilityRole="radiogroup" accessibilityLabel="Colour" style={styles.row}>
          {LIST_COLORS.map((c) => {
            const on = c.value === color;
            return (
              <Pressable
                key={c.value}
                onPress={() => setColor(c.value)}
                accessibilityRole="radio"
                accessibilityLabel={c.label}
                accessibilityState={{ checked: on }}
                style={[styles.swatch, { backgroundColor: c.value }, on && styles.swatchOn]}
              >
                {on && <Icon name="check" size={20} color={colors.onBrand.text} strokeWidth={3} />}
              </Pressable>
            );
          })}
        </View>
      </Gutter>

      <SectionLabel>Share with colleagues</SectionLabel>
      <Gutter gap="sm">
        <Async state={colleagues.state}>
          {(people) =>
            people.length ? (
              <View style={styles.row}>
                {people.map((p) => {
                  const on = share.includes(p.id);
                  return (
                    <Chip
                      key={p.id}
                      label={`${on ? '✓' : '+'} ${fullName(p)}`}
                      selected={on}
                      onPress={() =>
                        setShare(on ? share.filter((x) => x !== p.id) : [...share, p.id])
                      }
                    />
                  );
                })}
              </View>
            ) : (
              <Text color="secondary">No colleagues at your company yet.</Text>
            )
          }
        </Async>
        <Text variant="caption" color="secondary">
          Only verified recruiters at your company. Anyone you share with can add and remove
          athletes and sees every note.
        </Text>
      </Gutter>

      <Gutter>
        {error && <ErrorText>{error}</ErrorText>}
        <Button label="Create list" size="lg" disabled={busy} onPress={() => void create()} />
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: {
    width: SWATCH,
    height: SWATCH,
    borderRadius: SWATCH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchOn: { borderWidth: 3, borderColor: colors.ink },
});
