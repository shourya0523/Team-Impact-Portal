import { z } from 'zod';
import { Timestamp } from '@team-impact/contracts';
import type { MockCommunity, MockPost } from './fixtures';

/**
 * Feed order and paging (PRD §5, P6), kept apart from `MockWorld` so ranking can change without
 * touching who sees what. Visibility is decided before anything reaches here.
 */

/** Team first, then the viewer's other communities (medical and private included), then Team Impact. */
export const TIER: Record<MockCommunity['kind'], number> = {
  team: 0,
  interest: 1,
  medical: 1,
  team_impact: 2,
};

/** Where a post sits in feed order. Ids are unique, so no two posts share a key. */
const SortKey = z.object({
  tier: z.number().int(),
  createdAt: Timestamp,
  id: z.string().min(1),
});
type SortKey = z.infer<typeof SortKey>;

type CommunityOf = (p: MockPost) => MockCommunity;

const keyOf = (p: MockPost, communityOf: CommunityOf): SortKey => ({
  tier: TIER[communityOf(p).kind],
  createdAt: p.createdAt,
  id: p.id,
});

/** Plain string order: ISO timestamps and fixed-width ids sort correctly without a locale. */
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Negative when `a` comes first: lower tier, then newer, then (same moment) the higher id. */
const compare = (a: SortKey, b: SortKey) =>
  a.tier - b.tier || byString(b.createdAt, a.createdAt) || byString(b.id, a.id);

/** Posts in feed order. A total order, so a cursor always knows exactly where it stopped. */
export const rank = (posts: MockPost[], communityOf: CommunityOf): MockPost[] =>
  posts
    .map((p) => ({ p, key: keyOf(p, communityOf) }))
    .sort((a, b) => compare(a.key, b.key))
    .map(({ p }) => p);

/**
 * What a cursor carries: which feed it belongs to (`home` or a community id), when its first page
 * was asked for (`asOf`, so a score that decays with time is worked out the same on every page),
 * and the key of the last post it returned. Clients treat it as an opaque string.
 */
const Cursor = z.object({
  v: z.literal(1),
  feed: z.string().min(1),
  asOf: Timestamp,
  after: SortKey,
});
type Cursor = z.infer<typeof Cursor>;

const encodeCursor = (c: Cursor) => Buffer.from(JSON.stringify(c)).toString('base64url');

/** The cursor, or null if it isn't one we issued (garbage, edited, or an old version). */
const decodeCursor = (raw: string): Cursor | null => {
  try {
    const parsed = Cursor.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export interface FeedPageRequest {
  /** `home`, or the community's id. A cursor only works on the feed that issued it. */
  feed: string;
  cursor?: string;
  limit: number;
  /** The request time; becomes the cursor's `asOf` on a first page. */
  now: string;
}

export interface FeedPage {
  posts: MockPost[];
  nextCursor: string | null;
  /** When this run of pages was first asked for (the first page's `now`). */
  asOf: string;
}

/**
 * One page of `ranked` (already in `rank` order): the posts strictly after the cursor's last one.
 * It goes by key, not position, so posts added or removed between pages never cause a repeat or a
 * gap. Returns null for a cursor that's invalid or from another feed (the route answers 400).
 *
 * The mock has every ranked post in memory, so it finds the start with a scan; the real query
 * filters on the key instead (`WHERE (tier, created_at, id) > …`) and fetches `limit + 1`.
 */
export const pageOf = (
  ranked: MockPost[],
  communityOf: CommunityOf,
  { feed, cursor, limit, now }: FeedPageRequest,
): FeedPage | null => {
  let asOf = now;
  let start = 0;
  if (cursor !== undefined) {
    const c = decodeCursor(cursor);
    if (!c || c.feed !== feed) return null;
    asOf = c.asOf;
    start = ranked.findIndex((p) => compare(keyOf(p, communityOf), c.after) > 0);
    if (start === -1) start = ranked.length;
  }
  const posts = ranked.slice(start, start + limit);
  const last = posts.at(-1);
  const more = start + limit < ranked.length;
  return {
    posts,
    asOf,
    nextCursor:
      more && last ? encodeCursor({ v: 1, feed, asOf, after: keyOf(last, communityOf) }) : null,
  };
};
