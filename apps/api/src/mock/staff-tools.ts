import type {
  CreateReportRequest,
  ModerationAction,
  ModerationLogEntry,
  SuspendedUser,
} from '@team-impact/contracts';
import { notify } from './activity';
import { summaryOf } from './fixtures';
import type { MockUser, MockWorld } from './world';

/**
 * Staff tools on accounts (PRD §9, Notion "Moderation"): suspensions and the moderation action
 * log. Pure helpers over a `MockWorld`; the session guard (`routes/context.ts`) refuses suspended
 * accounts and `hiddenFor` (`./safety.ts`) drops their content from every feed.
 */

export interface MockSuspension {
  userId: string;
  reason: string | null;
  byId: string;
  ticketId: string | null;
  suspendedAt: string;
}

export interface MockLogEntry {
  id: string;
  actorId: string;
  action: ModerationAction;
  target: ModerationLogEntry['target'];
  ticketId: string | null;
  note: string | null;
  createdAt: string;
}

/** Per-world state for this area. */
export const newStaffToolsState = () => ({
  suspensions: [] as MockSuspension[],
  log: [] as MockLogEntry[],
});

type Target = CreateReportRequest['target'];
type Failure = { status: number; message: string };

const name = (u: MockUser) => `${u.firstName} ${u.lastName}`;

export const isSuspended = (world: MockWorld, userId: string) =>
  world.staffTools.suspensions.some((s) => s.userId === userId);

/** Append one entry to the moderation log. Every staff moderation action goes through here. */
export const logAction = (
  world: MockWorld,
  actor: MockUser,
  action: ModerationAction,
  target: ModerationLogEntry['target'],
  { ticketId = null, note = null }: { ticketId?: string | null; note?: string | null } = {},
) => {
  world.staffTools.log.push({
    id: world.newId(),
    actorId: actor.id,
    action,
    target: { ...target, label: target.label.slice(0, 120) },
    ticketId,
    note,
    createdAt: new Date().toISOString(),
  });
};

export const userTarget = (u: MockUser): ModerationLogEntry['target'] => ({
  kind: 'user',
  id: u.id,
  label: name(u),
});

/**
 * The account behind a ticket's item. Children have no account (a profile ticket on a child
 * points at no user), and team and Team Impact communities have no author.
 */
export const authorOf = (world: MockWorld, target: Target): MockUser | Failure => {
  const authorId =
    target.kind === 'post'
      ? world.posts.find((p) => p.id === target.id)?.authorId
      : target.kind === 'comment'
        ? world.comments.find((k) => k.id === target.id)?.authorId
        : target.kind === 'event'
          ? world.events.find((e) => e.id === target.id)?.hostId
          : target.kind === 'community'
            ? (() => {
                const c = world.communities.find((x) => x.id === target.id);
                return c && 'createdById' in c ? c.createdById : undefined;
              })()
            : target.id;
  const u = authorId ? world.user(authorId) : undefined;
  if (!u) {
    return {
      status: 400,
      message:
        target.kind === 'profile'
          ? 'Children have no account to warn or suspend. Talk to their parent and coach.'
          : 'This item has no author account to act on',
    };
  }
  return u;
};

/** Why `u` can't be suspended, or null. Staff never can, nor a team's last active coach. */
export const cannotSuspend = (world: MockWorld, u: MockUser): Failure | null => {
  if (u.role === 'staff') return { status: 400, message: 'Staff accounts can’t be suspended' };
  if (u.role !== 'coach') return null;
  for (const teamId of world.teamIdsOf(u.id)) {
    const team = world.teams.find((t) => t.id === teamId);
    if (!team || team.status === 'archived') continue;
    const otherCoaches = world.teamMembers.filter(
      (m) =>
        m.teamId === teamId &&
        m.userId !== u.id &&
        world.user(m.userId)?.role === 'coach' &&
        !isSuspended(world, m.userId),
    );
    if (otherCoaches.length === 0) {
      return {
        status: 409,
        message: `${name(u)} is the last coach of ${team.name}. Add another coach before suspending them.`,
      };
    }
  }
  return null;
};

/**
 * Lock `u` out: every route answers 403 and their content leaves every feed. Their data stays,
 * and a parent's children keep their profiles. Returns an error, or null (also when already
 * suspended).
 */
export const suspend = (
  world: MockWorld,
  staff: MockUser,
  u: MockUser,
  { reason = null, ticketId = null }: { reason?: string | null; ticketId?: string | null } = {},
): Failure | null => {
  const refused = cannotSuspend(world, u);
  if (refused) return refused;
  if (isSuspended(world, u.id)) return null;
  world.staffTools.suspensions.push({
    userId: u.id,
    reason,
    byId: staff.id,
    ticketId,
    suspendedAt: new Date().toISOString(),
  });
  logAction(world, staff, 'suspend', userTarget(u), { ticketId, note: reason });
  return null;
};

/** Let `u` back in. Returns false if they weren't suspended. */
export const unsuspend = (world: MockWorld, staff: MockUser, u: MockUser) => {
  const before = world.staffTools.suspensions.length;
  const kept = world.staffTools.suspensions.filter((s) => s.userId !== u.id);
  if (kept.length === before) return false;
  world.staffTools.suspensions.splice(0, before, ...kept);
  logAction(world, staff, 'unsuspend', userTarget(u));
  return true;
};

const WHAT: Record<Target['kind'], string> = {
  post: 'post',
  comment: 'comment',
  event: 'event',
  profile: 'profile',
  community: 'community',
};

/**
 * Warn the author of a ticket's item. The notification shows as from Team Impact (no staff name)
 * and links to Team Impact's community, never back to the item, which may be gone.
 */
export const warn = (
  world: MockWorld,
  staff: MockUser,
  author: MockUser,
  ticket: { id: string; target: Target; preview: string },
  note: string | null,
) => {
  const home = world.communities.find((c) => c.kind === 'team_impact')!;
  notify(world, {
    userId: author.id,
    kind: 'warning',
    actorId: null,
    text: `Team Impact reviewed your ${WHAT[ticket.target.kind]} and is giving you a warning. Please keep to the community guidelines.`,
    target: { kind: 'community', id: home.id },
    communityId: home.id,
  });
  logAction(world, staff, 'warn', userTarget(author), { ticketId: ticket.id, note });
};

export const suspendedUsers = (world: MockWorld): SuspendedUser[] =>
  [...world.staffTools.suspensions]
    .sort((a, b) => b.suspendedAt.localeCompare(a.suspendedAt))
    .map((s) => ({
      user: summaryOf(world.user(s.userId)!),
      reason: s.reason,
      suspendedBy: summaryOf(world.user(s.byId)!),
      ticketId: s.ticketId,
      suspendedAt: s.suspendedAt,
    }));

/** Newest first. */
export const moderationLog = (world: MockWorld): ModerationLogEntry[] =>
  [...world.staffTools.log].reverse().map(({ actorId, ...e }) => ({
    ...e,
    actor: summaryOf(world.user(actorId)!),
  }));
