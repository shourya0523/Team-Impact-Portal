import { z } from 'zod';

/**
 * Account roles from PRD §2. Children under 13 have no login, so they are not a role:
 * they exist only as a profile run by a parent.
 */
export const ROLES = [
  'staff',
  'coach',
  'athlete',
  'parent',
  'teen',
  'recruiter',
  'alumni_athlete',
  'alumni_mentor',
] as const;

export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

/** Only athletes (current or alumni) have a Baseball Card; everyone else has a plain profile. */
export const hasBaseballCard = (role: Role): boolean =>
  role === 'athlete' || role === 'alumni_athlete';
