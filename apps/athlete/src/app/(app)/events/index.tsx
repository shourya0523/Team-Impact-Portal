import { router } from 'expo-router';
import { Text } from 'react-native';
import { api } from '@/api';
import { dateTime, KIND_LABEL, ROLE_LABEL } from '@/components/format';
import { Async, Button, Card, Pill, Screen, text } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';

/** "/events": upcoming events in your communities. Each shows who made it and their role. */
export default function Events() {
  const { role } = useRole();
  const { state } = useApi(() => api.events());
  const canCreate = role !== 'parent' && role !== 'teen';
  return (
    <Screen
      title="Events"
      actions={
        canCreate && <Button label="Create event" onPress={() => router.push('/events/new')} />
      }
    >
      <Async state={state}>
        {(events) =>
          events.length ? (
            events.map((e) => (
              <Card
                key={e.id}
                onPress={() => router.push({ pathname: '/events/[id]', params: { id: e.id } })}
              >
                <Pill
                  label={`${KIND_LABEL[e.community.kind]} · ${e.community.name}`}
                  tone="brand"
                />
                <Text style={text.strong}>{e.title}</Text>
                <Text style={text.body}>{dateTime(e.startsAt)}</Text>
                <Text style={text.muted}>{e.location}</Text>
                <Text style={text.muted}>
                  By {e.host.firstName} {e.host.lastName} ({ROLE_LABEL[e.host.role]}) ·{' '}
                  {e.goingCount} going
                </Text>
              </Card>
            ))
          ) : (
            <Text style={text.muted}>No upcoming events.</Text>
          )
        }
      </Async>
    </Screen>
  );
}
