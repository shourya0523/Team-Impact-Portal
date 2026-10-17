import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { CalendarEvent } from '@team-impact/contracts';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { fromNow, monthDay, ROLE_LABEL } from '@/components/format';
import { TicketRsvp, ticketKicker } from '@/components/ticket';
import { Async, Gutter, Screen, Segmented } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { KIND_STYLE } from '@/theme';
import { Badge, Button, Card, Icon, Text } from '@/ui';

type Show = 'all' | 'team' | 'going';
/** Answers given on this device; null means a Going was given back. */
type Rsvp = Record<string, 'going' | 'not_going' | null>;
const answerFor = (rsvp: Rsvp, e: CalendarEvent) => (e.id in rsvp ? rsvp[e.id] : e.myRsvp);

function NextUp({
  event,
  rsvp,
  setRsvp,
}: {
  event: CalendarEvent;
  rsvp: Rsvp;
  setRsvp: (r: Rsvp) => void;
}) {
  const d = monthDay(event.startsAt);
  const answer = answerFor(rsvp, event);
  const going =
    event.goingCount +
    (answer === 'going' && event.myRsvp !== 'going' ? 1 : 0) -
    (answer !== 'going' && event.myRsvp === 'going' ? 1 : 0);
  return (
    <View style={styles.hero}>
      <Text variant="decor" size="lg" style={styles.heroDate}>
        {d.day}
      </Text>
      <View style={styles.row}>
        <Badge label="Next up" variant="action" caps />
        <Text variant="caption" weight="medium" color="onBrandSecondary">
          {fromNow(event.startsAt)}
        </Text>
      </View>
      <View style={styles.heroText}>
        <Text variant="display" size="md" color="onBrand" accessibilityRole="none">
          {event.title}
        </Text>
        <Text weight="semibold" color="onBrand">
          {d.weekday}, {d.month.charAt(0) + d.month.slice(1).toLowerCase()} {d.day} · {d.time}
        </Text>
        <View style={styles.place}>
          <Icon name="pin" size={14} color={colors.onBrand.secondary} />
          <Text variant="caption" color="onBrandSecondary" style={styles.grow} numberOfLines={1}>
            {event.location}
          </Text>
        </View>
      </View>
      <View style={styles.between}>
        <Text variant="caption" weight="semibold" color="onBrand">
          {going} going
        </Text>
        <Text variant="caption" color="onBrandSecondary">
          By {event.host.firstName} {event.host.lastName} · {ROLE_LABEL[event.host.role]}
        </Text>
      </View>
      <TicketRsvp
        kicker={ticketKicker(event.startsAt, event.location)}
        title={event.title}
        going={answer === 'going'}
        onToggle={(on) => setRsvp({ ...rsvp, [event.id]: on ? 'going' : null })}
        ground={colors.brand}
        onNavy
      />
      <Button
        label="Can't make it"
        icon={answer === 'not_going' ? 'check' : undefined}
        variant={answer === 'not_going' ? 'onBrand' : 'ghostOnBrand'}
        accessibilityState={{ selected: answer === 'not_going' }}
        onPress={() => setRsvp({ ...rsvp, [event.id]: 'not_going' })}
      />
    </View>
  );
}

function EventRow({ event, going }: { event: CalendarEvent; going: boolean }) {
  const d = monthDay(event.startsAt);
  const k = KIND_STYLE[event.community.kind];
  return (
    <Card
      onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      label={event.title}
      style={styles.eventRow}
    >
      <View style={[styles.tile, { backgroundColor: k.band }]}>
        <Text variant="eyebrow" color={k.onBand}>
          {d.month}
        </Text>
        <Text variant="display" size="sm" color={k.onBand} accessibilityRole="none">
          {d.day}
        </Text>
      </View>
      <View style={styles.eventText}>
        <Text variant="eyebrow" style={{ color: k.label }} numberOfLines={1}>
          {event.community.name}
        </Text>
        <Text weight="semibold">{event.title}</Text>
        <Text variant="small" color="secondary" numberOfLines={1}>
          {d.weekday} · {d.time} · {event.location}
        </Text>
        <Text variant="caption" weight="medium" color="muted">
          By {event.host.firstName} {event.host.lastName} · {ROLE_LABEL[event.host.role]} ·{' '}
          {event.goingCount} going
        </Text>
      </View>
      {going && <Badge label="Going" variant="success" />}
    </Card>
  );
}

/** "/events": what's coming up in your communities. Each event shows who made it and their role. */
export default function Events() {
  const { role } = useRole();
  const { state } = useApi(() => api.events());
  const [show, setShow] = useState<Show>('all');
  // RSVPs stay on the device until the RSVP endpoint lands.
  const [rsvp, setRsvp] = useState<Rsvp>({});
  const canCreate = role !== 'parent' && role !== 'teen';

  return (
    <Screen
      eyebrow="This week"
      title="Events"
      right={
        canCreate && (
          <Button
            label="New event"
            variant="ink"
            size="sm"
            icon="plus"
            onPress={() => router.push('/events/new')}
          />
        )
      }
    >
      <Gutter>
        <Async state={state}>
          {(events) => {
            if (!events.length) {
              return (
                <Text variant="small" color="secondary">
                  Nothing on the calendar yet.
                </Text>
              );
            }
            const [next, ...rest] = events;
            const isGoing = (e: CalendarEvent) => answerFor(rsvp, e) === 'going';
            const list = rest.filter((e) =>
              show === 'all' ? true : show === 'going' ? isGoing(e) : e.community.kind === 'team',
            );
            return (
              <>
                <NextUp event={next!} rsvp={rsvp} setRsvp={setRsvp} />
                <Segmented
                  label="Which events"
                  value={show}
                  onChange={setShow}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'team', label: 'My team' },
                    { value: 'going', label: 'Going' },
                  ]}
                />
                {list.map((e) => (
                  <EventRow key={e.id} event={e} going={isGoing(e)} />
                ))}
                {list.length === 0 && (
                  <Text variant="small" color="secondary">
                    Nothing here yet.
                  </Text>
                )}
              </>
            );
          }}
        </Async>
      </Gutter>
    </Screen>
  );
}

const TILE_WIDTH = 64;
const TILE_HEIGHT = 72;

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.brand,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.md,
    overflow: 'hidden',
  },
  heroDate: { position: 'absolute', right: -6, top: -22, color: colors.brandPressed },
  heroText: { gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  place: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grow: { flex: 1 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eventText: { flex: 1, gap: spacing.xs },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
