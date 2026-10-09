import { z } from 'zod';
import { ClassYear, Id, Timestamp } from './common';
import { ParentRelationship, UserSummary } from './users';

/** Only athletes, parents and teens ask to join. Coaches are invited; alumni and recruiters never join. */
export const JOIN_REQUEST_STATUSES = ['pending', 'approved', 'declined'] as const;
export const JoinRequestStatus = z.enum(JOIN_REQUEST_STATUSES);
export type JoinRequestStatus = z.infer<typeof JoinRequestStatus>;

/**
 * The slow lane: a coach approves, and nothing about the team shows until then. `role` must match
 * the requester's account. Athletes give only team and year (the college comes with the team);
 * parents attach the children whose profiles they run. Withdrawing a request deletes it.
 */
export const CreateJoinRequest = z.discriminatedUnion('role', [
  z.object({ role: z.literal('athlete'), teamId: Id, classYear: ClassYear }),
  z.object({ role: z.literal('parent'), teamId: Id, childIds: z.array(Id).min(1).max(10) }),
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
};

/** What the coach (or staff) sees when deciding. */
export const JoinRequest = z.discriminatedUnion('role', [
  z.object({ ...joinRequestBase, role: z.literal('athlete'), classYear: ClassYear }),
  z.object({
    ...joinRequestBase,
    role: z.literal('parent'),
    relationship: ParentRelationship,
    children: z.array(z.object({ id: Id, firstName: z.string(), age: z.number().int() })),
  }),
  z.object({ ...joinRequestBase, role: z.literal('teen') }),
]);
export type JoinRequest = z.infer<typeof JoinRequest>;

export const DecideJoinRequest = z.object({ decision: z.enum(['approve', 'decline']) });
export type DecideJoinRequest = z.infer<typeof DecideJoinRequest>;
