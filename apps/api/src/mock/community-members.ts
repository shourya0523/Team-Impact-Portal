import {
  type CalendarEvent,
  type CommunityMember,
  MEMBERS_PRIVATE_MEDICAL,
} from '@team-impact/contracts';
import { summaryOf, type MockCommunity, type MockUser } from './fixtures';
import { blockedBetween } from './safety';
import type { MockWorld } from './world';

/**
 * A community's events and member list, as `u` may see them. Pure helpers over the world so the
 * routes stay thin and the rules sit in one place.
 */

/** Approved events in the community (plus `u`'s own held ones), hidden and blocked ones left out. */
export const communityEvents = (
  world: MockWorld,
  c: MockCommunity,
  u: MockUser,
): CalendarEvent[] =>
  world.readsCommunity(c, u) ? world.eventsFor(u).filter((e) => e.community.id === c.id) : [];

const ROLE_ORDER: Partial<Record<MockUser['role'], number>> = { coach: 0, athlete: 1 };

export type MembersResult = { members: CommunityMember[] } | { status: 403; error: string };

/**
 * The member list, or why it can't be shown. Lists reach members only. Nobody is told who else is
 * in a medical community; the Team Impact community is everyone, so only its count shows;
 * recruiters see members of nothing. Children are never users, so never listed; a teen's name only
 * appears in their own team's community (to its members), never in interest communities. Blocks
 * cut both ways.
 */
export const communityMembers = (
  world: MockWorld,
  c: MockCommunity,
  u: MockUser,
): MembersResult => {
  if (u.role === 'recruiter') return { status: 403, error: 'Recruiters don’t see member lists' };
  if (c.kind === 'medical') return { status: 403, error: MEMBERS_PRIVATE_MEDICAL };
  if (c.kind === 'team_impact') {
    return { status: 403, error: 'Everyone is in the Team Impact community' };
  }
  if (!world.readsCommunity(c, u)) {
    const isPrivate = c.kind === 'interest' && c.private;
    return {
      status: 403,
      error: isPrivate
        ? 'A private community’s members are for members only'
        : 'Join to see who’s here',
    };
  }
  const rows =
    c.kind === 'team'
      ? world.teamMembers
          .filter((m) => m.teamId === c.teamId)
          .map((m) => ({ userId: m.userId, joinedAt: m.joinedAt }))
      : c.members.map((m) => ({ userId: m.userId, joinedAt: m.joinedAt }));
  const members = rows
    .map((r) => ({ who: world.user(r.userId), joinedAt: r.joinedAt }))
    .filter((r): r is { who: MockUser; joinedAt: string } => !!r.who)
    .filter(({ who }) => who.role !== 'teen' || c.kind === 'team')
    .filter(({ who }) => who.id === u.id || !blockedBetween(world, u.id, who.id))
    .sort(
      (a, b) =>
        (ROLE_ORDER[a.who.role] ?? 2) - (ROLE_ORDER[b.who.role] ?? 2) ||
        a.who.lastName.localeCompare(b.who.lastName) ||
        a.who.firstName.localeCompare(b.who.firstName),
    )
    .map(({ who, joinedAt }) => ({ user: summaryOf(who), joinedAt }));
  return { members };
};
