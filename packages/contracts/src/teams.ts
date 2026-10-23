import { z } from 'zod';
import { College } from './colleges';
import { Email, HexColor, Id, Timestamp } from './common';
import { UserSummary } from './users';

export const DIVISIONS = ['I', 'II', 'III'] as const;
export const Division = z.enum(DIVISIONS);
export type Division = z.infer<typeof Division>;

export const TEAM_GENDERS = ['men', 'women'] as const;
export const TeamGender = z.enum(TEAM_GENDERS);
export type TeamGender = z.infer<typeof TeamGender>;

/**
 * `invited`: created by staff, waiting on the first coach. `live`: has a coach, and always keeps
 * at least one. `archived`: out of the join search, and its QR codes stop working. Unregistered
 * teams have no record: for the pilot, people email appdev@teamimpact.org instead.
 */
export const TEAM_STATUSES = ['invited', 'live', 'archived'] as const;
export const TeamStatus = z.enum(TEAM_STATUSES);
export type TeamStatus = z.infer<typeof TeamStatus>;

/** What a card, QR code or join search result needs to show which team it's about. */
export const TeamSummary = z.object({
  id: Id,
  name: z.string(),
  college: College,
  sport: z.string(),
  gender: TeamGender,
  division: Division,
  /** Avatar and card stripe. Null means Team Impact navy (`resolveTeamColor` in ui-tokens). */
  color: HexColor.nullable(),
  logoUrl: z.url().nullable(),
});
export type TeamSummary = z.infer<typeof TeamSummary>;

export const Team = TeamSummary.extend({
  about: z.string().nullable(),
  status: TeamStatus,
  memberCount: z.number().int().nonnegative(),
  createdAt: Timestamp,
});
export type Team = z.infer<typeof Team>;

/** The join search: pick the college, then the sport. Only live teams come back. */
export const FindTeamsQuery = z.object({
  collegeId: Id,
  sport: z.string().trim().min(1).optional(),
});
export type FindTeamsQuery = z.infer<typeof FindTeamsQuery>;

/**
 * The sports staff can create a team for. A fixed list, so one college can't end up with both
 * "Soccer" and "soccer" teams and the join search groups teams reliably. Add to it as colleges join.
 */
export const SPORTS = [
  'Baseball',
  'Basketball',
  'Beach Volleyball',
  'Cross Country',
  'Fencing',
  'Field Hockey',
  'Football',
  'Golf',
  'Gymnastics',
  'Ice Hockey',
  'Lacrosse',
  'Rowing',
  'Rugby',
  'Sailing',
  'Skiing',
  'Soccer',
  'Softball',
  'Squash',
  'Swimming & Diving',
  'Tennis',
  'Track & Field',
  'Volleyball',
  'Water Polo',
  'Wrestling',
] as const;
export const Sport = z.enum(SPORTS, { error: 'Pick a sport from the list.' });
export type Sport = z.infer<typeof Sport>;

const TeamName = z.string().trim().min(1, 'The team needs a name.').max(80);
/**
 * The API also refuses colours that neither white nor ink text reaches 4.5:1 on
 * (`isReadableTeamColor` in ui-tokens), and the portal and athlete app check before sending.
 */
const TeamColor = HexColor;

/**
 * Staff only. One team per college, sport and gender. Creating it makes the team's private
 * community and emails the first coach an invite. The logo uploads separately.
 */
export const CreateTeamRequest = z.object({
  collegeId: Id,
  sport: Sport,
  gender: TeamGender,
  /** Display name, like "Women's Soccer". */
  name: TeamName,
  division: Division,
  color: TeamColor.optional(),
  firstCoachEmail: Email,
});
export type CreateTeamRequest = z.infer<typeof CreateTeamRequest>;

/** What coaches can edit. */
export const UpdateTeamRequest = z.object({
  name: TeamName.optional(),
  color: TeamColor.nullable().optional(),
  about: z.string().trim().max(1000).nullable().optional(),
});
export type UpdateTeamRequest = z.infer<typeof UpdateTeamRequest>;

/**
 * Staff can also move, archive and restore a team. Archiving takes it out of the join search,
 * declines its pending join requests and revokes its QR codes; restoring brings the team back,
 * but not those codes.
 */
export const StaffUpdateTeamRequest = UpdateTeamRequest.extend({
  collegeId: Id.optional(),
  sport: Sport.optional(),
  gender: TeamGender.optional(),
  division: Division.optional(),
  archived: z.boolean().optional(),
});
export type StaffUpdateTeamRequest = z.infer<typeof StaffUpdateTeamRequest>;

export const TeamMember = z.object({
  user: UserSummary,
  joinedVia: z.enum(['coach_invite', 'join_request', 'qr_code']),
  joinedAt: Timestamp,
});
export type TeamMember = z.infer<typeof TeamMember>;

/** Staff invite the first coach; coaches can add more. Every addition records who added whom. */
export const InviteCoachRequest = z.object({ email: Email });
export type InviteCoachRequest = z.infer<typeof InviteCoachRequest>;

/** Single-use, valid for 7 days, and only for the email it was sent to. Staff can resend or revoke. */
export const CoachInvite = z.object({
  id: Id,
  teamId: Id,
  email: z.string(),
  invitedBy: UserSummary,
  expiresAt: Timestamp,
  acceptedAt: Timestamp.nullable(),
  revokedAt: Timestamp.nullable(),
  createdAt: Timestamp,
});
export type CoachInvite = z.infer<typeof CoachInvite>;
