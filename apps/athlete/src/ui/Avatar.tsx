import { Image, StyleSheet, View } from 'react-native';
import { colors, layout, onTeamColor, resolveTeamColor } from '@team-impact/ui-tokens';
import { Text } from './Text';

type Size = keyof typeof layout.avatar;

export type AvatarProps = {
  /** Used for initials and the accessibility label. */
  name: string;
  uri?: string;
  size?: Size;
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
        <Text variant="small" weight="semibold" style={{ color }}>
          {initials(name)}
        </Text>
      )}
    </View>
  );
}

export function Avatar(props: AvatarProps) {
  return <Disc {...props} background={colors.line} color={colors.ink} />;
}

export type TeamAvatarProps = AvatarProps & {
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
