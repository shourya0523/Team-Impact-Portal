import { useCallback, useState } from 'react';
import { resolveTeamColor } from '@team-impact/ui-tokens';
import { fitName, type NameFit } from './fit';
import { CARD_WIDTH, cardLayout } from './spec';
import type { AthleteCardData, AthleteStat, ResumeEntry } from './types';

/** The card has a fixed size, so lists are capped rather than allowed to overflow. */
export const CARD_LIMITS = {
  stats: 3,
  experience: 3,
  skills: 5,
  /** One row of tiles: the back also holds experience and skills since the rookie front. */
  facts: 2,
  interests: 5,
} as const;

/** Room for the nameplate under the photo, in base units. */
export const NAME_MAX_WIDTH = CARD_WIDTH - cardLayout.lowerPaddingX * 2;

/** The rookie nameplate's fit for this name (see `fitName`). */
export const fitCardName = (firstName: string, lastName: string): NameFit =>
  fitName(firstName, lastName, {
    maxWidth: NAME_MAX_WIDTH,
    maxSize: cardLayout.nameMaxSize,
    minSize: cardLayout.nameMinSize,
    charWidth: cardLayout.nameCharWidth,
  });

export interface ContactLine {
  label: string;
  value: string;
}

export interface PreparedCard {
  seed: string;
  photoUri: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  initials: string;
  jerseyNumber: string | null;
  metaLine: string;
  /** Sport and school, the line under the photo. */
  teamLine: string;
  positionBadge: string | null;
  school: string | null;
  stats: AthleteStat[];
  experience: ResumeEntry[];
  skills: string[];
  personalLine: string;
  bio: string | null;
  facts: AthleteStat[];
  interests: string[];
  contact: ContactLine[];
  /** Rookie front (TI-114). Stripe colour: the team's, else brand navy. */
  teamColor: string;
  /** Jersey number as printed over the photo, without "#": "07". */
  jerseyDigits: string | null;
  /** Name lines and size for the nameplate; long names shrink, wrap, then end in "…". */
  nameFit: NameFit;
  /** "Midfielder · Women's Soccer · Northeastern": position, team and school, blanks left out. */
  rookieLine: string;
  /** Class, major and division cells (missing ones left out); else the first resume stats. */
  rookieStats: AthleteStat[];
  /** "Season 2026", or null. */
  seasonLine: string | null;
}

/** "Midfielder" -> "MI", "Point Guard" -> "PG". Prefer passing `positionShort`. */
const abbreviate = (position: string | undefined) => {
  const words =
    position
      ?.trim()
      .split(/[\s-]+/)
      .filter(Boolean) ?? [];
  if (words.length === 0) return null;
  const letters = words.length > 1 ? words.map((w) => w.charAt(0)).join('') : (words[0] ?? '');
  return letters.slice(0, 2).toUpperCase();
};

const joinDefined = (parts: (string | null | undefined)[], separator: string) =>
  parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(separator);

const clean = (value: string | number | null | undefined) =>
  value === null || value === undefined ? '' : String(value).trim();

/** "Northeastern University" -> "Northeastern", as on the Signing Day mockup. */
const shortSchool = (school: string | undefined) => school?.replace(/\s+University$/i, '').trim();

/** Class, major and division when given; otherwise the caller's first stats (older callers). */
const rookieStatsFor = (athlete: AthleteCardData): AthleteStat[] => {
  const classYear = clean(athlete.classYear);
  // "Economics, Data Science minor" -> "Economics": the cell has room for one line.
  const major = clean(athlete.major).split(',')[0]?.trim() ?? '';
  const division = clean(athlete.division);
  if (classYear || major || division) {
    return [
      { label: 'Class', value: classYear },
      { label: 'Major', value: major },
      { label: 'Division', value: division },
    ].filter((stat) => stat.value !== '');
  }
  return athlete.resume.stats
    .map((stat) => ({ label: stat.label.trim(), value: stat.value.trim() }))
    .filter((stat) => stat.label !== '' && stat.value !== '')
    .slice(0, CARD_LIMITS.stats);
};

export const prepareCard = (athlete: AthleteCardData): PreparedCard => {
  const { personal, resume } = athlete;
  const contact = personal.contact;
  const firstName = athlete.firstName.trim();
  const lastName = athlete.lastName.trim();
  const jerseyDigits = clean(athlete.jerseyNumber).replace(/^#/, '') || null;
  const season = clean(athlete.season);
  return {
    seed: athlete.id,
    photoUri: athlete.photoUri || null,
    firstName,
    lastName,
    fullName: joinDefined([firstName, lastName], ' '),
    initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
    jerseyNumber: jerseyDigits ? `#${jerseyDigits}` : null,
    metaLine: joinDefined([athlete.sport, athlete.position], ' · '),
    teamLine: joinDefined([athlete.sport, athlete.school], ' · '),
    positionBadge: athlete.positionShort ?? abbreviate(athlete.position),
    school: athlete.school || null,
    stats: resume.stats.slice(0, CARD_LIMITS.stats),
    // Rows as the athlete entered them (role / organisation / period), blank ones dropped.
    experience: resume.experience
      .map((e) => ({
        role: e.role.trim(),
        organization: e.organization.trim(),
        period: e.period.trim(),
      }))
      .filter((e) => e.role !== '')
      .slice(0, CARD_LIMITS.experience),
    skills: resume.skills
      .map((skill) => skill.trim())
      .filter(Boolean)
      .slice(0, CARD_LIMITS.skills),
    personalLine: joinDefined([personal.hometown, personal.pronouns], ' · '),
    bio: personal.bio || null,
    facts: personal.facts
      .filter((fact) => fact.label.trim() !== '' && fact.value.trim() !== '')
      .slice(0, CARD_LIMITS.facts),
    interests: personal.interests
      .map((interest) => interest.trim())
      .filter(Boolean)
      .slice(0, CARD_LIMITS.interests),
    contact: [
      { label: 'Email', value: contact?.email },
      { label: 'Phone', value: contact?.phone },
      { label: 'Social', value: contact?.social },
    ].filter((line): line is ContactLine => Boolean(line.value)),
    teamColor: resolveTeamColor(athlete.teamColor),
    jerseyDigits,
    nameFit: fitCardName(firstName, lastName),
    rookieLine: joinDefined(
      [athlete.position, athlete.teamName || athlete.sport, shortSchool(athlete.school)],
      ' · ',
    ),
    rookieStats: rookieStatsFor(athlete),
    seasonLine: season ? `Season ${season}` : null,
  };
};

/** Controlled (`flipped`) or uncontrolled (`defaultFlipped`) flip state, shared by both renderers. */
export const useFlipState = (
  flipped: boolean | undefined,
  defaultFlipped = false,
  onFlippedChange?: (flipped: boolean) => void,
) => {
  const [uncontrolled, setUncontrolled] = useState(defaultFlipped);
  const isControlled = flipped !== undefined;
  const value = isControlled ? flipped : uncontrolled;
  const setFlipped = useCallback(
    (next: boolean) => {
      if (next === value) return;
      if (!isControlled) setUncontrolled(next);
      onFlippedChange?.(next);
    },
    [isControlled, value, onFlippedChange],
  );
  return [value, setFlipped] as const;
};

/** Screen reader label for the visible side. */
export const describeCard = (card: PreparedCard, flipped: boolean) =>
  flipped
    ? `${card.fullName}, experience and personal info. ${joinDefined(
        [
          card.experience.map((e) => joinDefined([e.role, e.organization], ' at ')).join(', '),
          card.personalLine,
          card.bio,
        ],
        '. ',
      )}`
    : `${card.fullName}, athlete resume. ${joinDefined(
        [
          joinDefined([card.jerseyDigits && `Number ${card.jerseyDigits}`, card.rookieLine], ', '),
          card.rookieStats.map((s) => `${s.label} ${s.value}`).join(', '),
        ],
        '. ',
      )}`;

/** Fictional athlete used by the card demos on both the app and the portal. */
export const sampleAthlete: AthleteCardData = {
  id: 'demo-maya-okafor',
  firstName: 'Maya',
  lastName: 'Okafor',
  jerseyNumber: '8',
  sport: "Women's Soccer",
  position: 'Midfielder',
  positionShort: 'MF',
  school: 'Northeastern University',
  teamName: "Women's Soccer",
  classYear: 2027,
  major: 'Business Analytics',
  division: 'I',
  season: 2026,
  resume: {
    stats: [
      { label: 'GPA', value: '3.7' },
      { label: 'Starts', value: '42' },
      { label: 'Captain', value: '2x' },
    ],
    experience: [
      { role: 'Analytics Intern', organization: 'Lumen Logistics', period: 'Summer 2026' },
      { role: 'Team Captain', organization: "NU Women's Soccer", period: '2025 – Now' },
      { role: 'Peer Mentor', organization: 'Team Impact', period: '2024 – Now' },
    ],
    skills: ['Python', 'SQL', 'Tableau', 'Leadership', 'Public speaking'],
  },
  personal: {
    hometown: 'Providence, RI',
    pronouns: 'she/her',
    bio: "Engine-room midfielder who lives for the build-up. Off the pitch I'm usually behind a film camera or hunting for Boston's best ramen.",
    facts: [
      { label: 'Walk-up song', value: 'Run the World' },
      { label: 'Pre-game', value: 'Banana + playlist' },
    ],
    interests: ['Film photography', 'Ramen', 'Chess', 'Hiking'],
    contact: { email: 'maya.okafor@example.com', social: '@mayaokafor' },
  },
};
