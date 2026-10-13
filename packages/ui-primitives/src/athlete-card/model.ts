import { useCallback, useState } from 'react';
import type { AthleteCardData, AthleteStat, ResumeEntry } from './types';

/** The card has a fixed size, so lists are capped rather than allowed to overflow. */
export const CARD_LIMITS = {
  stats: 3,
  experience: 3,
  skills: 5,
  facts: 4,
  interests: 5,
} as const;

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

const joinDefined = (parts: (string | undefined)[], separator: string) =>
  parts.filter((part): part is string => Boolean(part?.trim())).join(separator);

export const prepareCard = (athlete: AthleteCardData): PreparedCard => {
  const { personal, resume } = athlete;
  const contact = personal.contact;
  return {
    seed: athlete.id,
    photoUri: athlete.photoUri || null,
    firstName: athlete.firstName,
    lastName: athlete.lastName,
    fullName: `${athlete.firstName} ${athlete.lastName}`,
    initials: `${athlete.firstName.charAt(0)}${athlete.lastName.charAt(0)}`.toUpperCase(),
    jerseyNumber: athlete.jerseyNumber ? `#${athlete.jerseyNumber.replace(/^#/, '')}` : null,
    metaLine: joinDefined([athlete.sport, athlete.position], ' · '),
    teamLine: joinDefined([athlete.sport, athlete.school], ' · '),
    positionBadge: athlete.positionShort ?? abbreviate(athlete.position),
    school: athlete.school || null,
    stats: resume.stats.slice(0, CARD_LIMITS.stats),
    experience: resume.experience.slice(0, CARD_LIMITS.experience),
    skills: resume.skills.slice(0, CARD_LIMITS.skills),
    personalLine: joinDefined([personal.hometown, personal.pronouns], ' · '),
    bio: personal.bio || null,
    facts: personal.facts.slice(0, CARD_LIMITS.facts),
    interests: personal.interests.slice(0, CARD_LIMITS.interests),
    contact: [
      { label: 'Email', value: contact?.email },
      { label: 'Phone', value: contact?.phone },
      { label: 'Social', value: contact?.social },
    ].filter((line): line is ContactLine => Boolean(line.value)),
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

export const describeCard = (card: PreparedCard, flipped: boolean) =>
  flipped
    ? `${card.fullName}, personal info. ${joinDefined([card.personalLine, card.bio ?? undefined], '. ')}`
    : `${card.fullName}, athlete resume. ${joinDefined([card.metaLine, card.school ?? undefined], ', ')}`;

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
      { label: 'Major', value: 'Business Analytics' },
      { label: 'Class of', value: '2027' },
      { label: 'Walk-up song', value: 'Run the World' },
      { label: 'Pre-game', value: 'Banana + playlist' },
    ],
    interests: ['Film photography', 'Ramen', 'Chess', 'Hiking'],
    contact: { email: 'maya.okafor@example.com', social: '@mayaokafor' },
  },
};
