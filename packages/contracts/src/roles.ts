import { z } from 'zod';

/**
 * Account types from PRD §2 and the TI-4 v2 model (`users.user_type`). Children under 13 have no
 * login, so they are not a type: they exist only as a `children` profile run by a parent. Alumni who
 * mentor or hire are `alumni` with the `mentoring` / `hiring` flags set.
 */
export const ROLES = [
  'athlete',
  'alumni',
  'recruiter',
  'staff',
  'coach',
  'parent',
  'teen',
] as const;

export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

/** Only athletes (current or alumni) have a Baseball Card; everyone else has a plain profile. */
export const hasBaseballCard = (role: Role): boolean => role === 'athlete' || role === 'alumni';
