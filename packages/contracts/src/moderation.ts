import { z } from 'zod';
import { Id, Timestamp } from './common';

/**
 * Every post, comment and event is checked before it appears. `in_review` is held for staff (or
 * a recruiter opportunity awaiting approval); only `approved` items are shown to anyone but the
 * author. `removed` is a staff decision.
 */
export const MODERATION_STATUSES = ['in_review', 'approved', 'removed'] as const;
export const ModerationStatus = z.enum(MODERATION_STATUSES);
export type ModerationStatus = z.infer<typeof ModerationStatus>;

export const REPORT_REASONS = [
  'bullying',
  'inappropriate_for_kids',
  'private_information',
  'impersonation',
  'spam',
  'other',
] as const;
export const ReportReason = z.enum(REPORT_REASONS);
export type ReportReason = z.infer<typeof ReportReason>;

/** The reported item is hidden for the reporter straight away. Its author never learns who reported it. */
export const CreateReportRequest = z.object({
  target: z.object({ kind: z.enum(['post', 'comment', 'event', 'profile', 'community']), id: Id }),
  reason: ReportReason,
  note: z.string().trim().max(500).optional(),
});
export type CreateReportRequest = z.infer<typeof CreateReportRequest>;

export const TICKET_STATUSES = ['open', 'resolved'] as const;
export const TicketStatus = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof TicketStatus>;

/**
 * Staff only. Reports on the same item collect into one ticket on the moderation page. New posts,
 * comments, events and communities are held here too, as tickets with no reasons and no reports:
 * `dismiss` ("keep") approves them, `remove` takes them down.
 */
export const ModerationTicket = z.object({
  id: Id,
  target: CreateReportRequest.shape.target,
  /** Enough to judge it at a glance: the post text, the community name, the profile's name. */
  preview: z.string(),
  /** Empty for new content held for its first review. */
  reasons: z.array(ReportReason),
  reportCount: z.number().int().nonnegative(),
  status: TicketStatus,
  /** Set once resolved. `remove` takes the item down; `dismiss` leaves it up. */
  resolution: z.enum(['remove', 'dismiss']).nullable(),
  createdAt: Timestamp,
});
export type ModerationTicket = z.infer<typeof ModerationTicket>;

/**
 * `resolution` decides the item. `authorAction` also acts on its author: `warn` sends them a
 * warning notification, `suspend` locks their account (staff and a team's last coach can't be).
 * Every part is written to the moderation log, with `note` (PRD §9, Notion "Moderation").
 */
export const ResolveTicketRequest = z.object({
  resolution: z.enum(['remove', 'dismiss']),
  authorAction: z.enum(['warn', 'suspend']).optional(),
  note: z.string().trim().max(500).optional(),
});
export type ResolveTicketRequest = z.infer<typeof ResolveTicketRequest>;
