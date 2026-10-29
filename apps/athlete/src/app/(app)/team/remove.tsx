import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { TeamRoster } from '@team-impact/contracts';
import { spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { fullName, joinedLine, nameList, NoTeam, PersonRow, useTeamId } from '@/components/team';
import { Async, ErrorText, Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Button, Card, Sheet, Text } from '@/ui';

const findMember = (r: TeamRoster, userId: string) => {
  const parent = r.parents.find((p) => p.user.id === userId);
  if (parent) return { member: parent, children: parent.children };
  const member = [...r.coaches, ...r.athletes, ...r.teens].find((m) => m.user.id === userId);
  return member ? { member, children: [] } : null;
};

/**
 * "/team/remove?userId=": confirm taking someone off the team. A parent's under-13 children leave
 * with them, since a child's profile is only for its team and family; the sheet says so first.
 */
export default function RemoveMember() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const teamId = useTeamId();
  const roster = useApi(() => (teamId ? api.roster(teamId) : Promise.resolve(null)), [teamId]);
  const [open, setOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen eyebrow="Team" title="Remove a member" back>
      <Gutter>
        <Async state={roster.state} onRetry={roster.reload}>
          {(r) => {
            const found = r && userId ? findMember(r, userId) : null;
            if (!r || !teamId) return <NoTeam />;
            if (!found) return <ErrorText>That person isn’t on the team anymore.</ErrorText>;
            const { member, children } = found;
            const name = fullName(member.user);
            const remove = () => {
              setBusy(true);
              api.removeMember(teamId, member.user.id).then(
                () => router.back(),
                (e: Error) => {
                  setBusy(false);
                  setError(e.message);
                },
              );
            };
            return (
              <>
                <Card>
                  <PersonRow user={member.user} detail={joinedLine(member)} />
                </Card>
                <Button label={`Remove ${member.user.firstName}`} onPress={() => setOpen(true)} />
                <Sheet visible={open} title={`Remove ${name}?`} onClose={() => setOpen(false)}>
                  <Text color="secondary">
                    {name} loses access to the team, its posts and events. They can ask to join
                    again or use a new QR code.
                  </Text>
                  {children.length > 0 && (
                    <Card>
                      <Text weight="semibold">
                        {nameList(children.map((c) => c.firstName))}{' '}
                        {children.length === 1 ? 'leaves' : 'leave'} too
                      </Text>
                      <Text variant="small" color="secondary">
                        Children’s profiles are run by their parent and seen only by their team and
                        family, so they come off the team with {member.user.firstName}.
                      </Text>
                    </Card>
                  )}
                  {error && <ErrorText>{error}</ErrorText>}
                  <View style={styles.buttons}>
                    <Button
                      label="Keep them"
                      variant="secondary"
                      stretch
                      onPress={() => router.back()}
                    />
                    <Button
                      label="Remove"
                      stretch
                      disabled={busy}
                      accessibilityLabel={`Remove ${name} from the team`}
                      onPress={remove}
                    />
                  </View>
                </Sheet>
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
