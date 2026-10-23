import { z } from 'zod';
import { Timestamp } from '@team-impact/contracts';
import type { MockCommunity, MockPost } from './fixtures';

/**
 * Feed order and paging (PRD §5, P6), kept apart from `MockWorld` so ranking can change without
 * touching who sees what. Visibility is decided before anything reaches here.
 */

/**
 * Scores order the feed (higher first). There are no hard tiers: "your team first" comes from the
 * team's community weight, so a fresh post elsewhere can overtake a stale team post (PRD §5 puts
 * community weight inside the ranking formula). `asOf` is when the run of pages was first asked
 * for, so time-based scores match on every page.
 */
export type Scorer = (p: MockPost, c: MockCommunity, asOf: string) => number;

/** Plain newest first, every community alike: the score is the post's own time. A baseline. */
export const byRecency: Scorer = (p) => Date.parse(p.createdAt);

/** The pilot heuristic's knobs (PRD §5: recency decay × community weight × engagement). */
export interface HeuristicParams {
  /** A post's recency halves every this many hours. */
  halfLifeHours: number;
  /** How many rallies one comment is worth. */
  commentWeight: number;
  /** Keeps a very popular post from dwarfing the rest: `log` is ln(1 + x), `sqrt` is √x. */
  damping: 'log' | 'sqrt';
  /** Per kind of community, 1 when left out. This is what puts the reader's team first. */
  communityWeight?: Partial<Record<MockCommunity['kind'], number>>;
  /** Extra weight for private communities, 1 when left out. */
  privateWeight?: number;
}

const HOUR = 3_600_000;

/**
 * recency × community weight × engagement, where recency = 0.5^(age / half-life) and engagement =
 * 1 + damp(rallies + commentWeight × comments). Engagement starts at 1, so a quiet new post still
 * scores. A post newer than `asOf` (made after the first page) counts as age 0.
 */
export const heuristic =
  (params: HeuristicParams, commentsOf: (postId: string) => number): Scorer =>
  (p, c, asOf) => {
    const ageHours = Math.max(0, (Date.parse(asOf) - Date.parse(p.createdAt)) / HOUR);
    const recency = 0.5 ** (ageHours / params.halfLifeHours);
    const weight =
      (params.communityWeight?.[c.kind] ?? 1) *
      ('private' in c && c.private ? (params.privateWeight ?? 1) : 1);
    const activity = p.likeCount + params.commentWeight * commentsOf(p.id);
    const damped = params.damping === 'log' ? Math.log1p(activity) : Math.sqrt(activity);
    return recency * weight * (1 + damped);
  };

/**
 * The pilot's ranking until it's tuned on seeded data (`pnpm --filter @team-impact/api feed:tune`):
 * team 4, other communities 1.5, Team Impact 1, so a quiet team post stays above an equally quiet
 * post elsewhere for halfLife × log₂(4 / 1.5) ≈ 34 hours. Provisional; the chosen values go in
 * Notion "Stack decisions".
 */
export const PILOT_RANKING: HeuristicParams = {
  halfLifeHours: 24,
  commentWeight: 2,
  damping: 'log',
  communityWeight: { team: 4, interest: 1.5, medical: 1.5, team_impact: 1 },
};

/** Where a post sits in feed order. Ids are unique, so no two posts share a key. */
const SortKey = z.object({
  score: z.number(),
  id: z.string().min(1),
});
type SortKey = z.infer<typeof SortKey>;

type CommunityOf = (p: MockPost) => MockCommunity;

/** Plain string order: fixed-width ids sort correctly without a locale. */
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Negative when `a` comes first: the higher score, then (a tie) the higher id. */
const compare = (a: SortKey, b: SortKey) => b.score - a.score || byString(b.id, a.id);

/** Each post with its key, in feed order. Scores are worked out once per post. */
const keyed = (posts: MockPost[], communityOf: CommunityOf, scorer: Scorer, asOf: string) =>
  posts
    .map((p) => {
      const c = communityOf(p);
      return { p, key: { score: scorer(p, c, asOf), id: p.id } };
    })
    .sort((a, b) => compare(a.key, b.key));

/** Posts in feed order, scored as of `asOf`. A total order, so a cursor knows where it stopped. */
export const rank = (
  posts: MockPost[],
  communityOf: CommunityOf,
  scorer: Scorer = byRecency,
  asOf = new Date().toISOString(),
): MockPost[] => keyed(posts, communityOf, scorer, asOf).map(({ p }) => p);

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
 * One page of `posts` (visible to the reader, any order): the posts strictly after the cursor's
 * last one, in feed order. The cursor is read first, so every page is scored as of the first
 * page's time. It goes by key, not position, so posts added or removed between pages never cause
 * a repeat or a gap. Returns null for a cursor that's invalid or from another feed (400).
 *
 * The mock has every post in memory, so it scores and sorts them all; the real query filters on
 * the key instead (`WHERE (score, id) < …`) and fetches `limit + 1`.
 */
export const pageOf = (
  posts: MockPost[],
  communityOf: CommunityOf,
  { feed, cursor, limit, now }: FeedPageRequest,
  scorer: Scorer = byRecency,
): FeedPage | null => {
  let c: Cursor | null = null;
  if (cursor !== undefined) {
    c = decodeCursor(cursor);
    if (!c || c.feed !== feed) return null;
  }
  const asOf = c?.asOf ?? now;
  const ranked = keyed(posts, communityOf, scorer, asOf);
  let start = c ? ranked.findIndex(({ key }) => compare(key, c.after) > 0) : 0;
  if (start === -1) start = ranked.length;
  const page = ranked.slice(start, start + limit);
  const last = page.at(-1);
  const more = start + limit < ranked.length;
  return {
    posts: page.map(({ p }) => p),
    asOf,
    nextCursor: more && last ? encodeCursor({ v: 1, feed, asOf, after: last.key }) : null,
  };
};
