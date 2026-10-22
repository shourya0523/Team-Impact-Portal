import type { MockCommunity, MockPost } from './fixtures';

/**
 * Feed order (PRD §5, P6), kept apart from `MockWorld` so ranking can change without touching who
 * sees what. Visibility is decided before anything reaches here.
 */

/** Team first, then the viewer's other communities (medical and private included), then Team Impact. */
export const TIER: Record<MockCommunity['kind'], number> = {
  team: 0,
  interest: 1,
  medical: 1,
  team_impact: 2,
};

/** Posts in feed order: by tier, then newest first. Stable, so equal timestamps keep their order. */
export const rank = (posts: MockPost[], communityOf: (p: MockPost) => MockCommunity): MockPost[] =>
  [...posts].sort(
    (a, b) =>
      TIER[communityOf(a).kind] - TIER[communityOf(b).kind] ||
      b.createdAt.localeCompare(a.createdAt),
  );
