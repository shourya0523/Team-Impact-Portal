import {
  type CalendarEvent,
  can,
  type CommunityMember,
  MEMBERS_PRIVATE_MEDICAL,
  type MembersDenial,
  membersDenial,
} from '@team-impact/contracts';
import { summaryOf, type MockCommunity, type MockUser } from './fixtures';
import { actorOf, communityFacts } from './policy';
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

const DENIALS: Record<MembersDenial, string> = {
  recruiter: 'Recruiters don’t see member lists',
  medical: MEMBERS_PRIVATE_MEDICAL,
  team_impact: 'Everyone is in the Team Impact community',
  private: 'A private community’s members are for members only',
  not_member: 'Join to see who’s here',
};

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
  const denial = membersDenial(actorOf(world, u), communityFacts(world, c, u));
  if (denial) return { status: 403, error: DENIALS[denial] };
  const rows =
    c.kind === 'team'
      ? world.teamMembers
          .filter((m) => m.teamId === c.teamId)
          .map((m) => ({ userId: m.userId, joinedAt: m.joinedAt }))
      : c.members.map((m) => ({ userId: m.userId, joinedAt: m.joinedAt }));
  const actor = actorOf(world, u);
  const members = rows
    .map((r) => ({ who: world.user(r.userId), joinedAt: r.joinedAt }))
    .filter((r): r is { who: MockUser; joinedAt: string } => !!r.who)
    .filter(({ who }) =>
      can(actor, 'community.listMember', {
        kind: c.kind,
        memberId: who.id,
        memberRole: who.role,
        blocked: blockedBetween(world, u.id, who.id),
      }),
    )
    .sort(
      (a, b) =>
        (ROLE_ORDER[a.who.role] ?? 2) - (ROLE_ORDER[b.who.role] ?? 2) ||
        a.who.lastName.localeCompare(b.who.lastName) ||
        a.who.firstName.localeCompare(b.who.firstName),
    )
    .map(({ who, joinedAt }) => ({ user: summaryOf(who), joinedAt }));
  return { members };
};
