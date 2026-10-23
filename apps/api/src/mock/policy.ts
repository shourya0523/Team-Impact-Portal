import type { Actor, CardFacts, CommunityFacts, ContentFacts } from '@team-impact/contracts';
import type { MockCard, MockCommunity, MockUser } from './fixtures';
import { blockedBetween } from './safety';
import { isSuspended } from './staff-tools';
import type { MockWorld } from './world';

/**
 * Turns mock state into the plain facts `can()` (`@team-impact/contracts` policy) decides on. The
 * rules live there; this file only looks things up, as the database routes will.
 */

export const actorOf = (world: MockWorld, u: MockUser): Actor => ({
  id: u.id,
  role: u.role,
  teamIds: world.teamIdsOf(u.id),
  companyId: u.companyId ?? null,
});

/**
 * `viewer`: who is looking, for the block between them and the card's owner. Null for checks
 * about the card itself, with nobody in particular looking (`recruiterVisible`).
 */
export const cardFacts = (
  world: MockWorld,
  card: MockCard,
  viewer: MockUser | null,
): CardFacts => ({
  athleteId: card.face.athleteId,
  ownerRole: world.user(card.face.athleteId)?.role ?? 'athlete',
  teamId: card.face.teamId,
  published: card.visibility.published,
  openToRecruiting: card.visibility.openToRecruiting,
  ownerSuspended: isSuspended(world, card.face.athleteId),
  blocked: viewer ? blockedBetween(world, viewer.id, card.face.athleteId) : false,
});

export const communityFacts = (
  world: MockWorld,
  c: MockCommunity,
  u: MockUser,
): CommunityFacts => ({
  kind: c.kind,
  moderation: c.moderation,
  medicalEnabled: world.flags.medicalCommunities,
  isMember:
    c.kind === 'team'
      ? world.teamIdsOf(u.id).includes(c.teamId)
      : c.kind === 'team_impact'
        ? u.role !== 'recruiter'
        : c.members.some((m) => m.userId === u.id),
  ...(c.kind === 'interest' ? { official: c.official } : {}),
  ...(c.kind === 'interest' || c.kind === 'medical'
    ? { private: c.private, createdById: c.createdById }
    : {}),
});

export const contentFacts = (
  world: MockWorld,
  u: MockUser,
  item: { id: string; authorId: string; official?: boolean },
): ContentFacts => ({
  authorId: item.authorId,
  official: item.official,
  blocked: blockedBetween(world, u.id, item.authorId),
  reportedByActor: world.reports.some((r) => r.reporterId === u.id && r.target.id === item.id),
  authorSuspended: isSuspended(world, item.authorId),
});
