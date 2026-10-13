import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  type CalendarEvent,
  type Community,
  MEMBERS_PRIVATE_MEDICAL,
} from '@team-impact/contracts';
import { colors, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { monthDay, ROLE_LABEL, shortDate } from '@/components/format';
import { Async } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { KIND_STYLE } from '@/theme';
import { Avatar, Badge, Card, Icon, Text, type IconName } from '@/ui';

const TILE_WIDTH = 56;
const TILE_HEIGHT = 64;

/** A quiet card for "nothing here" and "not for you" states. */
export function EmptyNote({ icon = 'users', children }: { icon?: IconName; children: string }) {
  return (
    <Card style={styles.note}>
      <Icon name={icon} size={18} color={colors.brand} />
      <Text variant="small" color="secondary" style={styles.grow}>
        {children}
      </Text>
    </Card>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const d = monthDay(event.startsAt);
  const k = KIND_STYLE[event.community.kind];
  const held = event.moderation !== 'approved';
  return (
    <Card
      onPress={() => router.push({ pathname: '/events/[id]', params: { id: event.id } })}
      label={event.title}
      style={styles.row}
    >
      <View style={[styles.tile, { backgroundColor: k.band }]}>
        <Text variant="eyebrow" color={k.onBand}>
          {d.month}
        </Text>
        <Text variant="display" size="sm" color={k.onBand} accessibilityRole="none">
          {d.day}
        </Text>
      </View>
      <View style={styles.text}>
        <Text weight="semibold">{event.title}</Text>
        <Text variant="small" color="secondary" numberOfLines={1}>
          {d.weekday} · {d.time} · {event.location}
        </Text>
        <Text variant="caption" weight="medium" color="muted">
          By {event.host.firstName} {event.host.lastName} · {event.goingCount} going
        </Text>
      </View>
      {held ? (
        <Badge label="In review" />
      ) : (
        event.myRsvp === 'going' && <Badge label="Going" variant="success" />
      )}
    </Card>
  );
}

/** The Events tab: what's coming up in this community. */
export function CommunityEvents({ community }: { community: Community }) {
  const { state } = useApi(() => api.communityEvents(community.id), [community.id]);
  return (
    <Async state={state}>
      {(events) =>
        events.length ? (
          <View style={styles.list}>
            {events.map((e) => (
              <EventRow key={e.id} event={e} />
            ))}
          </View>
        ) : (
          <EmptyNote icon="calendar">
            {community.myMembership
              ? 'No events coming up. Anyone here can plan one from Events.'
              : 'Join to see events here.'}
          </EmptyNote>
        )
      }
    </Async>
  );
}

function MemberList({ community }: { community: Community }) {
  const { me } = useRole();
  const { state } = useApi(() => api.communityMembers(community.id), [community.id]);
  return (
    <Async state={state}>
      {(members) =>
        members.length ? (
          <Card>
            {members.map(({ user, joinedAt }) => (
              <View key={user.id} style={styles.person}>
                <Avatar name={`${user.firstName} ${user.lastName}`} role={user.role} />
                <View style={styles.grow}>
                  <Text weight="semibold">
                    {user.firstName} {user.lastName}
                    {user.id === me?.id ? ' (you)' : ''}
                  </Text>
                  <Text variant="caption" weight="medium" color="muted">
                    {ROLE_LABEL[user.role]} · joined {shortDate(joinedAt)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyNote>No one to show yet.</EmptyNote>
        )
      }
    </Async>
  );
}

/**
 * The Members tab. Lists only reach members. Nobody is told who else is in a medical community,
 * Team Impact's community is everyone (count only), and recruiters see members of nothing.
 */
export function CommunityMembers({ community }: { community: Community }) {
  const { role } = useRole();
  if (community.kind === 'medical')
    return <EmptyNote icon="lock">{`${MEMBERS_PRIVATE_MEDICAL}.`}</EmptyNote>;
  if (community.kind === 'team_impact') {
    return (
      <EmptyNote>{`Everyone at Team Impact is here: ${community.memberCount} members.`}</EmptyNote>
    );
  }
  if (role === 'recruiter')
    return <EmptyNote icon="lock">Member lists aren’t shown to recruiters.</EmptyNote>;
  if (!community.myMembership) {
    const isPrivate = community.kind === 'interest' && community.private;
    return (
      <EmptyNote icon={isPrivate ? 'lock' : 'users'}>
        {isPrivate
          ? 'Private community: only members see who’s here.'
          : `Join to see who’s here. ${community.memberCount} members so far.`}
      </EmptyNote>
    );
  }
  return <MemberList community={community} />;
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1, gap: spacing.xs },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  note: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  grow: { flex: 1 },
});
