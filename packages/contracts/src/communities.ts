import { z } from 'zod';
import { Id, Timestamp } from './common';
import { ModerationStatus } from './moderation';
import type { Role } from './roles';
import { UserSummary } from './users';

/**
 * Communities (PRD v2.3 §5) replace affinity groups and feed scopes. Every post and event lives in
 * one, and the home feed merges every community you belong to, medical and private ones included.
 *
 * - `team`: made with the team; private to its members and their families. Team membership
 *   (coach approval or QR join) drives it, so nobody joins it directly.
 * - `team_impact`: made by staff, open to everyone; announcements and network-wide posts.
 * - `medical`: made by anyone who can join one. Membership is private to the member: never on a
 *   profile, never searchable, never a recruiter filter. One switch hides the kind everywhere
 *   (PRD §11).
 * - `interest`: user-made; staff can mark an open one official, which makes it a recruiter filter.
 *
 * Interest and medical communities can be made private at creation, like team communities:
 * findable by name and description, but posts, events and members are for members only, and
 * joining is a request the creator approves.
 */
export const COMMUNITY_KINDS = ['team', 'team_impact', 'medical', 'interest'] as const;
export const CommunityKind = z.enum(COMMUNITY_KINDS);
export type CommunityKind = z.infer<typeof CommunityKind>;

/** Kinds users create themselves. Team communities come with the team; staff run Team Impact's. */
export const CREATABLE_COMMUNITY_KINDS = ['interest', 'medical'] as const;
export const CreatableCommunityKind = z.enum(CREATABLE_COMMUNITY_KINDS);
export type CreatableCommunityKind = z.infer<typeof CreatableCommunityKind>;

/** Recruiters and parents can't create interest communities; teens and recruiters can't make medical ones. */
export const canCreateCommunity = (role: Role, kind: CreatableCommunityKind): boolean =>
  kind === 'medical'
    ? canJoinCommunity(role, 'medical')
    : role !== 'recruiter' && role !== 'parent' && role !== 'teen';

/**
 * Whether a role may join a kind at all. Team communities follow team membership instead.
 * Recruiters join nothing; they only read Team Impact and official communities.
 */
export const canJoinCommunity = (role: Role, kind: CommunityKind): boolean => {
  if (kind === 'team') return false;
  if (role === 'recruiter') return false;
  if (kind === 'medical') return role !== 'teen';
  return true;
};

/** Enough to label a post or event with where it lives. */
export const CommunitySummary = z.object({
  id: Id,
  name: z.string(),
  kind: CommunityKind,
});
export type CommunitySummary = z.infer<typeof CommunitySummary>;

const membership = { joinedAt: Timestamp };

const communityBase = {
  id: Id,
  name: z.string(),
  about: z.string(),
  memberCount: z.number().int().nonnegative(),
  /** Names and descriptions pass moderation like posts; only `approved` ones are listed. */
  moderation: ModerationStatus,
  createdAt: Timestamp,
};

const userMade = {
  createdBy: UserSummary,
  /** Set at creation. Content and members for members only; joining needs the creator's yes. */
  private: z.boolean(),
  /** The viewer's own request to join a private community, while it waits on the creator. */
  myJoinRequest: z.object({ requestedAt: Timestamp }).nullable(),
};

/**
 * A community as its viewer sees it. `myMembership` is the viewer's own and null if they haven't
 * joined; nobody is ever told who else is in a medical community.
 */
export const Community = z.discriminatedUnion('kind', [
  z.object({
    ...communityBase,
    kind: z.literal('team'),
    teamId: Id,
    myMembership: z.object(membership).nullable(),
  }),
  z.object({
    ...communityBase,
    kind: z.literal('team_impact'),
    myMembership: z.object(membership).nullable(),
  }),
  z.object({
    ...communityBase,
    kind: z.literal('medical'),
    ...userMade,
    myMembership: z.object(membership).nullable(),
  }),
  z.object({
    ...communityBase,
    kind: z.literal('interest'),
    ...userMade,
    /**
     * Only open interest communities can be official, and only official ones are recruiter
     * filters. A private community is never official.
     */
    official: z.boolean(),
    myMembership: z
      .object({
        ...membership,
        /**
         * Athletes with a published card, in official communities only: "Recruiters can find me
         * through this community". Separate from membership, withdrawable, cleared on leaving.
         */
        recruiterSearchOptIn: z.boolean(),
      })
      .nullable(),
  }),
]);
export type Community = z.infer<typeof Community>;

/** Staff also see how many members of an interest community opted in to recruiter search. */
export const StaffCommunity = z.object({
  community: Community,
  recruiterSearchOptInCount: z.number().int().nonnegative().nullable(),
});
export type StaffCommunity = z.infer<typeof StaffCommunity>;

/**
 * Interest or medical only. Names are unique per kind, ignoring case. The creator joins
 * automatically, and new interest communities aren't official. `private` can only be set here.
 */
export const CreateCommunityRequest = z.object({
  kind: CreatableCommunityKind,
  name: z.string().trim().min(1).max(60),
  about: z.string().trim().min(1, 'Say what the community is for.').max(500),
  private: z.boolean().default(false),
});
export type CreateCommunityRequest = z.infer<typeof CreateCommunityRequest>;

/** The API only accepts this for official interest communities and athletes with a published card. */
export const UpdateCommunityMembershipRequest = z.object({ recruiterSearchOptIn: z.boolean() });
export type UpdateCommunityMembershipRequest = z.infer<typeof UpdateCommunityMembershipRequest>;

/** Someone waiting to join a private community, as its creator sees them. */
export const CommunityJoinRequest = z.object({
  user: UserSummary,
  requestedAt: Timestamp,
});
export type CommunityJoinRequest = z.infer<typeof CommunityJoinRequest>;

/** Staff only, open interest communities only. Un-marking removes it from recruiter filters. */
export const SetCommunityOfficialRequest = z.object({ official: z.boolean() });
export type SetCommunityOfficialRequest = z.infer<typeof SetCommunityOfficialRequest>;

/**
 * Staff only. Moves members, posts and events of the duplicate (the path id) into `intoId`, then
 * removes the duplicate. Both must be the same kind; team communities can't be merged.
 */
export const MergeCommunityRequest = z.object({ intoId: Id });
export type MergeCommunityRequest = z.infer<typeof MergeCommunityRequest>;
