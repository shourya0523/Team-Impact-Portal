import { readableOn } from './accessibility';
import { colors } from './colors';

/**
 * Each team supplies its own colour at runtime (avatar, card stripe). Falls back to the brand
 * colour when a team has none or the value is not a 6-digit hex.
 */
export function resolveTeamColor(teamColor?: string | null): string {
  return teamColor && /^#[0-9a-fA-F]{6}$/.test(teamColor) ? teamColor : colors.team;
}

/** Text colour (white or ink) that stays legible on a team's colour. */
export const onTeamColor = readableOn;
