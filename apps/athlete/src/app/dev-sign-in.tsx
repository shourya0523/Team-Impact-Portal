import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import type { Role } from '@team-impact/contracts';
import { api } from '@/api';
import { Button, Card, Screen, text } from '@/components/ui';
import { useRole } from '@/navigation/role';
import { firstTab } from '@/navigation/tabs';

const MEMBERS: { role: Role; who: string }[] = [
  { role: 'athlete', who: 'Jordan Lee · Tufts Women’s Soccer' },
  { role: 'parent', who: 'Lisa Gomez · parent of Mateo, 9' },
  { role: 'teen', who: 'Noah Kim · 14' },
  { role: 'coach', who: 'Coach Dana Rivera' },
  { role: 'alumni_athlete', who: 'Priya Shah · alumni athlete' },
  { role: 'alumni_mentor', who: 'Chris Doyle · alumni mentor' },
  { role: 'recruiter', who: 'Elena Ward · Northbeam Capital' },
  { role: 'staff', who: 'Maya Chen · Team Impact' },
];

const NEWCOMERS: { role: Role; who: string }[] = [
  { role: 'athlete', who: 'Leo Grant · new athlete' },
  { role: 'parent', who: 'Rosa Diaz · new parent' },
  { role: 'teen', who: 'Eli Ward · new teammate' },
];

/**
 * "/dev-sign-in": development only, while the API runs on mocks (MOCK_API=1). Sign in as any
 * role's fixture user to check its tabs, or as a newcomer to walk the join flow.
 */
export default function DevSignIn() {
  const { setRole } = useRole();
  const [error, setError] = useState<string | null>(null);

  const signIn = (role: Role, newcomer: boolean) =>
    api.devSignIn(role, newcomer).then(
      (me) => {
        setRole(me.role);
        router.replace(newcomer ? '/onboarding/find-team' : firstTab(me.role));
      },
      (e: Error) => setError(`${e.message}. Is the API running with MOCK_API=1?`),
    );

  return (
    <Screen title="Sign in as" subtitle="Mock data, no password.">
      {error && <Text style={{ color: 'crimson' }}>{error}</Text>}
      <Text style={text.section}>On the Tufts team</Text>
      {MEMBERS.map((m) => (
        <Card key={m.role} onPress={() => signIn(m.role, false)}>
          <Text style={text.strong}>{m.role.replace('_', ' ')}</Text>
          <Text style={text.muted}>{m.who}</Text>
        </Card>
      ))}
      <Text style={text.section}>New, to try the join flow</Text>
      {NEWCOMERS.map((m) => (
        <Card key={m.role} onPress={() => signIn(m.role, true)}>
          <Text style={text.strong}>{m.role}</Text>
          <Text style={text.muted}>{m.who}</Text>
        </Card>
      ))}
      <Button label="Back" kind="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
