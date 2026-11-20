import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { nameList, NoTeam, useTeamId } from '@/components/team';
import { Async, ErrorText, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Button, Card, Text } from '@/ui';

/**
 * "/team/leave": a parent takes their family off the team. Their children leave with them, since
 * a child's profile is only for its team and family; the screen says so first. Afterwards they
 * land on the join search, as a new parent would.
 */
export default function LeaveTeam() {
  const { me, setMe } = useRole();
  const teamId = useTeamId();
  const roster = useApi(() => (teamId ? api.roster(teamId) : Promise.resolve(null)), [teamId]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const leave = (id: string) => {
    setBusy(true);
    setError(null);
    api
      .leaveTeam(id)
      .then(() => api.me())
      .then(
        (updated) => {
          setMe(updated);
          router.replace('/onboarding/find-team');
        },
        (e: Error) => {
          setBusy(false);
          setError(e.message);
        },
      );
  };

  return (
    <Screen eyebrow="Team" title="Leave the team" back>
      <Gutter>
        <Async state={roster.state} onRetry={roster.reload}>
          {(r) => {
            if (!r || !teamId) return <NoTeam />;
            const children = r.parents.find((p) => p.user.id === me?.id)?.children ?? [];
            return (
              <>
                <Text color="secondary">
                  You lose access to {r.team.name}, its posts and events. You can ask to join again
                  later.
                </Text>
                {children.length > 0 && (
                  <Card>
                    <Text weight="semibold">
                      {nameList(children.map((c) => c.firstName))}{' '}
                      {children.length === 1 ? 'leaves' : 'leave'} too
                    </Text>
                    <Text variant="small" color="secondary">
                      Children’s profiles are seen only by their team and family, so they come off
                      the team with you.
                    </Text>
                  </Card>
                )}
                {error && <ErrorText>{error}</ErrorText>}
                <View style={styles.buttons}>
                  <Button label="Stay" variant="secondary" stretch onPress={() => router.back()} />
                  <Button
                    label={busy ? 'Leaving…' : 'Leave team'}
                    stretch
                    disabled={busy}
                    accessibilityLabel={`Leave ${r.team.name}`}
                    onPress={() => leave(teamId)}
                  />
                </View>
              </>
            );
          }}
        </Async>
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  buttons: { flexDirection: 'row', gap: spacing.sm },
});
