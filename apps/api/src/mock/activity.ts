import type {
  Comment,
  CreateReportRequest,
  ModerationStatus,
  NotificationKind,
  NotificationPrefs,
  RegisterDeviceRequest,
  RsvpStatus,
} from '@team-impact/contracts';
import { NOTIFICATION_PREF } from '@team-impact/contracts';
import { id, summaryOf, USERS } from './fixtures';
import type { MockCommunity, MockUser } from './fixtures';
import { hiddenFor } from './safety';
import { isSuspended } from './staff-tools';
import type { MockWorld } from './world';

/**
 * Posting, comments, rallies, RSVPs and notifications for the mock API (PRD §5, P1, P5).
 *
 * Every new post, comment, event and community starts `in_review` and is queued for staff as a
 * moderation ticket with no reports. Nothing reaches anyone but its author until staff keep it
 * (`dismiss`), and notifications fire only then, so held content never leaks through them.
 */

export interface MockComment {
  id: string;
  postId: string;
  authorId: string;
  text: string;
  moderation: ModerationStatus;
  createdAt: string;
}

export interface MockRsvp {
  eventId: string;
  userId: string;
  status: RsvpStatus;
  respondedAt: string;
}

export interface MockNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  actorId: string | null;
  text: string;
  target: { kind: 'post' | 'event' | 'community'; id: string };
  /** Hidden from the list once the reader can no longer see this community. */
  communityId: string;
  read: boolean;
  createdAt: string;
}

/** A phone registered for push. Signing out on that phone removes it. */
export interface MockDevice {
  userId: string;
  token: string;
  platform: RegisterDeviceRequest['platform'];
  createdAt: string;
}

/** A push the mock would have sent through Expo, one per device. Tests read these. */
export interface MockPush {
  notificationId: string;
  userId: string;
  token: string;
  /** The notification's text, or `DISCREET_PUSH_TEXT` for medical and private communities. */
  text: string;
  target: MockNotification['target'];
}

const at = (day: number, hour = 12) =>
  `2026-10-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

const comment = (n: number, postN: number, author: MockUser, text: string): MockComment => ({
  id: id(n),
  postId: id(postN),
  authorId: author.id,
  text,
  moderation: 'approved',
  createdAt: at(12, 18),
});

/** One approved comment on each fixture post that says it has one (`commentCount: 1`). */
export const COMMENTS: MockComment[] = [
  comment(1301, 401, USERS.lisa, 'Mateo will be there with his foam finger!'),
  comment(1302, 402, USERS.jordan, 'See everyone there.'),
  comment(1303, 403, USERS.priya, 'Happy to review cards too.'),
  comment(1304, 404, USERS.jordan, 'Sending love to your family.'),
  comment(1305, 405, USERS.sam, 'Applied, thanks for posting.'),
  comment(1306, 406, USERS.coach, 'Go Jumbos!'),
  comment(1307, 408, USERS.jordan, 'I’ll bring the lineup ideas.'),
];

export const DEFAULT_PREFS: NotificationPrefs = {
  approvals: true,
  replies: true,
  events: true,
  announcements: true,
  emailDigest: false,
};

export const prefsOf = (world: MockWorld, userId: string): NotificationPrefs =>
  world.notificationPrefs.get(userId) ?? DEFAULT_PREFS;

type Target = CreateReportRequest['target'];

/** Queue a new item for staff. It stays `in_review` until a ticket on it is resolved. */
export const holdForReview = (world: MockWorld, target: Target, preview: string) => {
  world.tickets.push({
    id: world.newId(),
    target,
    preview: preview.slice(0, 280),
    reasons: [],
    reportCount: 0,
    status: 'open',
    resolution: null,
    createdAt: new Date().toISOString(),
  });
};

const name = (u: MockUser) => `${u.firstName} ${u.lastName}`;

/**
 * What a push says instead of the in-app text when the community is medical or private. Push text
 * shows on lock screens and passes through Expo, Apple and Google, so it never names the community,
 * an event or a person in one (CLAUDE.md: medical membership is never shown; private communities
 * show nothing to non-members).
 */
export const DISCREET_PUSH_TEXT = 'You have a new notification in Team Impact';

/**
 * Whether `userId` may be told about something in `communityId`, by any channel. The in-app list
 * and push both ask this, so they can't drift apart: a suspended account, or a community the
 * reader can no longer see (removed, left, or medical with the switch off), gets nothing.
 */
export const canReceive = (world: MockWorld, userId: string, communityId: string) => {
  const u = world.user(userId);
  const c = world.communities.find((x) => x.id === communityId);
  return !!u && !!c && !isSuspended(world, userId) && world.canSeeCommunity(c, u);
};

/** True when push text must not say anything about the community. Unknown counts as discreet. */
const isDiscreet = (world: MockWorld, communityId: string) => {
  const c = world.communities.find((x) => x.id === communityId);
  return !c || c.kind === 'medical' || ('private' in c && c.private);
};

/**
 * Store one notification and push it to each of the reader's phones, unless the reader turned that
 * kind off (warnings can't be). The in-app text is kept whole; the push may be generic.
 */
export const notify = (
  world: MockWorld,
  n: Omit<MockNotification, 'id' | 'read' | 'createdAt'>,
) => {
  // Staff warnings always arrive; every other kind follows the reader's switch.
  if (n.kind !== 'warning' && !prefsOf(world, n.userId)[NOTIFICATION_PREF[n.kind]]) return;
  const stored: MockNotification = {
    ...n,
    id: world.newId(),
    read: false,
    createdAt: new Date().toISOString(),
  };
  world.notifications.push(stored);
  // The in-app list re-checks `canReceive` each time it's read; a push can't be taken back, so
  // it's checked once, now.
  if (!canReceive(world, n.userId, n.communityId)) return;
  const pushText = isDiscreet(world, n.communityId) ? DISCREET_PUSH_TEXT : n.text;
  for (const d of world.devices.filter((x) => x.userId === n.userId)) {
    world.pushOutbox.push({
      notificationId: stored.id,
      userId: n.userId,
      token: d.token,
      text: pushText,
      target: n.target,
    });
  }
};

/** The creator of a private community let `userId` in. */
export const notifyJoinApproved = (
  world: MockWorld,
  c: MockCommunity,
  userId: string,
  approver: MockUser,
) =>
  notify(world, {
    userId,
    kind: 'join_approved',
    actorId: approver.id,
    text: `${name(approver)} let you into ${c.name}`,
    target: { kind: 'community', id: c.id },
    communityId: c.id,
  });

/** Everyone who belongs to `c` (not recruiters reading it), except `exceptId`. */
const membersOf = (world: MockWorld, c: MockCommunity, exceptId: string) =>
  world.users.filter(
    (u) => u.id !== exceptId && world.canSeeCommunity(c, u) && world.community(c, u).myMembership,
  );

/** Notifications that follow from an item passing review. */
const onApproved = (world: MockWorld, target: Target) => {
  if (target.kind === 'post') {
    const p = world.posts.find((x) => x.id === target.id)!;
    const c = world.communities.find((x) => x.id === p.communityId);
    if (p.kind !== 'announcement' || !c) return;
    // Announcements reach every role, recruiters included (TI-146).
    for (const u of world.users.filter((x) => x.id !== p.authorId && world.readsCommunity(c, x))) {
      notify(world, {
        userId: u.id,
        kind: 'announcement',
        actorId: null,
        text: `Team Impact: ${p.text.slice(0, 120)}`,
        target: { kind: 'post', id: p.id },
        communityId: c.id,
      });
    }
  } else if (target.kind === 'comment') {
    const k = world.comments.find((x) => x.id === target.id)!;
    const p = world.posts.find((x) => x.id === k.postId);
    const author = world.user(k.authorId)!;
    if (!p || p.authorId === k.authorId) return;
    notify(world, {
      userId: p.authorId,
      kind: 'reply',
      actorId: author.id,
      text: `${name(author)} replied to your post`,
      target: { kind: 'post', id: p.id },
      communityId: p.communityId,
    });
  } else if (target.kind === 'event') {
    const e = world.events.find((x) => x.id === target.id)!;
    const c = world.communities.find((x) => x.id === e.communityId);
    const host = world.user(e.hostId)!;
    if (!c) return;
    for (const u of membersOf(world, c, host.id)) {
      notify(world, {
        userId: u.id,
        kind: 'event',
        actorId: host.id,
        text: `${name(host)} added ${e.title} in ${c.name}`,
        target: { kind: 'event', id: e.id },
        communityId: c.id,
      });
    }
  }
};

/**
 * Apply a staff decision on a ticket. `remove` takes the item down; `dismiss` keeps it, which
 * approves an item still held for its first review.
 */
export const applyResolution = (
  world: MockWorld,
  target: Target,
  resolution: 'remove' | 'dismiss',
) => {
  const item =
    target.kind === 'post'
      ? world.posts.find((p) => p.id === target.id)
      : target.kind === 'comment'
        ? world.comments.find((k) => k.id === target.id)
        : target.kind === 'event'
          ? world.events.find((e) => e.id === target.id)
          : target.kind === 'community'
            ? world.communities.find((c) => c.id === target.id)
            : undefined;
  if (!item) return;
  if (resolution === 'remove') {
    item.moderation = 'removed';
  } else if (item.moderation === 'in_review') {
    item.moderation = 'approved';
    onApproved(world, target);
  }
};

export const toComment = (world: MockWorld, k: MockComment): Comment => ({
  id: k.id,
  postId: k.postId,
  author: summaryOf(world.user(k.authorId)!),
  text: k.text,
  moderation: k.moderation,
  createdAt: k.createdAt,
});

/** Approved comments, plus the viewer's own while they wait for review. Oldest first. */
export const commentsFor = (world: MockWorld, postId: string, u: MockUser): Comment[] => {
  const p = world.posts.find((x) => x.id === postId);
  const c = p && world.communities.find((x) => x.id === p.communityId);
  if (!c) return [];
  return (
    world.comments
      .filter(
        (k) =>
          k.postId === postId &&
          (k.moderation === 'approved' || (k.moderation === 'in_review' && k.authorId === u.id)),
      )
      .filter((k) => !world.teenOutsideTeam(k.authorId, c))
      // Blocks and the viewer's own reports hide comments too (./safety.ts).
      .filter((k) => !hiddenFor(world, u, k))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((k) => toComment(world, k))
  );
};
