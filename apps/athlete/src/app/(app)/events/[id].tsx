import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CalendarEvent, RsvpStatus } from '@team-impact/contracts';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { HeldNote } from '@/components/activity';
import { dateTime, ROLE_LABEL, shortDate } from '@/components/format';
import { TicketRsvp, ticketKicker } from '@/components/ticket';
import { Async, ErrorText, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Avatar, Badge, Button, Card, Icon, Text } from '@/ui';

/** Going is the ticket; the other answers are plain buttons beside it. */
const OTHER_ANSWERS: { value: Exclude<RsvpStatus, 'going'>; label: string }[] = [
  { value: 'maybe', label: 'Maybe' },
  { value: 'not_going', label: 'Can’t go' },
];

const STATUS_LABEL: Record<RsvpStatus, string> = {
  going: 'Going',
  maybe: 'Maybe',
  not_going: 'Can’t go',
};

/** The organizer's RSVP list. */
function Attendees({ eventId }: { eventId: string }) {
  const { state } = useApi(() => api.attendees(eventId), [eventId]);
  return (
    <Async state={state}>
      {(list) => (
        <Card>
          <Text weight="semibold">Who’s coming · {list.length}</Text>
          {list.map((a) => (
            <View key={a.user.id} style={styles.person}>
              <Avatar name={`${a.user.firstName} ${a.user.lastName}`} role={a.user.role} />
              <View style={styles.grow}>
                <Text weight="semibold">
                  {a.user.firstName} {a.user.lastName}
                </Text>
                <Text variant="caption" weight="medium" color="muted">
                  {ROLE_LABEL[a.user.role]} · {shortDate(a.respondedAt)}
                </Text>
              </View>
              <Badge
                label={STATUS_LABEL[a.status]}
                variant={a.status === 'going' ? 'success' : 'neutral'}
              />
            </View>
          ))}
        </Card>
      )}
    </Async>
  );
}

/** "/events/[id]": what, when, where, who made it (and their role), RSVP, and the organizer's list. */
export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me } = useRole();
  const { state } = useApi(() => api.event(id), [id]);
  const [override, setOverride] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The answer shown while the API confirms it, so the ticket tears at once.
  const [pending, setPending] = useState<RsvpStatus | null>(null);
  // Giving the seat back returns to the last other answer this visit, else Maybe.
  const lastOther = useRef<RsvpStatus | null>(null);

  const answer = (status: RsvpStatus) => {
    if (status !== 'going') lastOther.current = status;
    setPending(status);
    setError(null);
    api.rsvp(id, status).then(
      (ev) => {
        setOverride(ev);
        setPending(null);
      },
      (err: Error) => {
        setPending(null);
        setError(err.message);
      },
    );
  };

  return (
    <Async state={state}>
      {(loaded) => {
        const e = override ?? loaded;
        const held = e.moderation !== 'approved';
        const isHost = !!me && e.host.id === me.id;
        const mine = pending ?? e.myRsvp;
        const giveBack = () =>
          answer(lastOther.current ?? (e.myRsvp && e.myRsvp !== 'going' ? e.myRsvp : 'maybe'));
        return (
          <Screen eyebrow={e.community.name} title={e.title} back>
            <Gutter>
              {held && <HeldNote what="event" />}
              <Card>
                <View style={styles.line}>
                  <Icon name="calendar" size={18} color={colors.brand} />
                  <Text weight="semibold" style={styles.grow}>
                    {dateTime(e.startsAt)}
                    {e.endsAt ? ` – ${dateTime(e.endsAt)}` : ''}
                  </Text>
                </View>
                <View style={styles.line}>
                  <Icon name="pin" size={18} color={colors.brand} />
                  <Text style={styles.grow}>{e.location}</Text>
                </View>
                {e.details && <Text color="secondary">{e.details}</Text>}
                <View style={styles.person}>
                  <Avatar name={`${e.host.firstName} ${e.host.lastName}`} role={e.host.role} />
                  <View style={styles.grow}>
                    <Text weight="semibold">
                      {e.host.firstName} {e.host.lastName}
                    </Text>
                    <Text variant="caption" weight="medium" color="muted">
                      Organizer · {ROLE_LABEL[e.host.role]}
                    </Text>
                  </View>
                </View>
                <Text variant="small" color="secondary">
                  {e.goingCount} going
                </Text>
              </Card>
            </Gutter>
            {!held && (
              <>
                <SectionLabel>Are you going?</SectionLabel>
                <Gutter gap="sm">
                  <TicketRsvp
                    kicker={ticketKicker(e.startsAt, e.location)}
                    title={e.title}
                    going={mine === 'going'}
                    onToggle={(going) => (going ? answer('going') : giveBack())}
                  />
                  <View style={styles.line}>
                    {OTHER_ANSWERS.map((o) => (
                      <Button
                        key={o.value}
                        label={o.label}
                        variant="secondary"
                        size="sm"
                        stretch
                        icon={mine === o.value ? 'check' : undefined}
                        accessibilityState={{ selected: mine === o.value }}
                        onPress={() => answer(o.value)}
                      />
                    ))}
                  </View>
                  {error && <ErrorText>{error}</ErrorText>}
                </Gutter>
              </>
            )}
            {isHost && (
              <Gutter>
                <Attendees eventId={e.id} />
              </Gutter>
            )}
          </Screen>
        );
      }}
    </Async>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1 },
});
