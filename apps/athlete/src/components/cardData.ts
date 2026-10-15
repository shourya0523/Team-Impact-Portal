import type { CardFace, CardFields, ExperienceEntry } from '@team-impact/contracts';

/** Shared or own contact details; null and missing both mean "not shown". */
type Contact = { email?: string | null; phone?: string | null; linkedinUrl?: string | null };
import type { AthleteCardData } from '@team-impact/ui-primitives/native';

/**
 * A card face from the API as the shared card primitive's input. Contact details go on the back
 * only when the caller passes them (never for teen viewers or exports). Experience entries go
 * straight onto the card's rows.
 */
export const toCardData = (face: CardFace, contact?: Contact): AthleteCardData => ({
  id: face.athleteId,
  firstName: face.firstName,
  lastName: face.lastName,
  photoUri: face.photoUrl,
  jerseyNumber: face.jerseyNumber ?? undefined,
  sport: face.team?.sport ?? 'Athlete',
  position: face.position ?? undefined,
  school: face.team?.college.name,
  resume: {
    stats: [
      { label: 'Class', value: String(face.classYear) },
      { label: 'Major', value: face.major },
    ],
    experience: face.experience,
    skills: face.skills,
  },
  personal: {
    hometown: face.hometown ?? undefined,
    bio: face.lookingFor ? `Looking for: ${face.lookingFor}` : undefined,
    facts: face.city ? [{ label: 'City', value: face.city }] : [],
    interests: [],
    contact: contact && {
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
      social: contact.linkedinUrl ?? undefined,
    },
  },
});

/** Labels for card fields, in the order the editor and the review list them. */
export const FIELD_LABEL: Record<keyof CardFields, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  position: 'Position',
  jerseyNumber: 'Jersey number',
  classYear: 'Class year',
  major: 'Major',
  hometown: 'Hometown',
  city: 'City',
  region: 'Region',
  experience: 'Experience',
  skills: 'Skills',
  lookingFor: 'Looking for',
};

/** "Treasurer · Investment club · 2025 – Now", leaving out blank parts. */
export const entryText = (e: ExperienceEntry) =>
  [e.role, e.organization, e.period].filter((part) => part.trim() !== '').join(' · ');

const isEntry = (v: unknown): v is ExperienceEntry =>
  typeof v === 'object' && v !== null && 'role' in v;

/** A field's value as plain text, for review lists. */
export const fieldText = (value: unknown): string =>
  Array.isArray(value)
    ? value
        .map((v) => (isEntry(v) ? entryText(v) : String(v)))
        .join(isEntry(value[0]) ? '; ' : ', ')
    : value === null || value === undefined
      ? ''
      : String(value);
