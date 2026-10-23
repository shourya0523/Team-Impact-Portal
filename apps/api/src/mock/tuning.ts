import type { MockComment } from './activity';
import {
  COMMUNITIES,
  id,
  type MockCommunity,
  type MockPost,
  type MockUser,
  USERS,
} from './fixtures';
import { MockWorld } from './world';

/**
 * A bigger, realistic world for tuning feed ranking (PRD §5, "tuned on seeded data"). Only the
 * tuning script and its tests use it; the app and the normal fixtures never see it.
 *
 * Seeded, so every run builds the same posts and formulas can be compared run to run. Authors are
 * always people the rules let post there, so visibility behaves exactly as in the app.
 */

/** The time "now" is in the tuning world, so ages read the same on every run. */
export const TUNING_NOW = '2026-10-20T12:00:00.000Z';

/** Hand-placed posts the tuning checks look for. */
export const TUNING = {
  /** First Gen, 5 days old, 80 rallies: does a popular old post stay on top too long? */
  VIRAL: id(70001),
  /** Captains (private), 2 hours old, no rallies: does a quiet community's new post surface? */
  QUIET: id(70002),
  /** Six soccer posts within 3 hours, two days ago: does one burst crowd out the rest? */
  GAME_DAY: [70010, 70011, 70012, 70013, 70014, 70015].map(id),
  /** Four Team Impact posts within 2 hours, a day ago. */
  ANNOUNCEMENT_DAY: [70020, 70021, 70022, 70023].map(id),
  /** Basketball: a team community with nothing newer than 4 days (`TEAM_LULL_DAYS`). */
  BASKETBALL: id(309),
};
export const TEAM_LULL_DAYS = 4;

const community = (n: number) => COMMUNITIES.find((c) => c.id === id(n))!;
const SOCCER = community(301);
const TEAM_IMPACT = community(302);
const MEDICAL = community(303);
const FIRST_GEN = community(304);
const FINANCE = community(305);
const CAPTAINS = community(307);

/** Basketball (live, no community in the fixtures) gets one; the coach and Lisa are on it. */
const BASKETBALL: MockCommunity = {
  id: TUNING.BASKETBALL,
  kind: 'team',
  teamId: id(210),
  name: "Tufts Women's Basketball",
  about: 'The team, its families and coaches.',
  moderation: 'approved',
  createdAt: '2026-09-01T12:00:00.000Z',
  members: [],
};

/**
 * Who writes posts in each community: members the rules let post there (no parents or recruiters,
 * teens only in their own team), and roughly how many posts each community gets.
 */
const PLAN: { c: MockCommunity; authors: MockUser[]; count: number; text: string[] }[] = [
  {
    c: SOCCER,
    authors: [USERS.coach, USERS.jordan, USERS.sam, USERS.riley, USERS.ava, USERS.noah],
    count: 19,
    text: ['Practice recap', 'Film session notes', 'Bus leaves at 7', 'Recovery day plan'],
  },
  {
    c: TEAM_IMPACT,
    authors: [USERS.staff, USERS.coach, USERS.jordan, USERS.priya, USERS.chris],
    count: 16,
    text: ['Network news', 'Volunteer call', 'Alumni spotlight', 'Family event recap'],
  },
  {
    c: FIRST_GEN,
    authors: [USERS.jordan, USERS.sam, USERS.priya, USERS.coach],
    count: 22,
    text: ['FAFSA tips', 'Study group tonight', 'Internship advice', 'Scholarship deadline'],
  },
  {
    c: FINANCE,
    authors: [USERS.priya, USERS.riley, USERS.sam],
    count: 10,
    text: ['Mock interview swap', 'Superday prep', 'Recruiting timeline', 'Networking tips'],
  },
  {
    c: CAPTAINS,
    authors: [USERS.coach, USERS.jordan],
    count: 7,
    text: ['Captains agenda', 'Lineup ideas', 'Team dinner plan', 'Leadership reading'],
  },
  {
    c: MEDICAL,
    authors: [USERS.jordan],
    count: 6,
    text: ['Hospital visit', 'Fundraiser update', 'Thinking of you all', 'Meal train signup'],
  },
];

/** mulberry32: a tiny seeded generator, so "random" posts are the same every run. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const tuningWorld = (now = TUNING_NOW, seed = 20261020): MockWorld => {
  const w = new MockWorld({ identitySearch: true, medicalCommunities: true });
  const random = seeded(seed);
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]!;
  const hoursAgo = (hours: number) =>
    new Date(Date.parse(now) - Math.round(hours * 3_600_000)).toISOString();

  w.communities.push(BASKETBALL);
  for (const u of [USERS.coach, USERS.lisa]) {
    w.teamMembers.push({
      teamId: id(210),
      userId: u.id,
      joinedVia: 'join_request',
      joinedAt: '2026-09-02T12:00:00.000Z',
    });
  }

  /** Mostly recent: 70% within 3 days, 20% within a week, the rest up to 3 weeks. */
  const age = () => {
    const r = random();
    if (r < 0.7) return 0.25 + random() * 72;
    if (r < 0.9) return 72 + random() * 96;
    return 168 + random() * 336;
  };
  /** Long-tailed: most posts get 0 to 3 rallies, a few get dozens (capped at 60). */
  const rallies = () => Math.min(60, Math.floor(1 / Math.pow(1 - random(), 0.9)) - 1);

  let nextPost = 70100;
  let nextComment = 80000;
  const comments: MockComment[] = [];

  /** Approved comments by members who may comment there (never recruiters; teens only in team). */
  const commentOn = (p: MockPost, c: MockCommunity, n: number) => {
    const readers = w.users.filter(
      (u) =>
        u.role !== 'recruiter' &&
        (u.role !== 'teen' || c.kind === 'team') &&
        w.readsCommunity(c, u) &&
        !w.teenOutsideTeam(u.id, c),
    );
    for (let i = 0; i < n; i++) {
      const author = pick(readers);
      comments.push({
        id: id(nextComment++),
        postId: p.id,
        authorId: author.id,
        text: 'Love this!',
        moderation: 'approved',
        createdAt: p.createdAt,
      });
    }
  };

  const add = (
    c: MockCommunity,
    author: MockUser,
    text: string,
    hours: number,
    likeCount: number,
    commentCount: number,
    extra: Partial<MockPost> = {},
  ) => {
    const p: MockPost = {
      id: id(nextPost++),
      kind: author.role === 'staff' && c.kind === 'team_impact' ? 'announcement' : 'post',
      authorId: author.id,
      communityId: c.id,
      text,
      official: author.role === 'staff',
      likeCount,
      commentCount,
      moderation: 'approved',
      createdAt: hoursAgo(hours),
      ...extra,
    };
    w.posts.push(p);
    commentOn(p, c, commentCount);
    return p;
  };

  // The everyday mix.
  for (const { c, authors, count, text } of PLAN) {
    for (let i = 0; i < count; i++) {
      const likes = rallies();
      add(
        c,
        pick(authors),
        `${pick(text)} (${c.name})`,
        age(),
        likes,
        Math.round(likes * 0.3 * random()),
      );
    }
  }

  // Hand-placed cases.
  add(FIRST_GEN, USERS.sam, 'My internship story, start to finish', 5 * 24, 80, 25, {
    id: TUNING.VIRAL,
  });
  add(CAPTAINS, USERS.coach, 'Quick one: captains meet at 6 tomorrow', 2, 0, 0, {
    id: TUNING.QUIET,
  });
  TUNING.GAME_DAY.forEach((postId, i) =>
    add(SOCCER, pick(PLAN[0]!.authors), `Game day! Update ${i + 1}`, 48 + i * 0.5, 8 + i * 3, 4, {
      id: postId,
    }),
  );
  TUNING.ANNOUNCEMENT_DAY.forEach((postId, i) =>
    add(TEAM_IMPACT, USERS.staff, `Announcement ${i + 1}: gala details`, 24 + i * 0.5, 20, 2, {
      id: postId,
    }),
  );
  for (let i = 0; i < 5; i++) {
    add(
      BASKETBALL,
      USERS.coach,
      `Basketball practice notes ${i + 1}`,
      (TEAM_LULL_DAYS + i) * 24,
      3,
      1,
    );
  }
  // Two openings from the recruiter, into the official community (P1).
  for (const hours of [6, 60]) {
    add(FIRST_GEN, USERS.elena, 'Northbeam summer analyst openings', hours, 5, 0, {
      kind: 'opportunity',
      opportunity: {
        title: 'Summer Analyst',
        link: 'https://northbeam.com/jobs/123',
        closesOn: '2026-11-30',
        company: { id: id(801), name: 'Northbeam Capital' },
      },
    });
  }
  // A few the filters must keep out: still held, or taken down.
  for (const moderation of ['in_review', 'in_review', 'removed', 'removed'] as const) {
    add(FIRST_GEN, USERS.priya, 'Not visible to the feed', 1, 0, 0, { moderation });
  }

  w.comments.push(...comments);
  return w;
};
