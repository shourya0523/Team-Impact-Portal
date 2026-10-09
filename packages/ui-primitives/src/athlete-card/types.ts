/**
 * Data shown on the flippable athlete card. Front = resume, back = personal info.
 *
 * PRD guard rails the caller is responsible for (the card renders whatever it is given):
 * - Never pass a child profile (under 13 or teen) to a card that will be exported or shown
 *   outside the athlete's team and family.
 * - Omit `personal.contact` when the viewer is a teen.
 * - There is deliberately no field for health or diagnosis data. Don't smuggle it into `facts`.
 */
export interface AthleteCardData {
  /** Stable id; seeds the card's generated pattern so every athlete gets their own. */
  id: string;
  firstName: string;
  lastName: string;
  /** Local or remote image URI. Falls back to initials when absent. */
  photoUri?: string | null;
  jerseyNumber?: string;
  sport: string;
  position?: string;
  /** Badge text for the photo's position circle, e.g. "MF". Derived from `position` if omitted. */
  positionShort?: string;
  school?: string;
  resume: {
    stats: AthleteStat[];
    experience: ResumeEntry[];
    skills: string[];
  };
  personal: {
    hometown?: string;
    pronouns?: string;
    bio?: string;
    facts: AthleteStat[];
    interests: string[];
    contact?: AthleteContact;
  };
}

export interface AthleteStat {
  label: string;
  value: string;
}

export interface ResumeEntry {
  role: string;
  organization: string;
  period: string;
}

export interface AthleteContact {
  email?: string;
  phone?: string;
  social?: string;
}
