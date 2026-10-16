import { z } from 'zod';
import { ClassYear, Id, Timestamp } from './common';
import { MAX_CHILDREN_PER_REQUEST, NewChild, PendingChild } from './signup';
import { ParentRelationship, UserSummary } from './users';

/** Only athletes, parents and teens ask to join. Coaches are invited; alumni and recruiters never join. */
export const JOIN_REQUEST_STATUSES = ['pending', 'approved', 'declined'] as const;
export const JoinRequestStatus = z.enum(JOIN_REQUEST_STATUSES);
export type JoinRequestStatus = z.infer<typeof JoinRequestStatus>;

/**
 * The slow lane: a coach approves, and nothing about the team shows until then. `role` must match
 * the requester's account. Athletes give only team and year (the college comes with the team);
 * parents say whether they're a parent or guardian, and can add their under-13 children, who join
 * the team when the coach approves (they never get an account). Withdrawing a request deletes it.
 */
export const CreateJoinRequest = z.discriminatedUnion('role', [
  z.object({ role: z.literal('athlete'), teamId: Id, classYear: ClassYear }),
  z.object({
    role: z.literal('parent'),
    teamId: Id,
    relationship: ParentRelationship,
    children: z.array(NewChild).max(MAX_CHILDREN_PER_REQUEST).optional(),
  }),
  z.object({ role: z.literal('teen'), teamId: Id }),
]);
export type CreateJoinRequest = z.infer<typeof CreateJoinRequest>;

const joinRequestBase = {
  id: Id,
  teamId: Id,
  requester: UserSummary,
  status: JoinRequestStatus,
  createdAt: Timestamp,
  decidedAt: Timestamp.nullable(),
  /** Why it was declined, when Team Impact did it rather than a coach (archiving the team). */
  decisionNote: z.string().optional(),
};

/** What the coach (or staff) sees when deciding. */
export const JoinRequest = z.discriminatedUnion('role', [
  z.object({ ...joinRequestBase, role: z.literal('athlete'), classYear: ClassYear }),
  z.object({
    ...joinRequestBase,
    role: z.literal('parent'),
    relationship: ParentRelationship,
    children: z.array(PendingChild).optional(),
  }),
  z.object({ ...joinRequestBase, role: z.literal('teen') }),
]);
export type JoinRequest = z.infer<typeof JoinRequest>;

export const DecideJoinRequest = z.object({ decision: z.enum(['approve', 'decline']) });
export type DecideJoinRequest = z.infer<typeof DecideJoinRequest>;
