import type { CommunityKind } from '@team-impact/contracts';
import { colors } from '@team-impact/ui-tokens';
import type { TextColor } from '@/ui';

/**
 * App-level styling composed from the Signing Day tokens (TI-72): navy and action red on warm
 * paper. Colours live in @team-impact/ui-tokens only; this file just picks which token goes where.
 */

/**
 * Each community kind's cover band, decorative monogram, icon and label colour, plus the text
 * colour that reads on the band (`onBand`, AA-checked in ui-tokens `textPairs`).
 */
export const KIND_STYLE: Record<
  CommunityKind,
  { band: string; monogram: string; icon: string; label: string; onBand: TextColor }
> = {
  team: {
    band: colors.brand,
    monogram: colors.brandRaised,
    icon: colors.brand,
    label: colors.brand,
    onBand: 'onBrand',
  },
  team_impact: {
    band: colors.action,
    monogram: colors.red,
    icon: colors.action,
    label: colors.actionPressed,
    onBand: 'onBrand',
  },
  interest: {
    band: colors.accent.bg,
    monogram: colors.accent.deep,
    icon: colors.accent.text,
    label: colors.accent.text,
    onBand: 'ink',
  },
  medical: {
    band: colors.brandTint,
    monogram: colors.onBrand.secondary,
    icon: colors.brand,
    label: colors.brand,
    onBand: 'brand',
  },
};

export const initials = (first: string, last = '') =>
  `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();

const SMALL_WORDS = new Set(['a', 'an', 'and', 'for', 'in', 'of', 'the', 'to']);

/**
 * Two letters for a name: first letters of its first two words. Team communities are named after
 * their college ("Tufts Women's Soccer"), so `skipFirst` drops it to give "WS".
 */
export const monogram = (name: string, skipFirst = false) => {
  const words = name
    .replace(/['’]s\b/g, '')
    .replace(/[^A-Za-z ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(skipFirst ? 1 : 0)
    // "Athletes in Finance" → AF, not AI.
    .filter((w, i) => i === 0 || !SMALL_WORDS.has(w.toLowerCase()));
  return initials(words[0] ?? '', words[1] ?? '');
};
