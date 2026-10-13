import type { CommunityKind, Role } from '@team-impact/contracts';

/**
 * The athlete app's look, from the approved design canvas (navy and CTA red on warm paper, Barlow
 * Condensed headlines). Values match the hi-fi mockups (apps/mockups/src/shared/styles.css).
 *
 * TODO(token decision): fold these into @team-impact/ui-tokens once the lead picks between the
 * current tokens and design/signing-day-tokens. The tokens' red (#fd002b) is too light for white
 * text, so CTAs use #d0213c here (5.3:1).
 */
export const c = {
  navy: '#1e3f7b',
  navyPressed: '#152e5c',
  navyRaised: '#2b5296',
  navyTint: '#e4e9f2',
  onNavy: '#c5cfe3',
  onNavyMuted: '#a9b6d3',
  red: '#d0213c',
  redPressed: '#b01a2d',
  redTint: '#fbe3e7',
  ground: '#f6f4ef',
  surface: '#ffffff',
  ink: '#111418',
  text2: '#4a4f57',
  muted: '#5c616a',
  line: '#ddd8cd',
  lineSoft: '#ece8df',
  track: '#ece8df',
  amber: '#f2c14e',
  amberDeep: '#e3ac2b',
  amberText: '#7a5200',
  green: '#0b3d30',
  okBg: '#ddf1ea',
  okFg: '#0b3d30',
  warnBg: '#fcebd2',
  warnFg: '#8a4a00',
  danger: '#b3261e',
} as const;

/** Font family names as loaded in app/_layout.tsx. Custom fonts carry their own weight. */
export const font = {
  display: 'BarlowCondensed_800ExtraBold',
  displayBold: 'BarlowCondensed_700Bold',
  body: 'Barlow_400Regular',
  medium: 'Barlow_500Medium',
  semibold: 'Barlow_600SemiBold',
  bold: 'Barlow_700Bold',
} as const;

/** Avatar colours by role, so a coach reads differently from a parent at a glance. */
export const ROLE_COLOR: Record<Role, { bg: string; fg: string }> = {
  staff: { bg: c.red, fg: '#ffffff' },
  coach: { bg: c.ink, fg: '#ffffff' },
  athlete: { bg: c.navy, fg: '#ffffff' },
  parent: { bg: '#5b3fa0', fg: '#ffffff' },
  teen: { bg: c.amber, fg: c.ink },
  recruiter: { bg: c.green, fg: '#ffffff' },
  alumni_athlete: { bg: '#0f6b5f', fg: '#ffffff' },
  alumni_mentor: { bg: '#0f6b5f', fg: '#ffffff' },
};

/** Each community kind's cover band, monogram tint and label colour. */
export const KIND_STYLE: Record<
  CommunityKind,
  { band: string; monogram: string; icon: string; label: string }
> = {
  team: { band: c.navy, monogram: c.navyRaised, icon: c.navy, label: c.navy },
  team_impact: { band: c.red, monogram: '#e2435b', icon: c.red, label: c.redPressed },
  interest: { band: c.amber, monogram: c.amberDeep, icon: c.amberText, label: c.amberText },
  medical: { band: c.navyTint, monogram: '#d3dbea', icon: c.navy, label: c.navy },
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
