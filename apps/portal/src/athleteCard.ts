import type { CardFace, SharedContact } from '@team-impact/contracts';
import type { AthleteCardData } from '@team-impact/ui-primitives/web';

const REGION_NAMES = { northeast: 'Northeast', midwest: 'Midwest', south: 'South', west: 'West' };

export const regionName = (region: CardFace['region']) => (region ? REGION_NAMES[region] : null);

/**
 * Contract card → the shared card component. Only what the viewer was sent goes in: contacts come
 * from the API's `SharedContact`, which already holds just the channels shared with this viewer.
 * The rookie front (TI-114) gets the team's name, colour and division plus class and major;
 * experience entries (up to 3 role / organisation / period rows, TI-150) and what the athlete is
 * looking for go on the back.
 */
export const toCardData = (card: CardFace, contact?: SharedContact): AthleteCardData => {
  const region = regionName(card.region);
  return {
    id: card.id,
    firstName: card.firstName,
    lastName: card.lastName,
    photoUri: card.photoUrl,
    jerseyNumber: card.jerseyNumber ?? undefined,
    sport: card.team ? card.team.sport : 'Alumni',
    position: card.position ?? undefined,
    school: card.team?.college.name,
    teamName: card.team?.name,
    teamColor: card.team?.color,
    classYear: card.classYear,
    major: card.major,
    division: card.team?.division,
    season: card.season,
    resume: {
      stats: [],
      experience: card.experience,
      skills: card.skills,
    },
    personal: {
      hometown: card.hometown ?? undefined,
      bio: card.lookingFor ? `Looking for: ${card.lookingFor}` : undefined,
      facts: [
        ...(card.city ? [{ label: 'City', value: card.city }] : []),
        ...(region ? [{ label: 'Region', value: region }] : []),
      ],
      interests: [],
      contact: contact && {
        email: contact.email,
        phone: contact.phone,
        social: contact.linkedinUrl,
      },
    },
  };
};
