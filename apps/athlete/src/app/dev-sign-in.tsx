import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Role } from '@team-impact/contracts';
import { api } from '@/api';
import { ROLE_LABEL } from '@/components/format';
import { colors, spacing } from '@team-impact/ui-tokens';
import { ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useRole } from '@/navigation/role';
import { firstTab } from '@/navigation/tabs';
import { Avatar, Card, Icon, Text } from '@/ui';

const MEMBERS: { role: Role; first: string; last: string; who: string }[] = [
  { role: 'athlete', first: 'Jordan', last: 'Lee', who: 'Tufts Women’s Soccer' },
  { role: 'parent', first: 'Lisa', last: 'Gomez', who: 'Parent of Mateo, 9' },
  { role: 'teen', first: 'Noah', last: 'Kim', who: 'Teammate, 14' },
  { role: 'coach', first: 'Dana', last: 'Rivera', who: 'Head coach' },
  { role: 'alumni_athlete', first: 'Priya', last: 'Shah', who: 'Alumni athlete' },
  { role: 'alumni_mentor', first: 'Chris', last: 'Doyle', who: 'Alumni mentor' },
  { role: 'recruiter', first: 'Elena', last: 'Ward', who: 'Northbeam Capital' },
  { role: 'staff', first: 'Maya', last: 'Chen', who: 'Team Impact staff' },
];

const NEWCOMERS: { role: Role; first: string; last: string }[] = [
  { role: 'athlete', first: 'Leo', last: 'Grant' },
  { role: 'parent', first: 'Rosa', last: 'Diaz' },
  { role: 'teen', first: 'Eli', last: 'Ward' },
];

/**
 * "/dev-sign-in": development only, while the API runs on mocks (MOCK_API=1). Sign in as any
 * role's fixture user to check its tabs, or as a newcomer to walk the join flow.
 */
export default function DevSignIn() {
  const { setRole, setMe } = useRole();
  const [error, setError] = useState<string | null>(null);

  const signIn = (role: Role, newcomer: boolean) =>
    api.devSignIn(role, newcomer).then(
      (me) => {
        setMe(me);
        setRole(me.role);
        router.replace(newcomer ? '/onboarding/find-team' : firstTab(me.role));
      },
      (e: Error) => setError(`${e.message}. Is the API running with MOCK_API=1?`),
    );

  const Row = ({
    p,
    newcomer,
    note,
  }: {
    p: { role: Role; first: string; last: string };
    newcomer: boolean;
    note: string;
  }) => (
    <Card
      onPress={() => signIn(p.role, newcomer)}
      label={`Sign in as ${p.first} ${p.last}`}
      style={styles.row}
    >
      <Avatar name={`${p.first} ${p.last}`} role={p.role} />
      <View style={styles.grow}>
        <Text weight="semibold">
          {p.first} {p.last}
        </Text>
        <Text variant="caption" weight="medium" color="muted">
          {note}
        </Text>
      </View>
      <Icon name="chevron" size={18} color={colors.text.muted} />
    </Card>
  );

  return (
    <Screen eyebrow="Mock data · no password" title="Sign in as" back>
      {error && (
        <Gutter>
          <ErrorText>{error}</ErrorText>
        </Gutter>
      )}
      <SectionLabel>On the Tufts team</SectionLabel>
      <Gutter gap="sm">
        {MEMBERS.map((m) => (
          <Row key={m.role} p={m} newcomer={false} note={`${ROLE_LABEL[m.role]} · ${m.who}`} />
        ))}
      </Gutter>
      <SectionLabel>New, to try the join flow</SectionLabel>
      <Gutter gap="sm">
        {NEWCOMERS.map((m) => (
          <Row
            key={m.role}
            p={m}
            newcomer
            note={`New ${ROLE_LABEL[m.role].toLowerCase()} · no team yet`}
          />
        ))}
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  grow: { flex: 1 },
});
