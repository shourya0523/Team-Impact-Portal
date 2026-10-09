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

/** Roles anyone can sign up as. Coaches and staff are invited; recruiters sign up on the portal. */
export const SELF_SIGNUP_ROLES = [
  'athlete',
  'parent',
  'teen',
  'alumni_athlete',
  'alumni_mentor',
] as const satisfies readonly Role[];
export const SelfSignupRole = z.enum(SELF_SIGNUP_ROLES);
export type SelfSignupRole = z.infer<typeof SelfSignupRole>;

/** Under 13 is a child (no account, run by a parent), 13–17 a teen, 18 and over an adult. */
export type AgeBand = 'child' | 'teen' | 'adult';

/** Whole years between an ISO `YYYY-MM-DD` birth date and `today`, in UTC. */
export const ageOn = (birthDate: string, today: Date = new Date()): number => {
  const [year = 0, month = 0, day = 0] = birthDate.split('-').map(Number);
  const beforeBirthday =
    today.getUTCMonth() + 1 < month ||
    (today.getUTCMonth() + 1 === month && today.getUTCDate() < day);
  return today.getUTCFullYear() - year - (beforeBirthday ? 1 : 0);
};

export const ageBand = (age: number): AgeBand => (age < 13 ? 'child' : age < 18 ? 'teen' : 'adult');
