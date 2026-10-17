import { router, type Href } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { ContactSharing, Role } from '@team-impact/contracts';
import { colors, layout, radius, spacing } from '@team-impact/ui-tokens';
import { api } from '@/api';
import { ROLE_LABEL } from '@/components/format';
import { Gutter, Screen } from '@/components/ui';
import { useApi } from '@/hooks/useApi';
import { useRole } from '@/navigation/role';
import { Avatar, Button, Card, Icon, Text } from '@/ui';

interface Row {
  label: string;
  /** Shown muted at the end of the row: a count, On/Off, the shared channels. */
  value?: string;
  href?: Href;
  danger?: boolean;
}

/** Loads only when the role needs it; a failed load leaves the row's value blank. */
const ready = <T,>(s: { status: string; data?: T }) => (s.status === 'ready' ? s.data : undefined);

const sharedChannels = (s: ContactSharing | null | undefined) => {
  if (!s) return undefined;
  const on = [s.phone && 'Phone', s.email && 'Email', s.linkedin && 'LinkedIn'].filter(Boolean);
  return on.length ? on.join(', ') : 'None';
};

const hasTeam = (role: Role) =>
  role === 'athlete' || role === 'parent' || role === 'teen' || role === 'coach';

/**
 * "/me" (A-39): who you're signed in as, the settings your role has, then safety and sign out.
 * Every role has this tab; recruiters use it to reach their lists and to sign out.
 */
export default function Me() {
  const { me, role, setRole, setMe } = useRole();
  const teamId = me?.teamIds[0];

  const roster = useApi(
    () => (role && hasTeam(role) && teamId ? api.roster(teamId) : Promise.resolve(null)),
    [role, teamId],
  );
  const settings = useApi(
    () => (role === 'athlete' ? api.settings() : Promise.resolve(null)),
    [role],
  );
  const children = useApi(() => (role === 'parent' ? api.children() : Promise.resolve([])), [role]);
  const communities = useApi(
    () => (role && role !== 'recruiter' ? api.communities() : Promise.resolve([])),
    [role],
  );

  if (!role) return null;

  const team = ready(roster.state)?.team;
  const s = ready(settings.state);
  const joined = ready(communities.state)?.filter((c) => c.myMembership).length;
  const myCommunities: Row = {
    label: 'My communities',
    value: joined === undefined ? undefined : String(joined),
    href: '/me/communities',
  };
  const privacy: Row = { label: 'Privacy and search', href: '/me/privacy' };
  const alumni: Row = { label: 'Alumni who help', href: '/me/alumni' };

  const rows: Row[] =
    role === 'athlete'
      ? [
          {
            label: 'Contacts for families',
            value: sharedChannels(s?.familiesSee),
            href: '/me/recruiting',
          },
          {
            label: 'Open to recruiting',
            value: s ? (s.openToRecruiting.on ? 'On' : 'Off') : undefined,
            href: '/me/recruiting',
          },
          myCommunities,
          privacy,
          alumni,
          { label: 'Card history', href: '/card/history' },
        ]
      : role === 'parent'
        ? [
            ...(ready(children.state) ?? []).map((c) => ({
              label: `${c.firstName}’s profile`,
              value: `Age ${c.age}`,
              href: '/child' as Href,
            })),
            myCommunities,
            privacy,
          ]
        : role === 'teen'
          ? [myCommunities, privacy]
          : role === 'coach'
            ? [
                { label: 'Team details', value: team?.name, href: '/team/edit' },
                {
                  label: 'Coaches',
                  value:
                    roster.state.status === 'ready'
                      ? String(ready(roster.state)?.coaches.length ?? 0)
                      : undefined,
                  href: '/team/add-coach',
                },
                { label: 'Join QR codes', href: '/team/qr' },
                myCommunities,
                privacy,
              ]
            : role === 'alumni_athlete'
              ? [
                  alumni,
                  myCommunities,
                  { label: 'Claim a pre-built card', href: '/card/claim' },
                  privacy,
                ]
              : role === 'alumni_mentor'
                ? [alumni, myCommunities, privacy]
                : role === 'recruiter'
                  ? [{ label: 'Saved lists', href: '/lists' }]
                  : [myCommunities];

  const safety: Row[] = [
    { label: 'Notifications', href: '/me/safety' },
    { label: 'Blocked people and reports', href: '/me/safety' },
    { label: 'Delete account', href: '/me/safety', danger: true },
  ];

  const name = me ? `${me.firstName} ${me.lastName}` : ROLE_LABEL[role];
  const subtitle = [ROLE_LABEL[role], team?.name, team?.college.name].filter(Boolean).join(' · ');

  const signOut = () => {
    // Clear the session cookie too; go to the landing page even if the API is down.
    void api.signOut().catch(() => undefined);
    setMe(null);
    setRole(null);
    router.replace('/welcome');
  };

  return (
    <Screen eyebrow="Your account" title="Me">
      <Gutter gap="md">
        <View style={styles.who}>
          <Avatar name={name} role={role} size="lg" />
          <View style={styles.grow}>
            <Text variant="display" size="sm" color="ink" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="small" color="secondary" numberOfLines={2}>
              {subtitle}
            </Text>
          </View>
        </View>

        {role === 'teen' && (
          <Card style={styles.notice}>
            <Icon name="lock" size={18} color={colors.brand} />
            <Text variant="small" color="secondary" style={styles.grow}>
              Only your team and family see your profile. Athletes’ contact details stay hidden on
              teen accounts.
            </Text>
          </Card>
        )}
        {role === 'recruiter' && (
          <Card style={styles.notice}>
            <Icon name="search" size={18} color={colors.brand} />
            <Text variant="small" color="secondary" style={styles.grow}>
              Full search, notes and sharing with colleagues are on the Team IMPACT web portal.
            </Text>
          </Card>
        )}

        <RowGroup rows={rows} />
        <RowGroup rows={safety} />
        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </Gutter>
    </Screen>
  );
}

/** A card of tappable rows, each with a chevron; rows without `href` are read-only. */
function RowGroup({ rows }: { rows: Row[] }) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.group}>
      {rows.map((r, i) => (
        <Fragment key={r.label}>
          {i > 0 && <View style={styles.divider} />}
          <Pressable
            disabled={!r.href}
            onPress={() => r.href && router.push(r.href)}
            accessibilityRole={r.href ? 'button' : undefined}
            accessibilityLabel={r.value ? `${r.label}, ${r.value}` : r.label}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text weight="medium" color={r.danger ? 'danger' : 'ink'} style={styles.grow}>
              {r.label}
            </Text>
            {r.value !== undefined && (
              <Text variant="small" color="muted" numberOfLines={1} style={styles.value}>
                {r.value}
              </Text>
            )}
            {r.href && <Icon name="chevron" size={18} color={colors.text.muted} />}
          </Pressable>
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  notice: { flexDirection: 'row', alignItems: 'flex-start' },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    minHeight: layout.minTouchTarget + spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  pressed: { backgroundColor: colors.lineSoft },
  divider: { height: 1, backgroundColor: colors.lineSoft, marginLeft: spacing.md },
  value: { maxWidth: '45%' },
});
