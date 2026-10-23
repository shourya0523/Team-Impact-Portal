import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type {
  ChildProfile,
  PersonProfile,
  Profile,
  TeenProfile,
  TeamSummary,
} from '@team-impact/contracts';
import { AthleteCard } from '@team-impact/ui-primitives/native';
import { colors, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { toCardData } from '@/components/cardData';
import { ReportButton } from '@/components/Report';
import { ROLE_LABEL, KIND_LABEL } from '@/components/format';
import { Async, Chip, Gutter, Screen, SectionLabel } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Avatar, Badge, Card, Icon, TeamAvatar, Text } from '@/ui';

const MAX_CARD_WIDTH = 360;

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
    p.contact.email && { label: 'Email', value: p.contact.email },
    p.contact.phone && { label: 'Phone', value: p.contact.phone },
    p.contact.linkedinUrl && { label: 'LinkedIn', value: p.contact.linkedinUrl },
  ].filter((c): c is { label: string; value: string } => !!c);
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
                <Text selectable>{c.value}</Text>
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

/**
 * Report this person, and block them from the same form (PRD §9). Not on your own profile, and
 * Team Impact staff can be reported but never blocked. Children have no account to report: their
 * parent runs the profile, so it's the parent who can be reported or blocked.
 */
function ProfileReport({ p }: { p: Profile }) {
  const { me } = useRole();
  if (p.kind === 'child' || p.user.id === me?.id) return null;
  const { user } = p;
  return (
    <ReportButton
      target={{ kind: 'profile', id: user.id }}
      author={
        user.role === 'staff'
          ? undefined
          : { id: user.id, name: `${user.firstName} ${user.lastName}` }
      }
      // A block hides this profile from you, so there's nothing left to show here.
      onDone={() => router.back()}
    />
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
    <Screen
      eyebrow="Profile"
      title={title}
      back
      right={state.status === 'ready' && <ProfileReport p={state.data} />}
    >
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
