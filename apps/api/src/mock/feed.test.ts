import { describe, expect, it } from 'vitest';
import { heuristic, type HeuristicParams, pageOf, rank } from './feed';
import { COMMUNITIES, id, type MockCommunity, type MockPost } from './fixtures';

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
    expect(request(encode({ ...decoded, after: { ...decoded.after, score: 'x' } }))).toBeNull();
  });

  it('refuses a cursor from another feed', () => {
    expect(request(valid, TEAM.id)).toBeNull();
  });
});

describe('feed: heuristic score', () => {
  const PARAMS: HeuristicParams = { halfLifeHours: 24, commentWeight: 2, damping: 'log' };
  const noComments = () => 0;
  const PRIVATE = COMMUNITIES.find((c) => c.kind === 'interest' && c.private)!;
  const MEDICAL = COMMUNITIES.find((c) => c.kind === 'medical')!;
  const hoursBefore = (hours: number) =>
    new Date(Date.parse(NOW) - hours * 3_600_000).toISOString();
  const at = (hours: number, likeCount = 0) => ({
    ...post(1, INTEREST.id, hoursBefore(hours)),
    likeCount,
  });
  const score = (
    p: MockPost,
    params = PARAMS,
    comments = noComments,
    c: MockCommunity = INTEREST,
  ) => heuristic(params, comments)(p, c, NOW);

  it('halves with every half-life', () => {
    expect(score(at(24, 5)) / score(at(0, 5))).toBeCloseTo(0.5, 10);
    expect(score(at(72, 5)) / score(at(0, 5))).toBeCloseTo(0.125, 10);
  });

  it('never drops as rallies or comments go up', () => {
    let previous = 0;
    for (let likes = 0; likes <= 200; likes++) {
      const next = score(at(10, likes));
      expect(next).toBeGreaterThanOrEqual(previous);
      previous = next;
    }
    expect(score(at(10), PARAMS, () => 3)).toBeGreaterThan(score(at(10)));
  });

  it('counts a comment as `commentWeight` rallies', () => {
    expect(score(at(0, 0), PARAMS, () => 1)).toBe(score(at(0, 2)));
  });

  it('damps with ln(1 + x) or √x, starting from 1 so a quiet post still scores', () => {
    expect(score(at(0, 0))).toBe(1);
    expect(score(at(0, Math.E - 1))).toBeCloseTo(2, 10);
    expect(score(at(0, 9), { ...PARAMS, damping: 'sqrt' })).toBe(4);
  });

  it('multiplies by the community’s weight, and the private weight on top', () => {
    const params = {
      ...PARAMS,
      communityWeight: { interest: 2, medical: 3 },
      privateWeight: 1.5,
    };
    const p = at(0, 4);
    const base = score(p);
    expect(score(p, params)).toBeCloseTo(base * 2, 10);
    // The fixture medical community is private too, so both weights apply.
    expect(score(p, params, noComments, MEDICAL)).toBeCloseTo(base * 3 * 1.5, 10);
    expect(score(p, params, noComments, PRIVATE)).toBeCloseTo(base * 2 * 1.5, 10);
  });

  it('treats a post made after `asOf` as brand new, not from the future', () => {
    expect(score(at(-5, 3))).toBe(score(at(0, 3)));
  });

  it('never lets a score cross tiers', () => {
    const scorer = heuristic(PARAMS, noComments);
    const viral = { ...post(1, TEAM_IMPACT.id, NOW), likeCount: 10_000 };
    const stale = post(2, TEAM.id, hoursBefore(24 * 21));
    expect(ids(rank([viral, stale], communityOf, scorer, NOW))).toEqual([id(2), id(1)]);
  });
});

describe('feed: pages with the heuristic', () => {
  const scorer = heuristic({ halfLifeHours: 12, commentWeight: 2, damping: 'log' }, () => 0);
  /** The seven posts again, with spread-out rallies so the score reorders them within tiers. */
  const posts = POSTS.map((p, i) => ({ ...p, likeCount: [3, 90, 0, 7, 1, 0, 12][i]! }));
  const first = (limit: number) =>
    pageOf(posts, communityOf, { feed: 'home', limit, now: NOW }, scorer)!;

  it('covers the whole ranking once, in order', () => {
    const order = ids(rank(posts, communityOf, scorer, NOW));
    expect(order).not.toEqual(RANKED); // the score really did reorder something
    const seen: string[] = [];
    let page = first(2);
    for (let pages = 1; ; pages++) {
      seen.push(...ids(page.posts));
      if (!page.nextCursor) break;
      if (pages > posts.length + 1) throw new Error('paging never ended');
      page = pageOf(
        posts,
        communityOf,
        { feed: 'home', cursor: page.nextCursor, limit: 2, now: NOW },
        scorer,
      )!;
    }
    expect(seen).toEqual(order);
  });

  it('scores later pages as of the first page’s time', () => {
    const later = new Date(Date.parse(NOW) + 5 * 3_600_000).toISOString();
    const second = pageOf(
      posts,
      communityOf,
      { feed: 'home', cursor: first(2).nextCursor!, limit: 2, now: later },
      scorer,
    )!;
    expect(second.asOf).toBe(NOW);
    expect(ids(second.posts)).toEqual(ids(rank(posts, communityOf, scorer, NOW)).slice(2, 4));
  });
});
