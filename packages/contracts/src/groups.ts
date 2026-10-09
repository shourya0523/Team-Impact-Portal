import { z } from 'zod';
import { Id, Timestamp } from './common';
import { UserSummary } from './users';

/**
 * Affinity groups. Staff, coaches, athletes and alumni can create one; parents, teens and
 * recruiters can't. Staff mark some official: only official groups are recruiter filters, and only
 * for members who separately opted in to being searchable. That identity search sits behind one
 * feature flag and every use is logged.
 */
export const Group = z.object({
  id: Id,
  name: z.string(),
  about: z.string(),
  createdBy: UserSummary,
  official: z.boolean(),
  memberCount: z.number().int().nonnegative(),
  createdAt: Timestamp,
  /** The viewer's own membership; null if they haven't joined. */
  myMembership: z
    .object({
      joinedAt: Timestamp,
      /**
       * Athletes with a published card only: "Recruiters can find me through this group".
       * Separate from membership, and cleared on leaving.
       */
      recruiterSearchOptIn: z.boolean(),
    })
    .nullable(),
});
export type Group = z.infer<typeof Group>;

/** Staff see how many members opted in to recruiter search. Nobody else does. */
export const StaffGroup = Group.extend({
  recruiterSearchOptInCount: z.number().int().nonnegative(),
});
export type StaffGroup = z.infer<typeof StaffGroup>;

/** Names are unique, ignoring case. The creator joins automatically; new groups aren't official. */
export const CreateGroupRequest = z.object({
  name: z.string().trim().min(1).max(60),
  about: z.string().trim().min(1, 'Say what the group is for.').max(500),
});
export type CreateGroupRequest = z.infer<typeof CreateGroupRequest>;

/** The API only accepts this for official groups and athletes with a published card. */
export const UpdateGroupMembershipRequest = z.object({ recruiterSearchOptIn: z.boolean() });
export type UpdateGroupMembershipRequest = z.infer<typeof UpdateGroupMembershipRequest>;

/** Staff only. Un-marking removes the group from recruiter filters. */
export const SetGroupOfficialRequest = z.object({ official: z.boolean() });
export type SetGroupOfficialRequest = z.infer<typeof SetGroupOfficialRequest>;
