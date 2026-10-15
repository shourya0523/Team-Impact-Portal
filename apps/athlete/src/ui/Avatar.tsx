import { Image, StyleSheet, View } from 'react-native';
import type { Role } from '@team-impact/contracts';
import { colors, layout, onTeamColor, resolveTeamColor } from '@team-impact/ui-tokens';
import { Text } from './Text';

type Size = keyof typeof layout.avatar;

export type AvatarProps = {
  /** Used for initials and the accessibility label. */
  name: string;
  uri?: string;
  size?: Size;
  /** Colours the disc by role (colors.role), so a coach reads differently from a parent. */
  role?: Role;
};

const ROLE_BG: Record<Role, string> = {
  staff: colors.role.staff,
  coach: colors.role.coach,
  athlete: colors.role.athlete,
  parent: colors.role.parent,
  teen: colors.role.teen,
  recruiter: colors.role.recruiter,
  alumni_athlete: colors.role.alumni,
  alumni_mentor: colors.role.alumni,
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

function Disc({
  name,
  uri,
  size = 'md',
  background,
  color,
}: AvatarProps & { background: string; color: string }) {
  const d = layout.avatar[size];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[
        styles.disc,
        { width: d, height: d, borderRadius: d / 2, backgroundColor: background },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: d, height: d }} accessibilityIgnoresInvertColors />
      ) : (
        <Text
          variant={size === 'lg' ? 'body' : size === 'sm' ? 'caption' : 'small'}
          weight="semibold"
          style={{ color }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

export function Avatar({ role, ...props }: AvatarProps) {
  if (role) {
    const bg = ROLE_BG[role];
    return <Disc {...props} background={bg} color={onTeamColor(bg)} />;
  }
  return <Disc {...props} background={colors.line} color={colors.ink} />;
}

export type TeamAvatarProps = Omit<AvatarProps, 'role'> & {
  /** Per-team colour supplied at runtime; falls back to brand. */
  teamColor?: string | null;
};

/** Team avatar on the team's colour. Initials flip between white and ink to stay AA-legible. */
export function TeamAvatar({ teamColor, ...props }: TeamAvatarProps) {
  const bg = resolveTeamColor(teamColor);
  return <Disc {...props} background={bg} color={onTeamColor(bg)} />;
}

const styles = StyleSheet.create({
  disc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
