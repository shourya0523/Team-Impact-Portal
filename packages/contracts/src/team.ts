import { z } from 'zod';
import { Id } from './common';
import { SharedContact } from './contacts';
import { Team, TeamMember } from './teams';
import { UserSummary } from './users';

/**
 * Coach team management (PRD P0): the roster, removing members, and what a coach needs to run the
 * team day to day. Join requests, QR codes and coach invites keep their own contract files.
 */

/**
 * A child profile on its team's roster: first name only, under the parent who runs it. Children
 * have no account and never appear in search, recruiter views, card exports or other communities.
 */
export const RosterChild = z.object({ id: Id, firstName: z.string() });
export type RosterChild = z.infer<typeof RosterChild>;

/** How a team's coaches reach a family. Nobody else on the roster gets it, and teens never do. */
export const FamilyContact = SharedContact.pick({ email: true, phone: true });
export type FamilyContact = z.infer<typeof FamilyContact>;

export const RosterParent = TeamMember.extend({
  children: z.array(RosterChild),
  /** Set only for the team's own coaches; null for everyone else. */
  contact: FamilyContact.nullable(),
});
export type RosterParent = z.infer<typeof RosterParent>;

/** `GET /teams/:id/members`: the team grouped as the Team tab shows it. */
export const TeamRoster = z.object({
  team: Team,
  coaches: z.array(TeamMember),
  athletes: z.array(TeamMember),
  parents: z.array(RosterParent),
  teens: z.array(TeamMember),
  /** The viewer coaches this team (or is staff): they approve, remove, edit and make codes. */
  canManage: z.boolean(),
  /** Join requests waiting on a coach; null unless `canManage`. */
  pendingRequestCount: z.number().int().nonnegative().nullable(),
});
export type TeamRoster = z.infer<typeof TeamRoster>;

/**
 * One athlete's contact details as their team's families see them (PRD §6, F4): only the channels
 * the athlete chose to share with families. `{}` when they share none yet, or their card isn't
 * published.
 */
export const FamilyVisibleAthlete = z.object({
  athlete: UserSummary,
  contact: SharedContact,
});
export type FamilyVisibleAthlete = z.infer<typeof FamilyVisibleAthlete>;

/**
 * `GET /teams/:id/athlete-contacts`: for approved parents on the team only; anyone else gets 403
 * (404 off the team). It is its own route, not a field on the roster, so the roster everyone reads
 * (teens included) never carries an athlete's contact details at all.
 */
export const TeamAthleteContacts = z.array(FamilyVisibleAthlete);
export type TeamAthleteContacts = z.infer<typeof TeamAthleteContacts>;

export const TeamMemberParams = z.object({ id: Id, userId: Id });
export type TeamMemberParams = z.infer<typeof TeamMemberParams>;

/** What leaves with a member: a parent's under-13 children leave the team with them. */
export const RemoveMemberResult = z.object({
  roster: TeamRoster,
  removedChildren: z.array(RosterChild),
});
export type RemoveMemberResult = z.infer<typeof RemoveMemberResult>;
