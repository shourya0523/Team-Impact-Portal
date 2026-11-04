import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { TeamMember, UserSummary } from '@team-impact/contracts';
import { radius, spacing, colors } from '@team-impact/ui-tokens';
import { useRole } from '@/navigation/role';
import { Avatar, Text } from '@/ui';
import { ROLE_LABEL, shortDate } from './format';

/**
 * Team tab composites, shared by the roster and the coach's screens. A coach on several teams
 * manages the first one for now; a team picker comes with multi-team coaches.
 */
export const useTeamId = (): string | null => useRole().me?.teamIds[0] ?? null;

export const fullName = (u: Pick<UserSummary, 'firstName' | 'lastName'>) =>
  `${u.firstName} ${u.lastName}`;

const JOINED_VIA: Record<TeamMember['joinedVia'], string> = {
  coach_invite: 'invited',
  join_request: 'approved',
  qr_code: 'joined with a code',
};

/** "Coach · invited by Dana Lee Oct 3", "Athlete · joined with a code Oct 5". */
export const joinedLine = (m: TeamMember) =>
  `${ROLE_LABEL[m.user.role]} · ${JOINED_VIA[m.joinedVia]}${
    m.addedBy ? ` by ${fullName(m.addedBy)}` : ''
  } ${shortDate(m.joinedAt)}`;

/** "JUMBQ7K4" reads out as "JUMB-Q7K4". */
export const formatShortCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** "Mateo", "Mateo and Ella", "Mateo, Ella and Ben". */
export const nameList = (names: string[]) =>
  names.length <= 1
    ? (names[0] ?? '')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** One person in a list: avatar, name, a line under it, and whatever goes on the right. */
export function PersonRow({
  user,
  detail,
  children,
  right,
}: {
  user: UserSummary;
  detail: string;
  /** Extra lines under the detail, like a family's contact details. */
  children?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Avatar name={fullName(user)} role={user.role} uri={user.avatarUrl ?? undefined} />
      <View style={styles.grow}>
        <Text weight="semibold">{fullName(user)}</Text>
        <Text variant="caption" weight="medium" color="muted">
          {detail}
        </Text>
        {children}
      </View>
      {right}
    </View>
  );
}

/** Shown when the signed-in account isn't on a team yet. */
export function NoTeam() {
  return (
    <View style={styles.empty}>
      <Text variant="display" size="xs" color="brand">
        No team yet
      </Text>
      <Text variant="small" color="secondary" style={styles.center}>
        Once your coach lets you in, your team shows up here.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, gap: spacing.xs },
  center: { textAlign: 'center' },
  empty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
});
