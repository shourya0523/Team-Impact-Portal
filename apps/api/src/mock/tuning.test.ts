import { describe, expect, it } from 'vitest';
import { canCommentIn, canPostIn } from '@team-impact/contracts';
import { USERS } from './fixtures';
import { TEAM_LULL_DAYS, TUNING, TUNING_NOW, tuningWorld } from './tuning';

/** The tuning world's own posts (the fixtures' are checked elsewhere). */
const generated = (w: ReturnType<typeof tuningWorld>) =>
  w.posts.filter((p) => p.id >= TUNING.VIRAL);
const hoursOld = (createdAt: string) =>
  (Date.parse(TUNING_NOW) - Date.parse(createdAt)) / 3_600_000;

describe('tuning world', () => {
  it('builds the same world every time', () => {
    const [a, b] = [tuningWorld(), tuningWorld()];
    expect(a.posts).toEqual(b.posts);
    expect(a.comments).toEqual(b.comments);
  });

  it('only has posts and comments the rules would accept', () => {
    const w = tuningWorld();
    for (const p of generated(w)) {
      const c = w.communities.find((x) => x.id === p.communityId)!;
      const author = w.user(p.authorId)!;
      if (p.kind === 'opportunity') {
        // Recruiters post openings into official communities only (P1).
        expect(author.role).toBe('recruiter');
        expect(c.kind === 'interest' && c.official).toBe(true);
      } else {
        expect(canPostIn(author.role, w.community(c, author)), p.text).toBe(true);
      }
      expect(w.teenOutsideTeam(author.id, c), p.text).toBe(false);
      for (const k of w.comments.filter((x) => x.postId === p.id)) {
        const commenter = w.user(k.authorId)!;
        expect(canCommentIn(commenter.role, c.kind)).toBe(true);
        expect(w.readsCommunity(c, commenter)).toBe(true);
      }
    }
  });

  it('has about a hundred posts with a long tail of rallies', () => {
    const posts = generated(tuningWorld());
    expect(posts.length).toBeGreaterThanOrEqual(90);
    const quiet = posts.filter((p) => p.likeCount <= 3).length;
    expect(quiet / posts.length).toBeGreaterThan(0.6);
    expect(posts.filter((p) => p.likeCount >= 30).length).toBeGreaterThanOrEqual(3);
  });

  it('places every stress case as described', () => {
    const w = tuningWorld();
    const post = (id: string) => w.posts.find((p) => p.id === id)!;
    expect(post(TUNING.VIRAL)).toMatchObject({ likeCount: 80 });
    expect(hoursOld(post(TUNING.VIRAL).createdAt)).toBe(120);
    expect(post(TUNING.QUIET)).toMatchObject({ likeCount: 0 });
    expect(hoursOld(post(TUNING.QUIET).createdAt)).toBe(2);
    expect(TUNING.GAME_DAY.map((id) => post(id).communityId)).toEqual(
      TUNING.GAME_DAY.map(() => post(TUNING.GAME_DAY[0]!).communityId),
    );
    expect(TUNING.ANNOUNCEMENT_DAY.map((id) => post(id).kind)).toEqual(
      TUNING.ANNOUNCEMENT_DAY.map(() => 'announcement'),
    );
    const basketball = w.posts.filter((p) => p.communityId === TUNING.BASKETBALL);
    expect(basketball.length).toBeGreaterThan(0);
    for (const p of basketball) {
      expect(hoursOld(p.createdAt)).toBeGreaterThanOrEqual(TEAM_LULL_DAYS * 24);
    }
  });

  it('gives every persona enough posts for paging and ranking to matter', () => {
    const w = tuningWorld();
    for (const u of [USERS.jordan, USERS.lisa, USERS.noah, USERS.coach, USERS.elena]) {
      expect(w.feed(u).length, u.firstName).toBeGreaterThanOrEqual(40);
    }
    // Lisa is on both teams, and sees the basketball lull.
    expect(w.feed(USERS.lisa).some((p) => p.community.id === TUNING.BASKETBALL)).toBe(true);
  });

  it('keeps held and removed posts out, and the quiet private post to its members', () => {
    const w = tuningWorld();
    const hidden = generated(w).filter((p) => p.moderation !== 'approved');
    expect(hidden.length).toBeGreaterThan(0);
    const jordan = new Set(w.feed(USERS.jordan).map((p) => p.id));
    for (const p of hidden) expect(jordan.has(p.id)).toBe(false);
    expect(jordan.has(TUNING.QUIET)).toBe(true);
    expect(w.feed(USERS.noah).some((p) => p.id === TUNING.QUIET)).toBe(false);
  });

  it('pages through the heuristic feed exactly, for every persona', () => {
    const w = tuningWorld();
    w.ranking = { halfLifeHours: 24, commentWeight: 2, damping: 'log' };
    for (const u of [USERS.jordan, USERS.lisa, USERS.noah, USERS.coach, USERS.elena]) {
      const all = w.feed(u, TUNING_NOW);
      const seen: string[] = [];
      let cursor: string | undefined;
      for (let pages = 1; ; pages++) {
        const page = w.feedPage(u, { cursor, limit: 7, now: TUNING_NOW })!;
        seen.push(...page.items.map((p) => p.id));
        if (!page.nextCursor) break;
        if (pages > all.length + 1) throw new Error('paging never ended');
        cursor = page.nextCursor;
      }
      expect(seen, u.firstName).toEqual(all.map((p) => p.id));
    }
  });

  it('feeds the formula real comment counts', () => {
    const w = tuningWorld();
    const order = (commentWeight: number) => {
      w.ranking = { halfLifeHours: 24, commentWeight, damping: 'log' };
      return w.feed(USERS.jordan, TUNING_NOW).map((p) => p.id);
    };
    expect(order(50)).not.toEqual(order(0));
  });
});
