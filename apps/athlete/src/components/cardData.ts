import type { CardFace, CardFields } from '@team-impact/contracts';

/** Shared or own contact details; null and missing both mean "not shown". */
type Contact = { email?: string | null; phone?: string | null; linkedinUrl?: string | null };
import type { AthleteCardData } from '@team-impact/ui-primitives/native';

/**
 * A card face from the API as the shared card primitive's input. Contact details go on the back
 * only when the caller passes them (never for teen viewers or exports). Experience is still a
 * string in the contracts, so each `;`-separated part becomes one entry.
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
    experience: (face.experience ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((role) => ({ role, organization: '', period: '' })),
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

/** A field's value as plain text, for review lists. */
export const fieldText = (value: unknown) =>
  Array.isArray(value)
    ? value.join(', ')
    : value === null || value === undefined
      ? ''
      : String(value);
