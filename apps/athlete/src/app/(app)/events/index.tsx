import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CalendarEvent } from '@team-impact/contracts';
import { api } from '@/api';
import { fromNow, monthDay, ROLE_LABEL } from '@/components/format';
import { Icon } from '@/components/Icon';
import { Async, Button, Card, Gutter, Screen, Segmented, type } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { c, font, KIND_STYLE } from '@/theme';

type Show = 'all' | 'team' | 'going';
type Rsvp = Record<string, 'going' | 'not_going'>;

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
  const answer = rsvp[event.id] ?? event.myRsvp;
  const going = event.goingCount + (answer === 'going' && event.myRsvp !== 'going' ? 1 : 0);
  return (
    <View style={styles.hero}>
      <Text style={styles.heroDate} aria-hidden>
        {d.day}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={styles.nextTag}>
          <Text style={{ color: '#fff', fontFamily: font.bold, fontSize: 11, letterSpacing: 1.5 }}>
            NEXT UP
          </Text>
        </View>
        <Text style={{ color: c.onNavy, fontFamily: font.medium, fontSize: 13 }}>
          {fromNow(event.startsAt)}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        <Text style={styles.heroTitle}>{event.title.toUpperCase()}</Text>
        <Text style={{ color: '#fff', fontFamily: font.semibold, fontSize: 15 }}>
          {d.weekday}, {d.month.charAt(0) + d.month.slice(1).toLowerCase()} {d.day} · {d.time}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="pin" size={14} color={c.onNavy} />
          <Text
            style={{ color: c.onNavy, fontFamily: font.body, fontSize: 13, flex: 1 }}
            numberOfLines={1}
          >
            {event.location}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#fff', fontFamily: font.semibold, fontSize: 13 }}>
          {going} going
        </Text>
        <Text style={{ color: c.onNavy, fontFamily: font.body, fontSize: 12 }}>
          By {event.host.firstName} {event.host.lastName} · {ROLE_LABEL[event.host.role]}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button
          label="Going"
          icon={answer === 'going' ? 'check' : undefined}
          kind={answer === 'going' ? 'white' : 'onNavy'}
          stretch
          onPress={() => setRsvp({ ...rsvp, [event.id]: 'going' })}
        />
        <Button
          label="Can't make it"
          kind={answer === 'not_going' ? 'white' : 'onNavy'}
          stretch
          onPress={() => setRsvp({ ...rsvp, [event.id]: 'not_going' })}
        />
      </View>
    </View>
  );
}

function EventRow({ event, going }: { event: CalendarEvent; going: boolean }) {
  const d = monthDay(event.startsAt);
  const k = KIND_STYLE[event.community.kind];
  const tileText = event.community.kind === 'interest' ? c.ink : '#fff';
  return (
    <Card
      onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      label={event.title}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 }}
    >
      <View style={[styles.tile, { backgroundColor: k.band }]}>
        <Text style={{ color: tileText, fontFamily: font.bold, fontSize: 12, letterSpacing: 1.4 }}>
          {d.month}
        </Text>
        <Text style={{ color: tileText, fontFamily: font.display, fontSize: 32, lineHeight: 32 }}>
          {d.day}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{ color: k.label, fontFamily: font.bold, fontSize: 11, letterSpacing: 0.9 }}
          numberOfLines={1}
        >
          {event.community.name.toUpperCase()}
        </Text>
        <Text style={{ fontFamily: font.bold, fontSize: 17, color: c.ink }}>{event.title}</Text>
        <Text style={type.small} numberOfLines={1}>
          {d.weekday} · {d.time} · {event.location}
        </Text>
        <Text style={type.meta}>
          By {event.host.firstName} {event.host.lastName} · {ROLE_LABEL[event.host.role]} ·{' '}
          {event.goingCount} going
        </Text>
      </View>
      {going && (
        <View style={styles.going}>
          <Text style={{ fontFamily: font.bold, fontSize: 12, color: c.okFg }}>Going</Text>
        </View>
      )}
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
            kind="ink"
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
              return <Text style={type.small}>Nothing on the calendar yet.</Text>;
            }
            const [next, ...rest] = events;
            const isGoing = (e: CalendarEvent) => (rsvp[e.id] ?? e.myRsvp) === 'going';
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
                {list.length === 0 && <Text style={type.small}>Nothing here yet.</Text>}
              </>
            );
          }}
        </Async>
      </Gutter>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: c.navy, borderRadius: 24, padding: 20, gap: 14, overflow: 'hidden' },
  heroDate: {
    position: 'absolute',
    right: -6,
    top: -22,
    fontFamily: font.display,
    fontSize: 150,
    lineHeight: 160,
    color: c.navyPressed,
  },
  nextTag: { backgroundColor: c.red, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  heroTitle: { fontFamily: font.display, fontSize: 38, lineHeight: 37, color: '#fff' },
  tile: { width: 64, height: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  going: {
    alignSelf: 'flex-start',
    backgroundColor: c.okBg,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
