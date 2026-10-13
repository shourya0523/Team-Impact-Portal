import { router, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { canJoinCommunity } from '@team-impact/contracts';
import { api } from '@/api';
import { KIND_LABEL } from '@/components/format';
import { Async, Button, Card, Pill, Screen, text } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';

/** "/me/communities/[id]". Joining, leaving and the community's own feed come with TI-117. */
export default function CommunityDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useRole();
  const { state } = useApi(() => api.community(id), [id]);
  return (
    <Async state={state}>
      {(c) => (
        <Screen title={c.name} subtitle={`${KIND_LABEL[c.kind]} · ${c.memberCount} members`}>
          <Text style={text.body}>{c.about}</Text>
          {c.kind === 'interest' && c.official && <Pill label="Official" tone="brand" />}
          {c.myMembership ? (
            <>
              <Pill label="You’re a member" tone="brand" />
              {c.kind === 'medical' && (
                <Text style={text.muted}>
                  Your membership is private. It never shows on your profile or in search.
                </Text>
              )}
              {c.kind === 'interest' && c.official && role === 'athlete' && (
                <Card>
                  <Text style={text.strong}>Recruiters can find me through this community</Text>
                  <Text style={text.muted}>
                    {c.myMembership.recruiterSearchOptIn ? 'On' : 'Off'} · separate from joining,
                    and you can turn it off anytime.
                  </Text>
                </Card>
              )}
              {role !== 'parent' && role !== 'recruiter' && (
                <Button
                  label="Post in this community"
                  onPress={() => router.push('/home/compose')}
                />
              )}
            </>
          ) : (
            role &&
            canJoinCommunity(role, c.kind) && (
              <Text style={text.muted}>
                Not a member yet. Joining arrives with the communities ticket.
              </Text>
            )
          )}
        </Screen>
      )}
    </Async>
  );
}
