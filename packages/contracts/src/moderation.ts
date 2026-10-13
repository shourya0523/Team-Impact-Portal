import { z } from 'zod';
import { Id } from './common';

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
  target: z.object({ kind: z.enum(['post', 'comment', 'event', 'profile']), id: Id }),
  reason: ReportReason,
  note: z.string().trim().max(500).optional(),
});
export type CreateReportRequest = z.infer<typeof CreateReportRequest>;
