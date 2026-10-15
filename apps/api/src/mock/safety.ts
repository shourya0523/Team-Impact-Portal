import type {
  CreateReportRequest,
  ModerationTicket,
  Post,
  ReportReason,
} from '@team-impact/contracts';
import { commentsFor } from './activity';
import type { MockPost } from './fixtures';
import { canSeeChild } from './profiles';
import type { MockUser, MockWorld } from './world';

/**
 * Trust and safety for the mock API (PRD §9): reports, blocks and account deletion. Pure helpers
 * over a `MockWorld`, so the routes stay thin and the feed only needs one hook (`hiddenFor`).
 */

export interface MockReport {
  id: string;
  reporterId: string;
  target: CreateReportRequest['target'];
  reason: ReportReason;
  note: string | null;
  ticketId: string;
  createdAt: string;
}

export interface MockBlock {
  blockerId: string;
  blockedId: string;
  createdAt: string;
}

/** Either one blocked the other. Blocking cuts both ways: neither sees the other's content. */
export const blockedBetween = (world: MockWorld, a: string, b: string) =>
  a !== b &&
  world.blocks.some(
    (x) => (x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a),
  );

/**
 * Whether `u` shouldn't see an item: they reported it (hidden for the reporter straight away), or
 * its author and `u` blocked each other. Official Team Impact posts can't be blocked. A suspended
 * author's content is hidden from everyone until staff restore them (staff can't be suspended).
 */
export const hiddenFor = (
  world: MockWorld,
  u: MockUser,
  item: { id: string; authorId: string; official?: boolean },
) =>
  world.reports.some((r) => r.reporterId === u.id && r.target.id === item.id) ||
  (!item.official && blockedBetween(world, u.id, item.authorId)) ||
  world.staffTools.suspensions.some((s) => s.userId === item.authorId);

/**
 * What a report points at, as `u` can see it, with a one-line preview for the staff ticket.
 * Null when it doesn't exist or `u` can't see it (which reads as 404, never "it exists").
 */
export const reportTarget = (
  world: MockWorld,
  u: MockUser,
  target: CreateReportRequest['target'],
): { preview: string } | null => {
  switch (target.kind) {
    case 'post': {
      const p = world.feed(u).find((x) => x.id === target.id);
      if (!p) return null;
      return { preview: p.kind === 'opportunity' ? p.opportunity.title : p.text };
    }
    case 'event': {
      const e = world.eventsFor(u).find((x) => x.id === target.id);
      return e ? { preview: e.title } : null;
    }
    case 'community': {
      const c = world.communities.find((x) => x.id === target.id);
      return c && world.canSeeCommunity(c, u) ? { preview: c.name } : null;
    }
    case 'comment': {
      // Only a comment on a post the reporter can read, that they can see themselves.
      const k = world.comments.find((x) => x.id === target.id);
      if (!k || !world.feed(u).some((p) => p.id === k.postId)) return null;
      return commentsFor(world, k.postId, u).some((x) => x.id === k.id)
        ? { preview: k.text }
        : null;
    }
    case 'profile': {
      if (target.id === u.id) return null;
      const other = world.user(target.id);
      if (other) return { preview: `${other.firstName} ${other.lastName}` };
      // A child's profile is only visible to their team, so only the team can report it.
      const child = world.children.find((c) => c.id === target.id);
      return child && canSeeChild(world, child, u) ? { preview: child.firstName } : null;
    }
  }
};

/** Files a report. Reports on one item collect into one open ticket. */
export const fileReport = (
  world: MockWorld,
  u: MockUser,
  body: CreateReportRequest,
  preview: string,
): MockReport => {
  const now = new Date().toISOString();
  let ticket = world.tickets.find(
    (t) =>
      t.status === 'open' && t.target.kind === body.target.kind && t.target.id === body.target.id,
  );
  if (ticket) {
    ticket.reportCount += 1;
    if (!ticket.reasons.includes(body.reason)) ticket.reasons.push(body.reason);
  } else {
    ticket = {
      id: world.newId(),
      target: body.target,
      preview,
      reasons: [body.reason],
      reportCount: 1,
      status: 'open',
      resolution: null,
      createdAt: now,
    } satisfies ModerationTicket;
    world.tickets.push(ticket);
  }
  const report: MockReport = {
    id: world.newId(),
    reporterId: u.id,
    target: body.target,
    reason: body.reason,
    note: body.note ?? null,
    ticketId: ticket.id,
    createdAt: now,
  };
  world.reports.push(report);
  return report;
};

export const myReport = (world: MockWorld, r: MockReport) => ({
  id: r.id,
  target: r.target,
  reason: r.reason,
  note: r.note,
  status: world.tickets.find((t) => t.id === r.ticketId)?.status ?? 'open',
  createdAt: r.createdAt,
});

/** A stored post in the shape `u` reads it, through the feed's own mapping. */
export const toPost = (world: MockWorld, p: MockPost, u: MockUser): Post | undefined => {
  const c = world.communities.find((x) => x.id === p.communityId);
  return c ? world.postsIn(new Map([[c.id, c]]), u).find((x) => x.id === p.id) : undefined;
};

const removeWhere = <T>(items: T[], drop: (item: T) => boolean) => {
  for (let i = items.length - 1; i >= 0; i--) if (drop(items[i]!)) items.splice(i, 1);
};

/**
 * Deletes `u`'s account (P3): hidden everywhere at once. The real API keeps the rows for 30 days
 * before erasing them; the mock drops them now. A parent takes their children's profiles with
 * them. Returns an error as `[status, message]`, or null on success.
 */
export const deleteAccount = (world: MockWorld, u: MockUser): [number, string] | null => {
  if (u.role === 'staff') return [403, 'Staff accounts are closed by Team Impact, not in the app'];
  // A live team always keeps at least one coach (PRD §3).
  for (const teamId of world.teamIdsOf(u.id)) {
    const team = world.teams.find((t) => t.id === teamId);
    const coaches = world.teamMembers.filter(
      (m) => m.teamId === teamId && world.user(m.userId)?.role === 'coach',
    );
    if (u.role === 'coach' && team?.status === 'live' && coaches.length === 1) {
      return [409, 'You’re this team’s only coach. Ask Team Impact to add another coach first.'];
    }
  }

  const gone = (id: string) => id === u.id;
  // A parent's children have no account of their own; their profiles go with the parent.
  removeWhere(world.children, (c) => gone(c.parentId));
  removeWhere(world.teamMembers, (m) => gone(m.userId));
  removeWhere(world.joinRequests, (r) => gone(r.requester.id));
  removeWhere(world.cards, (c) => gone(c.face.athleteId));
  removeWhere(world.posts, (p) => gone(p.authorId));
  removeWhere(world.events, (e) => gone(e.hostId));
  // Their rallies and RSVPs come off others' posts and events, with the counts.
  for (const r of world.rallies.filter((x) => gone(x.userId))) {
    const p = world.posts.find((x) => x.id === r.postId);
    if (p) p.likeCount = Math.max(0, p.likeCount - 1);
  }
  removeWhere(world.rallies, (r) => gone(r.userId));
  for (const r of world.rsvps.filter((x) => gone(x.userId) && x.status === 'going')) {
    const e = world.events.find((x) => x.id === r.eventId);
    if (e) e.goingCount = Math.max(0, e.goingCount - 1);
  }
  removeWhere(world.rsvps, (r) => gone(r.userId));
  // Comments they wrote, and every comment, rally and RSVP on what they posted.
  const postIds = new Set(world.posts.map((p) => p.id));
  const eventIds = new Set(world.events.map((e) => e.id));
  removeWhere(world.comments, (k) => gone(k.authorId) || !postIds.has(k.postId));
  removeWhere(world.rallies, (r) => !postIds.has(r.postId));
  removeWhere(world.rsvps, (r) => !eventIds.has(r.eventId));
  removeWhere(world.notifications, (n) => gone(n.userId) || n.actorId === u.id);
  world.notificationPrefs.delete(u.id);
  // What they did and what was shown about them, as the events_log foreign keys cascade.
  removeWhere(world.eventsLog, (e) => gone(e.userId ?? '') || gone(e.subjectId ?? ''));
  // Card drafts, pending resumes and card history.
  world.profiles.drafts.delete(u.id);
  world.profiles.resumes.delete(u.id);
  world.profiles.history.delete(u.id);
  world.profiles.updatedAt.delete(u.id);
  // Codes and invites they made stop working and leave the logs; their QR joins drop off too.
  removeWhere(world.qrCodes, (q) => gone(q.createdById));
  for (const q of world.qrCodes) q.joins = q.joins.filter((j) => !gone(j.userId));
  removeWhere(world.coachInvites, (i) => gone(i.invitedById));
  removeWhere(world.blocks, (b) => gone(b.blockerId) || gone(b.blockedId));
  removeWhere(world.reports, (r) => gone(r.reporterId));
  removeWhere(world.lists, (l) => gone(l.ownerId));
  for (const l of world.lists) {
    l.sharedWithIds = l.sharedWithIds.filter((id) => !gone(id));
    l.entries = l.entries.filter((e) => !gone(e.athleteId));
    // A departed colleague's saves stay on the list, credited to its owner.
    for (const e of l.entries) if (gone(e.addedById)) e.addedById = l.ownerId;
  }

  for (const c of [...world.communities]) {
    c.members = c.members.filter((m) => !gone(m.userId));
    if (c.kind !== 'interest' && c.kind !== 'medical') continue;
    c.requests = c.requests.filter((r) => !gone(r.userId));
    if (!gone(c.createdById)) continue;
    // The longest-standing member takes over; an empty community goes with its creator.
    const heir = [...c.members].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt))[0];
    if (heir) {
      c.createdById = heir.userId;
    } else {
      removeWhere(world.posts, (p) => p.communityId === c.id);
      removeWhere(world.events, (e) => e.communityId === c.id);
      removeWhere(world.communities, (x) => x.id === c.id);
    }
  }

  removeWhere(world.users, (x) => gone(x.id));
  return null;
};
