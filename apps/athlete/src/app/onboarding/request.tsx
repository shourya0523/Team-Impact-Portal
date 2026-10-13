import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import type { CreateJoinRequest, ParentRelationship } from '@team-impact/contracts';
import { api } from '@/api';
import { Button, Card, Screen, text } from '@/components/ui';
import { useRole } from '@/navigation/role';

const YEARS = [2027, 2028, 2029, 2030];

/**
 * "/onboarding/request": the slow lane. Athletes give their class year, parents say parent or
 * guardian, teens just ask. Nothing about the team shows until a coach approves.
 */
export default function Request() {
  const { teamId, teamName } = useLocalSearchParams<{ teamId: string; teamName: string }>();
  const { role } = useRole();
  const [classYear, setClassYear] = useState<number | null>(null);
  const [relationship, setRelationship] = useState<ParentRelationship | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const body: CreateJoinRequest | null =
    role === 'athlete' && classYear
      ? { role, teamId, classYear }
      : role === 'parent' && relationship
        ? { role, teamId, relationship }
        : role === 'teen'
          ? { role, teamId }
          : null;

  const send = () => {
    if (!body) return;
    setSending(true);
    api.requestToJoin(body).then(
      () => router.replace({ pathname: '/onboarding/pending', params: { teamName } }),
      (e: Error) => {
        setError(e.message);
        setSending(false);
      },
    );
  };

  return (
    <Screen title="Request to join" subtitle={teamName}>
      {role === 'athlete' && (
        <>
          <Text style={text.section}>Class year</Text>
          {YEARS.map((y) => (
            <Button
              key={y}
              label={`Class of ${y}${classYear === y ? '  ✓' : ''}`}
              kind={classYear === y ? 'primary' : 'secondary'}
              onPress={() => setClassYear(y)}
            />
          ))}
        </>
      )}
      {role === 'parent' && (
        <>
          <Text style={text.section}>You are their</Text>
          {(['parent', 'guardian'] as const).map((r) => (
            <Button
              key={r}
              label={`${r === 'parent' ? 'Parent' : 'Guardian'}${relationship === r ? '  ✓' : ''}`}
              kind={relationship === r ? 'primary' : 'secondary'}
              onPress={() => setRelationship(r)}
            />
          ))}
        </>
      )}
      {role === 'teen' && (
        <Card>
          <Text style={text.body}>A coach checks your request before you can see the team.</Text>
        </Card>
      )}
      {error && (
        <Text style={{ color: 'crimson' }} accessibilityRole="alert">
          {error}
        </Text>
      )}
      <Button
        label={sending ? 'Sending…' : 'Send request'}
        onPress={send}
        disabled={!body || sending}
      />
      <Button label="Back" kind="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
