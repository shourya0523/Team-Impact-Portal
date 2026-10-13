import { router } from 'expo-router';
import { Text } from 'react-native';
import { canCreateCommunity, type Community, type CommunityKind } from '@team-impact/contracts';
import { api } from '@/api';
import { KIND_LABEL } from '@/components/format';
import { Async, Button, Card, Pill, Screen, text } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';

const ORDER: CommunityKind[] = ['team', 'team_impact', 'interest', 'medical'];

function Row({ c }: { c: Community }) {
  return (
    <Card onPress={() => router.push({ pathname: '/me/communities/[id]', params: { id: c.id } })}>
      <Text style={text.strong}>{c.name}</Text>
      <Text style={text.muted} numberOfLines={2}>
        {c.about}
      </Text>
      {c.kind === 'interest' && c.official && <Pill label="Official" tone="brand" />}
      {/* Medical membership is private: only the member sees they're in it. */}
      {c.kind === 'medical' && c.myMembership && <Pill label="Only you can see you’re a member" />}
    </Card>
  );
}

/**
 * "/me/communities": the communities you can see, yours first. Teens and recruiters never get
 * medical ones from the API; parents can create medical communities only (PRD §5).
 */
export default function Communities() {
  const { role } = useRole();
  const { state } = useApi(() => api.communities());
  return (
    <Screen
      title="Communities"
      actions={
        role &&
        canCreateCommunity(role, 'medical') && (
          <Button label="Create community" onPress={() => router.push('/me/communities/new')} />
        )
      }
    >
      <Async state={state}>
        {(all) => {
          const mine = all.filter((c) => c.myMembership);
          const others = all.filter((c) => !c.myMembership);
          const byKind = (list: Community[]) =>
            [...list].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
          return (
            <>
              <Text style={text.section}>Yours</Text>
              {byKind(mine).map((c) => (
                <Row key={c.id} c={c} />
              ))}
              {others.length > 0 && <Text style={text.section}>More to join</Text>}
              {byKind(others).map((c) => (
                <Row key={c.id} c={c} />
              ))}
              <Text style={text.muted}>
                Kinds:{' '}
                {ORDER.filter((k) => all.some((c) => c.kind === k))
                  .map((k) => KIND_LABEL[k])
                  .join(', ')}
              </Text>
            </>
          );
        }}
      </Async>
    </Screen>
  );
}
