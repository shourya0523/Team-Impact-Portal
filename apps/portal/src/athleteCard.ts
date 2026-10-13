import type { CardFace, SharedContact } from '@team-impact/contracts';
import type { AthleteCardData } from '@team-impact/ui-primitives/web';

const REGION_NAMES = { northeast: 'Northeast', midwest: 'Midwest', south: 'South', west: 'West' };

export const regionName = (region: CardFace['region']) => (region ? REGION_NAMES[region] : null);

/**
 * Contract card → the shared card component. Only what the viewer was sent goes in: contacts come
 * from the API's `SharedContact`, which already holds just the channels shared with this viewer.
 * Experience entries (up to 3 role / organisation / period rows, TI-150) fill the card's
 * experience rows directly; what the athlete is looking for goes on the back.
 */
export const toCardData = (card: CardFace, contact?: SharedContact): AthleteCardData => ({
  id: card.id,
  firstName: card.firstName,
  lastName: card.lastName,
  photoUri: card.photoUrl,
  jerseyNumber: card.jerseyNumber ?? undefined,
  sport: card.team ? card.team.name : 'Alumni',
  position: card.position ?? undefined,
  school: card.team?.college.name,
  resume: {
    stats: [
      { label: 'Class', value: String(card.classYear) },
      ...(card.team ? [{ label: 'Div', value: card.team.division }] : []),
      ...(card.region ? [{ label: 'Region', value: regionName(card.region)! }] : []),
    ],
    experience: card.experience,
    skills: card.skills,
  },
  personal: {
    hometown: card.hometown ?? undefined,
    bio: card.lookingFor ? `Looking for: ${card.lookingFor}` : undefined,
    facts: [
      { label: 'Major', value: card.major },
      { label: 'Class of', value: String(card.classYear) },
      ...(card.city ? [{ label: 'City', value: card.city }] : []),
    ],
    interests: [],
    contact: contact && {
      email: contact.email,
      phone: contact.phone,
      social: contact.linkedinUrl,
    },
  },
});
