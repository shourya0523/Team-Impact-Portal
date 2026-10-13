import { z } from 'zod';
import { Timestamp } from './common';
import { UserSummary } from './users';

/**
 * Who is in a community, as its members see them (`GET /communities/:id/members`). Lists only ever
 * reach members, and never for a medical community (nobody is told who else is in one), the Team
 * Impact community (everyone; the count is enough) or recruiters. Children are never listed, and
 * teens only appear in their own team's community.
 */
export const CommunityMember = z.object({
  user: UserSummary,
  joinedAt: Timestamp,
});
export type CommunityMember = z.infer<typeof CommunityMember>;

/** Why a member list can't be shown, so clients can say so without guessing. */
export const MEMBERS_PRIVATE_MEDICAL = 'Members are private in medical communities';
