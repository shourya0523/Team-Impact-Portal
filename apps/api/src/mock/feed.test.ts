import { describe, expect, it } from 'vitest';
import { pageOf, rank } from './feed';
import { COMMUNITIES, id, type MockPost } from './fixtures';

const TEAM = COMMUNITIES.find((c) => c.kind === 'team')!;
const INTEREST = COMMUNITIES.find((c) => c.kind === 'interest')!;
const TEAM_IMPACT = COMMUNITIES.find((c) => c.kind === 'team_impact')!;
const communities = new Map([TEAM, INTEREST, TEAM_IMPACT].map((c) => [c.id, c]));
const communityOf = (p: MockPost) => communities.get(p.communityId)!;

const NOW = '2026-10-20T12:00:00.000Z';

const post = (n: number, communityId: string, createdAt: string): MockPost => ({
  id: id(n),
  kind: 'post',
  authorId: id(1),
  communityId,
  text: `Post ${n}`,
  official: false,
  likeCount: 0,
  commentCount: 0,
  moderation: 'approved',
  createdAt,
});

const day = (d: number, hour = 12) =>
  `2026-10-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00.000Z`;

/** Seven posts across the three tiers, with two that share a timestamp. */
const POSTS = [
  post(1, TEAM_IMPACT.id, day(15)),
  post(2, INTEREST.id, day(12)),
  post(3, TEAM.id, day(10)),
  post(4, TEAM.id, day(14)),
  post(5, TEAM.id, day(14)), // same moment as 4
  post(6, INTEREST.id, day(13)),
  post(7, TEAM_IMPACT.id, day(11)),
];
const RANKED = [5, 4, 3, 6, 2, 1, 7].map(id);

const ids = (posts: MockPost[]) => posts.map((p) => p.id);

/** Every page of `posts` in turn, `limit` at a time, as the app would ask for them. */
const walk = (posts: MockPost[], limit: number, feed = 'home') => {
  const pages: string[][] = [];
  let cursor: string | undefined;
  do {
    const page = pageOf(rank(posts, communityOf), communityOf, { feed, cursor, limit, now: NOW })!;
    pages.push(ids(page.posts));
    cursor = page.nextCursor ?? undefined;
    // A cursor that doesn't move on would loop forever; fail instead.
    if (pages.length > posts.length + 1) throw new Error('paging never ended');
  } while (cursor);
  return pages;
};

describe('feed: rank', () => {
  it('orders by tier, then newest first, then the higher id for posts made at the same moment', () => {
    expect(ids(rank(POSTS, communityOf))).toEqual(RANKED);
  });

  it('gives the same order whatever order the posts arrive in', () => {
    expect(ids(rank([...POSTS].reverse(), communityOf))).toEqual(RANKED);
  });
});

describe('feed: pages', () => {
  it('covers the whole feed once, in order, for any page size', () => {
    for (const limit of [1, 2, 3, 7, 20]) {
      const pages = walk(POSTS, limit);
      expect(pages.flat(), `limit ${limit}`).toEqual(RANKED);
      expect(pages.every((p) => p.length > 0 && p.length <= limit)).toBe(true);
    }
  });

  it('ends with a null cursor, and no empty last page when the feed divides evenly', () => {
    const six = POSTS.slice(0, 6);
    expect(walk(six, 2)).toHaveLength(3);
    const first = pageOf(rank([], communityOf), communityOf, { feed: 'home', limit: 20, now: NOW });
    expect(first).toEqual({ posts: [], nextCursor: null, asOf: NOW });
  });

  it('neither repeats nor skips when a post arrives between pages', () => {
    const first = pageOf(rank(POSTS, communityOf), communityOf, {
      feed: 'home',
      limit: 3,
      now: NOW,
    })!;
    // A new team post would go straight to the top, shifting every position by one.
    const later = [...POSTS, post(8, TEAM.id, day(16))];
    const second = pageOf(rank(later, communityOf), communityOf, {
      feed: 'home',
      cursor: first.nextCursor!,
      limit: 3,
      now: NOW,
    })!;
    expect(ids(first.posts)).toEqual(RANKED.slice(0, 3));
    expect(ids(second.posts)).toEqual(RANKED.slice(3, 6));
  });

  it('picks up after the right post when the last one seen is taken down', () => {
    const first = pageOf(rank(POSTS, communityOf), communityOf, {
      feed: 'home',
      limit: 3,
      now: NOW,
    })!;
    const lastSeen = first.posts.at(-1)!.id;
    const removed = POSTS.filter((p) => p.id !== lastSeen);
    const second = pageOf(rank(removed, communityOf), communityOf, {
      feed: 'home',
      cursor: first.nextCursor!,
      limit: 3,
      now: NOW,
    })!;
    expect(ids(second.posts)).toEqual(RANKED.slice(3, 6));
  });

  it('keeps the first page’s time on every later page', () => {
    const first = pageOf(rank(POSTS, communityOf), communityOf, {
      feed: 'home',
      limit: 2,
      now: NOW,
    })!;
    const second = pageOf(rank(POSTS, communityOf), communityOf, {
      feed: 'home',
      cursor: first.nextCursor!,
      limit: 2,
      now: '2026-10-20T13:00:00.000Z',
    })!;
    expect(second.asOf).toBe(NOW);
  });
});

describe('feed: cursors that aren’t ours', () => {
  const ranked = rank(POSTS, communityOf);
  const request = (cursor: string, feed = 'home') =>
    pageOf(ranked, communityOf, { feed, cursor, limit: 2, now: NOW });
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const valid = pageOf(ranked, communityOf, { feed: 'home', limit: 2, now: NOW })!.nextCursor!;
  const decoded = JSON.parse(Buffer.from(valid, 'base64url').toString('utf8'));

  it('accepts the cursor it issued', () => {
    expect(request(valid)).not.toBeNull();
  });

  it('refuses garbage, an empty cursor, and JSON that isn’t a cursor', () => {
    for (const raw of ['not-a-cursor', '', '%%%', encode('hello'), encode({ v: 1 })]) {
      expect(request(raw), raw).toBeNull();
    }
  });

  it('refuses an edited cursor or one from another version', () => {
    expect(request(encode({ ...decoded, v: 2 }))).toBeNull();
    expect(request(encode({ ...decoded, asOf: 'yesterday' }))).toBeNull();
    expect(request(encode({ ...decoded, after: { ...decoded.after, tier: 'x' } }))).toBeNull();
  });

  it('refuses a cursor from another feed', () => {
    expect(request(valid, TEAM.id)).toBeNull();
  });
});
