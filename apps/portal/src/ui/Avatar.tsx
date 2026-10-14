import { onTeamColor, resolveTeamColor } from '@team-impact/ui-tokens';
import type { CSSProperties } from 'react';

export type AvatarProps = {
  /** Used for initials and the accessible name. */
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Background colour, e.g. `colors.role.*`. Initials flip between white and ink to stay AA. */
  color?: string;
};

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

function Disc({ name, src, size = 'md', style }: AvatarProps & { style?: CSSProperties }) {
  return (
    <span role="img" aria-label={name} className={`ti-avatar ti-avatar--${size}`} style={style}>
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

export function Avatar({ color, ...props }: AvatarProps) {
  return (
    <Disc {...props} style={color ? { background: color, color: onTeamColor(color) } : undefined} />
  );
}

export type TeamAvatarProps = Omit<AvatarProps, 'color'> & {
  /** Per-team colour supplied at runtime; falls back to brand. */
  teamColor?: string | null;
};

/** Team avatar on the team's colour. Initials flip between white and ink to stay AA-legible. */
export function TeamAvatar({ teamColor, ...props }: TeamAvatarProps) {
  return <Avatar {...props} color={resolveTeamColor(teamColor)} />;
}
