import { z } from 'zod';
import { Region } from './cards';
import { ClassYear, Id, PageQuery, Timestamp } from './common';
import { Division } from './teams';
import { UserSummary } from './users';

/**
 * Recruiter search (PRD §7). Only athletes with a published card and open-to-recruiting on come
 * back; children, teens and everyone without a card never do. Query values arrive as strings.
 */
export const AthleteSearchQuery = PageQuery.extend({
  region: Region.optional(),
  city: z.string().trim().min(1).optional(),
  sport: z.string().trim().min(1).optional(),
  major: z.string().trim().min(1).optional(),
  classYear: z.coerce.number<number>().pipe(ClassYear).optional(),
  division: Division.optional(),
  /** Matched against the role and organisation of the card's experience entries. */
  experience: z.string().trim().min(1).optional(),
  /**
   * Identity search: an official interest community. Behind the `identitySearch` flag, matches
   * only members who opted in to being found through it, and every use is logged. Team and
   * medical communities are never accepted.
   */
  communityId: Id.optional(),
});
export type AthleteSearchQuery = z.input<typeof AthleteSearchQuery>;

/** One identity-filtered search, kept for staff and counsel. */
export const IdentitySearchLogEntry = z.object({
  id: Id,
  recruiter: UserSummary,
  company: z.object({ id: Id, name: z.string() }),
  community: z.object({ id: Id, name: z.string() }),
  searchedAt: Timestamp,
});
export type IdentitySearchLogEntry = z.infer<typeof IdentitySearchLogEntry>;
