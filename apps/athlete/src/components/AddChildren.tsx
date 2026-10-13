import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  ageOn,
  MAX_CHILDREN_PER_REQUEST,
  NewChild,
  type NewChild as NewChildInput,
} from '@team-impact/contracts';
import { colors, layout, spacing } from '@team-impact/ui-tokens';
import { formatDateInput, isCompleteDate } from '@/components/signup';
import { Avatar, Button, Card, Icon, Input, Text } from '@/ui';

/**
 * A parent adds their under-13 children to a join request (PRD §2). Children never log in: when
 * the coach approves, each becomes a profile the parent runs. The birth date only proves the age;
 * the coach sees first name, last initial and age.
 */
export function AddChildren({
  value,
  onChange,
}: {
  value: NewChildInput[];
  onChange: (children: NewChildInput[]) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState<string | undefined>();
  const full = value.length >= MAX_CHILDREN_PER_REQUEST;

  const add = () => {
    const parsed = NewChild.safeParse({ firstName, lastInitial, birthDate });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    onChange([...value, parsed.data]);
    setFirstName('');
    setLastInitial('');
    setBirthDate('');
    setError(undefined);
  };

  return (
    <View style={styles.wrap}>
      <Text variant="display" size="xs" color="brand">
        Add your child
      </Text>
      <Text variant="small" color="secondary">
        Under 13? They don’t get an account. Add them here and they join the team with you when the
        coach approves. You run their profile.
      </Text>

      {value.map((c, i) => (
        <Card key={`${c.firstName}-${i}`} style={styles.child}>
          <Avatar name={`${c.firstName} ${c.lastInitial}`} />
          <View style={styles.grow}>
            <Text weight="semibold">
              {c.firstName} {c.lastInitial.toUpperCase()}.
            </Text>
            <Text variant="caption" weight="medium" color="muted">
              Age {ageOn(c.birthDate)}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${c.firstName}`}
            onPress={() => onChange(value.filter((_, j) => j !== i))}
            style={styles.remove}
          >
            <View style={styles.cross}>
              <Icon name="plus" size={18} color={colors.text.secondary} />
            </View>
          </Pressable>
        </Card>
      ))}

      {!full && (
        <Card>
          <View style={styles.row}>
            <View style={styles.grow}>
              <Input label="First name" value={firstName} onChangeText={setFirstName} />
            </View>
            <View style={styles.initial}>
              <Input
                label="Last initial"
                value={lastInitial}
                onChangeText={(v) => setLastInitial(v.slice(0, 1))}
                autoCapitalize="characters"
                maxLength={1}
              />
            </View>
          </View>
          <Input
            label="Birth date (YYYY-MM-DD)"
            value={birthDate}
            onChangeText={(v) => setBirthDate(formatDateInput(v))}
            placeholder="2017-06-02"
            keyboardType="number-pad"
            maxLength={10}
            error={error}
          />
          <Button
            label="Add child"
            variant="secondary"
            size="sm"
            icon="plus"
            disabled={!firstName.trim() || !lastInitial.trim() || !isCompleteDate(birthDate)}
            onPress={add}
          />
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grow: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.sm },
  initial: { width: layout.buttonHeight.lg * 2 },
  child: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  remove: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cross: { transform: [{ rotate: '45deg' }] },
});
