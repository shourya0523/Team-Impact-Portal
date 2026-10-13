import { z } from 'zod';
import { Id, Timestamp } from './common';
import { type NotificationPrefs, UserSummary } from './users';

/**
 * In-app notifications (PRD §5, P1). Each kind maps to one switch in `Me.notificationPrefs`, and
 * nothing is generated while that switch is off. Nothing is generated for content until it has
 * passed moderation, and a notification about a community the reader can no longer see (removed,
 * or medical while the medical switch is off) is not listed.
 *
 * - `join_approved`: the creator of a private community let you in, or a coach approved your
 *   request to join their team.
 * - `reply`: an approved comment on your post.
 * - `event`: an approved event in a community you belong to.
 * - `announcement`: a Team Impact announcement.
 */
export const NOTIFICATION_KINDS = ['join_approved', 'reply', 'event', 'announcement'] as const;
export const NotificationKind = z.enum(NOTIFICATION_KINDS);
export type NotificationKind = z.infer<typeof NotificationKind>;

/** Which preference switch governs each kind. */
export const NOTIFICATION_PREF: Record<
  NotificationKind,
  keyof Omit<NotificationPrefs, 'emailDigest'>
> = {
  join_approved: 'approvals',
  reply: 'replies',
  event: 'events',
  announcement: 'announcements',
};

export const Notification = z.object({
  id: Id,
  kind: NotificationKind,
  /** Who caused it; null for announcements, which show as from Team Impact. */
  actor: UserSummary.nullable(),
  /** One line, ready to show: "Dana Rivera replied to your post". */
  text: z.string(),
  /** Where tapping it goes. */
  target: z.object({ kind: z.enum(['post', 'event', 'community']), id: Id }),
  read: z.boolean(),
  createdAt: Timestamp,
});
export type Notification = z.infer<typeof Notification>;

export const NotificationList = z.object({
  items: z.array(Notification),
  unreadCount: z.number().int().nonnegative(),
});
export type NotificationList = z.infer<typeof NotificationList>;

/** Mark these read; with no `ids`, mark everything read. */
export const MarkNotificationsReadRequest = z.object({ ids: z.array(Id).min(1).optional() });
export type MarkNotificationsReadRequest = z.infer<typeof MarkNotificationsReadRequest>;
