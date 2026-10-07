import { onTeamColor, resolveTeamColor } from '@team-impact/ui-tokens';
import type { CSSProperties } from 'react';

export type AvatarProps = {
  /** Used for initials and the accessible name. */
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
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

export function Avatar(props: AvatarProps) {
  return <Disc {...props} />;
}

export type TeamAvatarProps = AvatarProps & {
  /** Per-team colour supplied at runtime; falls back to brand. */
  teamColor?: string | null;
};

/** Team avatar on the team's colour. Initials flip between white and ink to stay AA-legible. */
export function TeamAvatar({ teamColor, ...props }: TeamAvatarProps) {
  const bg = resolveTeamColor(teamColor);
  return <Disc {...props} style={{ background: bg, color: onTeamColor(bg) }} />;
}
