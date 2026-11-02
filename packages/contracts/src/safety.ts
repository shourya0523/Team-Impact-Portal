import { z } from 'zod';
import { Id, Timestamp } from './common';
import { CreateReportRequest, ReportReason, TicketStatus } from './moderation';
import { CoachInvite, TeamMember } from './teams';
import { UserSummary } from './users';

/**
 * Trust and safety (PRD §9, P2, P3, P5), the staff tools around it, and recruiter list writes.
 * Requests and responses that don't already live with their resource.
 */

export const UserIdParams = z.object({ userId: Id });
export type UserIdParams = z.infer<typeof UserIdParams>;

// Reports --------------------------------------------------------------------------------------

/**
 * A report as its reporter sees it. Never says who else reported the item, and only the ticket's
 * open or resolved state, not the staff decision.
 */
export const MyReport = z.object({
  id: Id,
  target: CreateReportRequest.shape.target,
  reason: ReportReason,
  note: z.string().nullable(),
  status: TicketStatus,
  createdAt: Timestamp,
});
export type MyReport = z.infer<typeof MyReport>;

// Blocks ---------------------------------------------------------------------------------------

/**
 * Someone the viewer blocked. Neither sees the other's posts, comments or events from then on,
 * and they can't reply to each other. Team Impact's official posts can't be blocked.
 */
export const Block = z.object({
  user: UserSummary,
  blockedAt: Timestamp,
});
export type Block = z.infer<typeof Block>;

// Staff tools ----------------------------------------------------------------------------------

/** A team's coaches and its coach invites (pending, accepted or revoked), for staff (S8). */
export const TeamCoaches = z.object({
  /** Suspended coaches stay on the team but can't act for it, so they don't count as its coach. */
  coaches: z.array(TeamMember.extend({ suspended: z.boolean() })),
  invites: z.array(CoachInvite),
});
export type TeamCoaches = z.infer<typeof TeamCoaches>;

// Recruiter lists ------------------------------------------------------------------------------

export const ListAthleteParams = z.object({ id: Id, athleteId: Id });
export type ListAthleteParams = z.infer<typeof ListAthleteParams>;

/** The owner shares a list with one colleague at the same company. */
export const ShareListRequest = z.object({ userId: Id });
export type ShareListRequest = z.infer<typeof ShareListRequest>;

/** The company's note on an athlete, written from a list. Notes are company-wide. */
export const SetListNoteRequest = z.object({
  text: z.string().trim().min(1, 'Write a note first.').max(2000),
});
export type SetListNoteRequest = z.infer<typeof SetListNoteRequest>;
