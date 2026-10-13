import { z } from 'zod';
import { Id, Timestamp } from './common';
import { UserSummary } from './users';

/**
 * Staff tools for accounts (PRD §9, Notion "Moderation"): suspending and restoring accounts, and the
 * log of every staff moderation action.
 *
 * A suspended account is refused on every route (403) until staff restore it, and its posts,
 * comments and events drop out of every feed. Staff accounts and a team's last coach can't be
 * suspended. Children have no account, so they can't be; suspending a parent keeps the child's
 * profile.
 */

/** Staff only: one suspended account, newest first in the list. */
export const SuspendedUser = z.object({
  user: UserSummary,
  /** What staff wrote when suspending, if anything. */
  reason: z.string().nullable(),
  suspendedBy: UserSummary,
  /** The ticket it came from; null when suspended from the recruiters page. */
  ticketId: Id.nullable(),
  suspendedAt: Timestamp,
});
export type SuspendedUser = z.infer<typeof SuspendedUser>;

/**
 * What staff did. `remove` and `keep` decide a ticket's item; `warn` notifies its author; `suspend`
 * and `unsuspend` lock an account out or let it back in.
 */
export const MODERATION_ACTIONS = ['remove', 'keep', 'warn', 'suspend', 'unsuspend'] as const;
export const ModerationAction = z.enum(MODERATION_ACTIONS);
export type ModerationAction = z.infer<typeof ModerationAction>;

/** Staff only: who did what to which target, and when. Append-only. */
export const ModerationLogEntry = z.object({
  id: Id,
  actor: UserSummary,
  action: ModerationAction,
  target: z.object({
    kind: z.enum(['post', 'comment', 'event', 'profile', 'community', 'user']),
    id: Id,
    /** Enough to recognise it: the item's preview or the person's name. */
    label: z.string(),
  }),
  ticketId: Id.nullable(),
  note: z.string().nullable(),
  createdAt: Timestamp,
});
export type ModerationLogEntry = z.infer<typeof ModerationLogEntry>;
