import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import type {
  ChildProfile,
  ContactSharing,
  PersonProfile,
  TeenProfile,
  TeamSummary,
} from '@team-impact/contracts';
import { AthleteCard } from '@team-impact/ui-primitives/native';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api, track } from '@/api';
import { toCardData } from '@/components/cardData';
import { ROLE_LABEL, KIND_LABEL } from '@/components/format';
import { Async, Chip, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { Avatar, Badge, Card, Icon, TeamAvatar, Text } from '@/ui';

const MAX_CARD_WIDTH = 360;

type Channel = keyof ContactSharing;

const HREF: Record<Channel, (value: string) => string> = {
  email: (v) => `mailto:${v}`,
  phone: (v) => `tel:${v.replace(/[^+\d]/g, '')}`,
  linkedin: (v) => (/^https?:\/\//.test(v) ? v : `https://${v}`),
};

function Teams({ teams }: { teams: TeamSummary[] }) {
  if (teams.length === 0) return null;
  return (
    <>
      <SectionLabel>Team</SectionLabel>
      {teams.map((t) => (
        <Card key={t.id} style={styles.row}>
          <TeamAvatar name={t.name} teamColor={t.color} />
          <View style={styles.grow}>
            <Text weight="semibold">{t.name}</Text>
            <Text variant="small" color="secondary">
              {t.college.name} · Division {t.division}
            </Text>
          </View>
        </Card>
      ))}
    </>
  );
}

function OnlyTeam({ children }: { children: string }) {
  return (
    <Card style={[styles.row, styles.tint]}>
      <Icon name="lock" size={18} color={colors.brand} />
      <Text variant="small" color="brand" style={styles.grow}>
        {children}
      </Text>
    </Card>
  );
}

function Person({ p }: { p: PersonProfile }) {
  const { width } = useWindowDimensions();
  const channels = [
    p.contact.email && { channel: 'email' as const, label: 'Email', value: p.contact.email },
    p.contact.phone && { channel: 'phone' as const, label: 'Phone', value: p.contact.phone },
    p.contact.linkedinUrl && {
      channel: 'linkedin' as const,
      label: 'LinkedIn',
      value: p.contact.linkedinUrl,
    },
  ].filter((c): c is { channel: Channel; label: string; value: string } => !!c);

  // The profile has loaded by the time this renders, so this logs once per card shown.
  useEffect(() => {
    if (p.card) {
      track({ name: 'card.viewed', properties: { cardId: p.card.id }, subjectId: p.user.id });
    }
  }, [p.card?.id, p.user.id]);

  const open = (c: { channel: Channel; value: string }) => {
    track({ name: 'contact.viewed', properties: { channel: c.channel }, subjectId: p.user.id });
    Linking.openURL(HREF[c.channel](c.value));
  };
  return (
    <Gutter>
      <View style={styles.row}>
        <Avatar name={`${p.user.firstName} ${p.user.lastName}`} role={p.user.role} size="lg" />
        <Badge caps variant="brandTint" label={ROLE_LABEL[p.user.role]} />
      </View>
      {p.card && (
        <View style={styles.center}>
          <AthleteCard
            athlete={toCardData(p.card, p.contact)}
            width={Math.min(width - spacing.md * 2, MAX_CARD_WIDTH)}
          />
        </View>
      )}
      {channels.length > 0 && (
        <>
          <SectionLabel>Contact</SectionLabel>
          <Card>
            {channels.map((c) => (
              <View key={c.label}>
                <Text variant="caption" color="muted">
                  {c.label}
                </Text>
                <Text selectable color="brand" accessibilityRole="link" onPress={() => open(c)}>
                  {c.value}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
      <Teams teams={p.teams} />
      {p.communities.length > 0 && (
        <>
          <SectionLabel>Communities</SectionLabel>
          <View style={styles.chips}>
            {p.communities.map((c) => (
              <Chip
                key={c.id}
                label={`${c.name} · ${KIND_LABEL[c.kind]}`}
                selected={false}
                onPress={() =>
                  router.push({ pathname: '/me/communities/[id]', params: { id: c.id } })
                }
              />
            ))}
          </View>
        </>
      )}
    </Gutter>
  );
}

function Teen({ p }: { p: TeenProfile }) {
  return (
    <Gutter>
      <View style={styles.row}>
        <Avatar name={`${p.user.firstName} ${p.user.lastName}`} role="teen" size="lg" />
        <Badge caps variant="brandTint" label={ROLE_LABEL.teen} />
      </View>
      <OnlyTeam>Visible only to the team. Never in search or recruiter views.</OnlyTeam>
      <Teams teams={p.teams} />
    </Gutter>
  );
}

function Child({ p }: { p: ChildProfile }) {
  return (
    <Gutter>
      <View style={styles.row}>
        <Avatar name={p.firstName} uri={p.photoUrl ?? undefined} size="lg" />
        <View style={styles.grow}>
          <Text variant="display" size="sm" color="brand">
            {p.firstName}, {p.age}
          </Text>
          <Text variant="small" color="secondary">
            Profile run by {p.parent.firstName} {p.parent.lastName}
          </Text>
        </View>
      </View>
      <OnlyTeam>
        Visible only to the team and family. Never in search, recruiter views or card exports.
      </OnlyTeam>
      {p.bio && (
        <Card>
          <Text variant="caption" color="muted">
            Interests
          </Text>
          <Text>{p.bio}</Text>
        </Card>
      )}
      <Teams teams={p.team ? [p.team] : []} />
    </Gutter>
  );
}

/** "/me/profile/[id]": someone's profile, or a child's, shaped by the API for the viewer. */
export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useApi(() => api.profile(id), [id]);
  const title =
    state.status !== 'ready'
      ? 'Profile'
      : state.data.kind === 'child'
        ? state.data.firstName
        : `${state.data.user.firstName} ${state.data.user.lastName}`;
  return (
    <Screen eyebrow="Profile" title={title} back>
      <Async state={state}>
        {(p) =>
          p.kind === 'child' ? (
            <Child p={p} />
          ) : p.kind === 'teen' ? (
            <Teen p={p} />
          ) : (
            <Person p={p} />
          )
        }
      </Async>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tint: { backgroundColor: colors.brandTint, borderColor: colors.brandTint },
  grow: { flex: 1, gap: spacing.xs },
  center: { alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
