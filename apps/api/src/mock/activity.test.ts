import { afterEach, describe, expect, it, vi } from 'vitest';
import { type FeatureFlags, NOTIFICATION_KINDS, type Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import {
  announce,
  canReceive,
  commentsFor,
  DEFAULT_PREFS,
  DISCREET_PUSH_TEXT,
  notify,
  notifyJoinApproved,
} from './activity';
import { id, USERS } from './fixtures';
import { suspend, warn } from './staff-tools';
import { removeMember } from './team';
import { MockWorld } from './world';

const TEAM = id(301);
const TEAM_IMPACT = id(302);
const MEDICAL = id(303);
const FIRST_GEN = id(304); // official interest; Jordan made it, Priya opted in to recruiter search
const FINANCE = id(305); // open interest, Priya made it
const CAPTAINS = id(307); // private interest, the coach made it
const COACH_POST = id(401); // approved, in the team community
const SAM_POST = id(403); // approved, in First Gen
const FAMILY_NIGHT = id(502); // approved, Team Impact's

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** One mock API; `as(role)` signs a fixture user in, so several people can act on the same world. */
const world = async (flags?: FeatureFlags) => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true, flags });
  close = () => app.close();
  const as = async (role: Role) => {
    const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: { role } });
    expect(res.statusCode).toBe(200);
    const cookie = res.cookies[0]!;
    const call = async (method: Method, url: string, payload?: object) => {
      const r = await app.inject({
        method,
        url,
        ...(payload ? { payload } : {}),
        cookies: { [cookie.name]: cookie.value },
      });
      return { status: r.statusCode, body: r.json(), text: r.body };
    };
    return {
      get: (url: string) => call('GET', url),
      post: (url: string, payload: object = {}) => call('POST', url, payload),
      put: (url: string, payload: object) => call('PUT', url, payload),
      del: (url: string) => call('DELETE', url),
    };
  };
  return { as };
};

type Client = Awaited<ReturnType<Awaited<ReturnType<typeof world>>['as']>>;

const ids = (items: { id: string }[]) => items.map((i) => i.id);

const SOCCER = id(201);

/** Basketball (live, with no community in the fixtures) gets one, with the coach and Lisa on it. */
const addBasketball = (w: MockWorld) => {
  const basketball = {
    id: id(309),
    kind: 'team' as const,
    teamId: id(210),
    name: "Tufts Women's Basketball",
    about: 'The team, its families and coaches.',
    moderation: 'approved' as const,
    createdAt: '2026-10-01T12:00:00.000Z',
    members: [],
  };
  w.communities.push(basketball);
  for (const u of [USERS.coach, USERS.lisa]) {
    w.teamMembers.push({
      teamId: basketball.teamId,
      userId: u.id,
      joinedVia: 'join_request',
      joinedAt: '2026-10-02T12:00:00.000Z',
    });
  }
  return basketball;
};

/** Staff keep (approve) whatever ticket holds `targetId`. */
const approve = async (staff: Client, targetId: string) => {
  const tickets = await staff.get('/staff/moderation/tickets');
  const ticket = tickets.body.find(
    (t: { target: { id: string }; status: string }) =>
      t.target.id === targetId && t.status === 'open',
  );
  expect(ticket, 'held for review').toBeTruthy();
  expect(ticket.reportCount).toBe(0);
  const res = await staff.post(`/staff/moderation/tickets/${ticket.id}/resolve`, {
    resolution: 'dismiss',
  });
  expect(res.status).toBe(200);
};

describe('posts: held for moderation (P5)', () => {
  it('keeps a new post out of every feed until staff approve it', async () => {
    const { as } = await world();
    const athlete = await as('athlete');
    const coach = await as('coach');
    const created = await athlete.post(`/communities/${TEAM}/posts`, { text: 'Lift at 6?' });
    expect(created.status).toBe(201);
    expect(created.body.moderation).toBe('in_review');

    // The author sees it, marked as waiting; nobody else does.
    expect(ids((await athlete.get('/feed')).body.items)).toContain(created.body.id);
    expect(ids((await coach.get('/feed')).body.items)).not.toContain(created.body.id);
    expect(ids((await coach.get(`/communities/${TEAM}/posts`)).body.items)).not.toContain(
      created.body.id,
    );
    expect((await coach.get(`/posts/${created.body.id}`)).status).toBe(404);

    await approve(await as('staff'), created.body.id);
    expect(ids((await coach.get('/feed')).body.items)).toContain(created.body.id);
  });

  it('removes a post for its author too when staff take it down', async () => {
    const { as } = await world();
    const athlete = await as('athlete');
    const staff = await as('staff');
    const created = await athlete.post(`/communities/${TEAM}/posts`, { text: 'Hello' });
    const tickets = (await staff.get('/staff/moderation/tickets')).body;
    const ticket = tickets.find((t: { target: { id: string } }) => t.target.id === created.body.id);
    await staff.post(`/staff/moderation/tickets/${ticket.id}/resolve`, { resolution: 'remove' });
    expect(ids((await athlete.get('/feed')).body.items)).not.toContain(created.body.id);
  });

  it('never lets a recruiter or a parent post', async () => {
    const { as } = await world();
    const recruiter = await as('recruiter');
    expect((await recruiter.post(`/communities/${FIRST_GEN}/posts`, { text: 'Hi' })).status).toBe(
      403,
    );
    expect((await recruiter.post(`/communities/${TEAM_IMPACT}/posts`, { text: 'Hi' })).status).toBe(
      403,
    );
    const parent = await as('parent');
    expect((await parent.post(`/communities/${TEAM}/posts`, { text: 'Hi' })).status).toBe(403);
  });

  it('lets a teen post only in their team community', async () => {
    const { as } = await world();
    const teen = await as('teen');
    expect((await teen.post(`/communities/${TEAM}/posts`, { text: 'Go Jumbos' })).status).toBe(201);
    expect((await teen.post(`/communities/${FIRST_GEN}/posts`, { text: 'Hi' })).status).toBe(403);
    expect((await teen.post(`/communities/${TEAM_IMPACT}/posts`, { text: 'Hi' })).status).toBe(403);
    // Teens never see medical communities, so it's not even there to post in.
    expect((await teen.post(`/communities/${MEDICAL}/posts`, { text: 'Hi' })).status).toBe(404);
  });

  it('needs membership: no posting into a private community from outside', async () => {
    const { as } = await world();
    const jordan = await as('athlete'); // in Captains, not in Finance
    expect((await jordan.post(`/communities/${FINANCE}/posts`, { text: 'Hi' })).status).toBe(403);
    expect((await jordan.post(`/communities/${CAPTAINS}/posts`, { text: 'Hi' })).status).toBe(201);
  });

  it('makes staff posts in Team Impact announcements, and notifies everyone at once', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const teen = await as('teen');
    const created = await staff.post(`/communities/${TEAM_IMPACT}/posts`, {
      text: 'Applications for spring draft day are open.',
    });
    expect(created.body.kind).toBe('announcement');
    expect(created.body.official).toBe(true);
    expect(created.body.moderation).toBe('approved');
    const note = (await teen.get('/notifications')).body;
    expect(note.unreadCount).toBe(1);
    expect(note.items[0]).toMatchObject({ kind: 'announcement', actor: null });
    const recruiter = await as('recruiter');
    expect((await recruiter.get('/notifications')).body.unreadCount).toBe(1);
  });

  it('keeps an image link on the post', async () => {
    const { as } = await world();
    const coach = await as('coach');
    const url = 'https://cdn.example.org/team.jpg';
    const created = await coach.post(`/communities/${TEAM}/posts`, { text: 'Team', imageUrl: url });
    expect(created.body.imageUrl).toBe(url);
    const bad = await coach.post(`/communities/${TEAM}/posts`, {
      text: 'x',
      imageUrl: 'javascript:alert(1)',
    });
    expect(bad.status).toBe(400);
  });
});

describe('staff: published at once, no review queue', () => {
  const READERS: Role[] = [
    'coach',
    'athlete',
    'parent',
    'teen',
    'recruiter',
    'alumni_athlete',
    'alumni_mentor',
  ];
  const openTickets = async (staff: Client, targetId: string) =>
    (await staff.get('/staff/moderation/tickets')).body.filter(
      (t: { target: { id: string }; status: string }) =>
        t.target.id === targetId && t.status === 'open',
    );

  it('puts a portal announcement in every role’s feed and notifications', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const res = await staff.post('/staff/announcements', {
      text: 'Draft day applications are open.',
      sendPush: false,
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      kind: 'announcement',
      official: true,
      moderation: 'approved',
    });
    expect(await openTickets(staff, res.body.id)).toEqual([]);
    for (const role of READERS) {
      const reader = await as(role);
      expect(ids((await reader.get('/feed')).body.items), role).toContain(res.body.id);
      const notes = (await reader.get('/notifications')).body.items;
      expect(notes[0], role).toMatchObject({
        kind: 'announcement',
        actor: null,
        target: { kind: 'post', id: res.body.id },
      });
    }
    // The author isn't told about their own announcement.
    expect((await staff.get('/notifications')).body.items).toEqual([]);
  });

  it('publishes a staff post outside Team Impact as a plain post', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const athlete = await as('athlete');
    expect((await staff.post(`/communities/${FINANCE}/join`)).status).toBe(200);
    expect((await athlete.post(`/communities/${FINANCE}/join`)).status).toBe(200);
    const created = await staff.post(`/communities/${FINANCE}/posts`, { text: 'Resume clinic' });
    expect(created.body).toMatchObject({ kind: 'post', official: true, moderation: 'approved' });
    expect(await openTickets(staff, created.body.id)).toEqual([]);
    expect(ids((await athlete.get(`/communities/${FINANCE}/posts`)).body.items)).toContain(
      created.body.id,
    );
  });

  it('publishes a staff event and notifies the community', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const parent = await as('parent');
    const created = await staff.post(`/communities/${TEAM_IMPACT}/events`, {
      title: 'Gala',
      startsAt: '2026-12-05T23:00:00.000Z',
      location: 'Boston',
    });
    expect(created.status).toBe(201);
    expect(created.body.moderation).toBe('approved');
    expect(await openTickets(staff, created.body.id)).toEqual([]);
    expect(ids((await parent.get('/events')).body)).toContain(created.body.id);
    const notes = (await parent.get('/notifications')).body.items;
    expect(notes[0]).toMatchObject({ kind: 'event', target: { id: created.body.id } });
  });

  /** A world where Jordan has one phone. */
  const withPhone = () => {
    const w = new MockWorld({ identitySearch: true, medicalCommunities: true });
    w.devices.push({
      userId: USERS.jordan.id,
      token: 'jordan-phone',
      platform: 'ios',
      createdAt: new Date().toISOString(),
    });
    return w;
  };
  const teamImpact = (w: MockWorld) => w.communities.find((c) => c.id === TEAM_IMPACT)!;
  const toJordan = (w: MockWorld) => w.notifications.filter((n) => n.userId === USERS.jordan.id);

  it('pushes an announcement only when staff leave push on', () => {
    const on = withPhone();
    announce(on, USERS.staff, teamImpact(on), { text: 'Gala tickets' }, { push: true });
    expect(on.pushOutbox.map((p) => p.token)).toEqual(['jordan-phone']);

    const off = withPhone();
    announce(off, USERS.staff, teamImpact(off), { text: 'Gala tickets' }, { push: false });
    expect(toJordan(off)).toHaveLength(1);
    expect(off.pushOutbox).toEqual([]);
  });

  it('sends neither when the reader turned announcements off', () => {
    const w = withPhone();
    w.notificationPrefs.set(USERS.jordan.id, { ...DEFAULT_PREFS, announcements: false });
    announce(w, USERS.staff, teamImpact(w), { text: 'Gala tickets' }, { push: true });
    expect(toJordan(w)).toEqual([]);
    expect(w.pushOutbox).toEqual([]);
  });
});

describe('feeds: what recruiters read', () => {
  it('shows official communities’ posts in both feeds, and no other interest community’s', async () => {
    const { as } = await world();
    const priya = await as('alumni_athlete');
    const created = await priya.post(`/communities/${FINANCE}/posts`, { text: 'Mock interviews?' });
    expect(created.status).toBe(201);
    await approve(await as('staff'), created.body.id);
    // Members see it, so its absence below is the recruiter rule, not moderation.
    expect(ids((await priya.get('/feed')).body.items)).toContain(created.body.id);

    const recruiter = await as('recruiter');
    const feed = (await recruiter.get('/feed')).body.items as {
      id: string;
      community: { id: string };
    }[];
    expect(ids(feed)).toContain(SAM_POST);
    expect(ids(feed)).not.toContain(created.body.id);
    for (const p of feed) expect([TEAM_IMPACT, FIRST_GEN]).toContain(p.community.id);

    expect(ids((await recruiter.get(`/communities/${FIRST_GEN}/posts`)).body.items)).toContain(
      SAM_POST,
    );
    expect((await recruiter.get(`/communities/${FINANCE}/posts`)).status).toBe(404);
  });
});

describe('teens: only ever seen in their team community', () => {
  const TEEN_POST = id(490);
  const TEEN_COMMENT = id(1390);
  const TEEN_TEAM_COMMENT = id(1391);

  /**
   * Noah (a teen, and a First Gen member) has a post and a comment in First Gen, which the API
   * would never accept, plus a comment in his team. Built on the world directly for that reason.
   */
  const slippedIn = () => {
    const w = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const samPost = w.posts.find((p) => p.id === SAM_POST)!;
    w.posts.push({ ...samPost, id: TEEN_POST, authorId: USERS.noah.id });
    const comment = (commentId: string, postId: string) => ({
      id: commentId,
      postId,
      authorId: USERS.noah.id,
      text: 'Me too!',
      moderation: 'approved' as const,
      createdAt: new Date().toISOString(),
    });
    w.comments.push(comment(TEEN_COMMENT, SAM_POST), comment(TEEN_TEAM_COMMENT, COACH_POST));
    return w;
  };

  it('keeps a teen’s post outside their team out of every feed, for every reader', () => {
    const w = slippedIn();
    const firstGen = w.communities.find((c) => c.id === FIRST_GEN)!;
    for (const u of [USERS.jordan, USERS.staff, USERS.noah]) {
      expect(ids(w.feed(u)), u.firstName).not.toContain(TEEN_POST);
      expect(ids(w.communityFeed(firstGen, u)), u.firstName).not.toContain(TEEN_POST);
    }
    // His team post still reaches the team.
    expect(ids(w.feed(USERS.jordan))).toContain(id(406));
  });

  it('keeps a teen’s comment outside their team hidden and uncounted', () => {
    const w = slippedIn();
    for (const u of [USERS.jordan, USERS.staff, USERS.noah]) {
      expect(ids(commentsFor(w, SAM_POST, u)), u.firstName).not.toContain(TEEN_COMMENT);
    }
    // Only Priya's comment counts.
    expect(w.feed(USERS.jordan).find((p) => p.id === SAM_POST)!.commentCount).toBe(1);
    // His comment in the team community still shows.
    expect(ids(commentsFor(w, COACH_POST, USERS.jordan))).toContain(TEEN_TEAM_COMMENT);
  });

  it('keeps a teen’s post out of another team’s community', () => {
    const w = slippedIn();
    const basketball = addBasketball(w);
    const samPost = w.posts.find((p) => p.id === SAM_POST)!;
    w.posts.push({ ...samPost, id: id(493), authorId: USERS.noah.id, communityId: basketball.id });
    // The coach is on both teams, so reads the basketball community.
    expect(ids(w.communityFeed(basketball, USERS.coach))).not.toContain(id(493));
    expect(ids(w.feed(USERS.coach))).not.toContain(id(493));
    expect(ids(w.communityFeed(basketball, USERS.staff))).not.toContain(id(493));
  });

  it('hides a teen’s team posts and comments once a coach removes them', () => {
    const w = slippedIn();
    expect('error' in removeMember(w, SOCCER, USERS.noah.id)).toBe(false);
    expect(ids(w.feed(USERS.jordan))).not.toContain(id(406));
    expect(ids(commentsFor(w, COACH_POST, USERS.jordan))).not.toContain(TEEN_TEAM_COMMENT);
  });
});

describe('feeds: pages', () => {
  type Page = { items: { id: string }[]; nextCursor: string | null } | null;

  /**
   * Every page in turn, `limit` at a time, joined back together. `expected` is the whole feed: a
   * walk never needs more pages than it has posts (plus one), so a cursor that doesn't move on
   * fails instead of looping forever.
   */
  const walk = (next: (cursor?: string) => Page, limit: number, expected: unknown[]) => {
    const items: { id: string }[] = [];
    let cursor: string | undefined;
    for (let pages = 1; ; pages++) {
      const page = next(cursor);
      expect(page, 'a cursor we issued').not.toBeNull();
      expect(page!.items.length).toBeLessThanOrEqual(limit);
      items.push(...page!.items);
      if (!page!.nextCursor) return items;
      cursor = page!.nextCursor;
      if (pages > expected.length + 1) throw new Error('paging never ended');
    }
  };

  it('pages through every home and community feed to exactly the full feed', () => {
    const w = new MockWorld({ identitySearch: true, medicalCommunities: true });
    // A rally and comment on posts that land past the first page, so their counts come from
    // the page they're on.
    w.rallies.push({ postId: id(402), userId: USERS.jordan.id });
    const comment = w.comments.find((k) => k.postId === id(405))!;
    w.comments.push({ ...comment, id: id(1399) });

    for (const u of w.users) {
      const all = w.feed(u);
      const home = walk((cursor) => w.feedPage(u, { cursor, limit: 2 }), 2, all);
      expect(home, u.firstName).toEqual(all);
      for (const c of w.communities) {
        const inC = w.communityFeed(c, u);
        const own = walk((cursor) => w.communityFeedPage(c, u, { cursor, limit: 2 }), 2, inC);
        expect(own, `${u.firstName} in ${c.name}`).toEqual(inC);
      }
    }
    const jordan = walk(
      (cursor) => w.feedPage(USERS.jordan, { cursor, limit: 2 }),
      2,
      w.feed(USERS.jordan),
    );
    expect(jordan.find((p) => p.id === id(402))).toMatchObject({ likedByMe: true });
    expect(jordan.find((p) => p.id === id(405))).toMatchObject({ commentCount: 2 });
  });

  it('refuses a cursor from another feed, even one the reader can’t see', () => {
    const w = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const home = w.feedPage(USERS.jordan, { limit: 1 })!;
    const team = w.communities.find((c) => c.id === TEAM)!;
    const medical = w.communities.find((c) => c.id === MEDICAL)!;
    expect(
      w.communityFeedPage(team, USERS.jordan, { cursor: home.nextCursor!, limit: 1 }),
    ).toBeNull();
    // The coach doesn't read the medical community: an empty page, but a bad cursor is still bad.
    expect(w.communityFeedPage(medical, USERS.coach, { limit: 20 })).toEqual({
      items: [],
      nextCursor: null,
    });
    expect(w.communityFeedPage(medical, USERS.coach, { cursor: 'nope', limit: 20 })).toBeNull();
  });

  it('neither repeats nor skips when a post is approved between two pages', async () => {
    // New posts are stamped with the clock; fix it after the fixtures (Oct 8–12) so the new post
    // is the newest team post and lands at the very top.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-20T12:00:00.000Z') });
    try {
      const { as } = await world();
      const jordan = await as('athlete');
      const first = (await jordan.get('/feed?limit=2')).body;
      expect(ids(first.items)).toEqual([406, 401].map(id));

      const coach = await as('coach');
      const created = await coach.post(`/communities/${TEAM}/posts`, { text: 'Lift moved to 8.' });
      await approve(await as('staff'), created.body.id);

      // A position-based cursor would now return 401 again (everything moved down one).
      const q = new URLSearchParams({ limit: '2', cursor: first.nextCursor });
      expect(ids((await jordan.get(`/feed?${q}`)).body.items)).toEqual([402, 408].map(id));
      // Starting over shows it first: the second page left it out on purpose.
      expect(ids((await jordan.get('/feed?limit=2')).body.items)[0]).toBe(created.body.id);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('feeds: people on two teams', () => {
  it('weights both teams alike, and keeps each team page to its own', () => {
    const w = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const basketball = addBasketball(w);
    const samPost = w.posts.find((p) => p.id === SAM_POST)!;
    const at = (createdAt: string, n: number) => ({
      ...samPost,
      id: id(n),
      authorId: USERS.coach.id,
      communityId: basketball.id,
      createdAt,
    });
    // Newer than soccer's two Oct 12 posts, and older than both.
    w.posts.push(at('2026-10-12T15:00:00.000Z', 491), at('2026-10-10T12:00:00.000Z', 492));

    // Lisa, a parent on both teams: both teams weigh the same. 491 is 3 hours newer than soccer's
    // 401 and 406, which outweighs their one comment each at a 12-hour half-life; Team Impact's
    // 402 (48 rallies) comes before basketball's older 492, then medical.
    expect(ids(w.feed(USERS.lisa))).toEqual([491, 406, 401, 402, 492, 404].map(id));
    expect(ids(w.communityFeed(basketball, USERS.lisa))).toEqual([491, 492].map(id));
    const soccer = w.communities.find((c) => c.id === TEAM)!;
    expect(ids(w.communityFeed(soccer, USERS.lisa))).toEqual([406, 401].map(id));
    // Jordan is only on soccer.
    expect(ids(w.feed(USERS.jordan))).not.toContain(id(491));
  });
});

describe('comments', () => {
  it('holds a comment until approved, then counts it and tells the post author', async () => {
    const { as } = await world();
    const parent = await as('parent');
    const coach = await as('coach');
    const before = (await coach.get(`/posts/${COACH_POST}`)).body.commentCount;
    const created = await parent.post(`/posts/${COACH_POST}/comments`, { text: 'We’ll be there' });
    expect(created.status).toBe(201);
    expect(created.body.moderation).toBe('in_review');

    expect(ids((await parent.get(`/posts/${COACH_POST}/comments`)).body)).toContain(
      created.body.id,
    );
    expect(ids((await coach.get(`/posts/${COACH_POST}/comments`)).body)).not.toContain(
      created.body.id,
    );
    expect((await coach.get('/notifications')).body.items).toHaveLength(0);
    // Not counted while held, not even for its author.
    expect((await coach.get(`/posts/${COACH_POST}`)).body.commentCount).toBe(before);
    expect(
      (await parent.get('/feed')).body.items.find((p: { id: string }) => p.id === COACH_POST),
    ).toMatchObject({ commentCount: before });

    await approve(await as('staff'), created.body.id);
    expect(ids((await coach.get(`/posts/${COACH_POST}/comments`)).body)).toContain(created.body.id);
    expect((await coach.get(`/posts/${COACH_POST}`)).body.commentCount).toBe(before + 1);
    const notes = (await coach.get('/notifications')).body.items;
    expect(notes[0]).toMatchObject({ kind: 'reply', target: { kind: 'post', id: COACH_POST } });
  });

  it('keeps recruiters out, and teens inside their team', async () => {
    const { as } = await world();
    const recruiter = await as('recruiter');
    const post = (await recruiter.get(`/communities/${FIRST_GEN}/posts`)).body.items[0];
    expect((await recruiter.post(`/posts/${post.id}/comments`, { text: 'Hi' })).status).toBe(403);
    const teen = await as('teen');
    expect((await teen.post(`/posts/${COACH_POST}/comments`, { text: 'Yes!' })).status).toBe(201);
    expect((await teen.post(`/posts/${post.id}/comments`, { text: 'Hi' })).status).toBe(403);
  });

  it('respects notification switches', async () => {
    const { as } = await world();
    const coach = await as('coach');
    const me = await coach.put('/me/notification-prefs', { replies: false });
    expect(me.body.notificationPrefs.replies).toBe(false);
    const parent = await as('parent');
    const created = await parent.post(`/posts/${COACH_POST}/comments`, { text: 'Thanks coach' });
    await approve(await as('staff'), created.body.id);
    expect((await coach.get('/notifications')).body.items).toHaveLength(0);
  });
});

describe('rally', () => {
  it('counts once per person and can be taken back', async () => {
    const { as } = await world();
    const athlete = await as('athlete');
    const start = (await athlete.get(`/posts/${COACH_POST}`)).body.likeCount;
    const on = await athlete.post(`/posts/${COACH_POST}/rally`);
    expect(on.body).toMatchObject({ likeCount: start + 1, likedByMe: true });
    expect((await athlete.post(`/posts/${COACH_POST}/rally`)).body.likeCount).toBe(start + 1);
    const coach = await as('coach');
    expect((await coach.get(`/posts/${COACH_POST}`)).body.likedByMe).toBe(false);
    const off = await athlete.del(`/posts/${COACH_POST}/rally`);
    expect(off.body).toMatchObject({ likeCount: start, likedByMe: false });
  });

  it('can’t rally a post that is still held', async () => {
    const { as } = await world();
    const athlete = await as('athlete');
    const created = await athlete.post(`/communities/${TEAM}/posts`, { text: 'Hi' });
    expect((await athlete.post(`/posts/${created.body.id}/rally`)).status).toBe(409);
  });
});

describe('events', () => {
  const event = {
    title: 'Team dinner',
    startsAt: '2026-11-01T23:00:00.000Z',
    location: 'Dewick',
  };

  it('holds a new event until approved, then notifies the community', async () => {
    const { as } = await world();
    const coach = await as('coach');
    const parent = await as('parent');
    const created = await coach.post(`/communities/${TEAM}/events`, event);
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ moderation: 'in_review', myRsvp: 'going', goingCount: 1 });
    expect(ids((await coach.get('/events')).body)).toContain(created.body.id);
    expect(ids((await parent.get('/events')).body)).not.toContain(created.body.id);
    expect((await parent.get(`/events/${created.body.id}`)).status).toBe(404);
    expect((await parent.get('/notifications')).body.items).toHaveLength(0);

    await approve(await as('staff'), created.body.id);
    expect(ids((await parent.get('/events')).body)).toContain(created.body.id);
    const notes = (await parent.get('/notifications')).body.items;
    expect(notes[0]).toMatchObject({ kind: 'event', target: { id: created.body.id } });
  });

  it('keeps parents and teens from creating events', async () => {
    const { as } = await world();
    expect((await (await as('parent')).post(`/communities/${TEAM}/events`, event)).status).toBe(
      403,
    );
    expect((await (await as('teen')).post(`/communities/${TEAM}/events`, event)).status).toBe(403);
  });

  it('takes RSVPs and shows the list only to the organizer', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const parent = await as('parent');
    const maybe = await parent.put(`/events/${FAMILY_NIGHT}/rsvp`, { status: 'maybe' });
    expect(maybe.body.myRsvp).toBe('maybe');
    const going = await parent.put(`/events/${FAMILY_NIGHT}/rsvp`, { status: 'going' });
    expect(going.body.goingCount).toBe(maybe.body.goingCount + 1);
    expect((await parent.get(`/events/${FAMILY_NIGHT}/rsvps`)).status).toBe(403);
    const list = await staff.get(`/events/${FAMILY_NIGHT}/rsvps`);
    expect(list.status).toBe(200);
    expect(list.body.map((a: { user: { id: string } }) => a.user.id)).toContain(USERS.lisa.id);
  });

  it('never shows a teen’s name on an attendee list outside their team', async () => {
    const { as } = await world();
    const teen = await as('teen');
    expect((await teen.put(`/events/${FAMILY_NIGHT}/rsvp`, { status: 'going' })).status).toBe(200);
    const list = await (await as('staff')).get(`/events/${FAMILY_NIGHT}/rsvps`);
    expect(list.text).not.toContain(USERS.noah.id);
  });
});

describe('creating and leaving communities', () => {
  it('holds a new community for review, visible only to staff and its creator', async () => {
    const { as } = await world();
    const athlete = await as('athlete');
    const priya = await as('alumni_athlete');
    const created = await athlete.post('/communities', {
      kind: 'interest',
      name: 'Pre-med athletes',
      about: 'MCAT study groups.',
      private: true,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ moderation: 'in_review', private: true, official: false });
    expect(created.body.myMembership).not.toBeNull();
    expect(ids((await priya.get('/communities')).body)).not.toContain(created.body.id);
    await approve(await as('staff'), created.body.id);
    expect(ids((await priya.get('/communities')).body)).toContain(created.body.id);
  });

  it('rejects a duplicate name in the same kind, ignoring case', async () => {
    const { as } = await world();
    const coach = await as('coach');
    const dup = await coach.post('/communities', {
      kind: 'interest',
      name: '  athletes IN finance ',
      about: 'Again.',
    });
    expect(dup.status).toBe(409);
  });

  it('never lets a teen or recruiter create a medical community', async () => {
    const { as } = await world();
    const body = { kind: 'medical', name: 'Teen heart group', about: 'Support.' };
    expect((await (await as('teen')).post('/communities', body)).status).toBe(403);
    expect((await (await as('recruiter')).post('/communities', body)).status).toBe(403);
    expect((await (await as('parent')).post('/communities', body)).status).toBe(201);
  });

  it('hides the medical kind entirely while its switch is off', async () => {
    const { as } = await world({ identitySearch: true, medicalCommunities: false });
    const parent = await as('parent');
    const res = await parent.post('/communities', { kind: 'medical', name: 'X', about: 'Y.' });
    expect(res.status).toBe(400);
    expect(res.text).not.toContain('edical');
    expect((await parent.post(`/communities/${MEDICAL}/posts`, { text: 'Hi' })).status).toBe(404);
  });

  it('clears the recruiter opt-in on leaving', async () => {
    const { as } = await world();
    const priya = await as('alumni_athlete');
    const recruiter = await as('recruiter');
    const found = await recruiter.get(`/search/athletes?communityId=${FIRST_GEN}`);
    expect(found.text).toContain(USERS.priya.id);
    const before = (await priya.get(`/communities/${FIRST_GEN}`)).body;
    expect(before.myMembership.recruiterSearchOptIn).toBe(true);
    const left = await priya.post(`/communities/${FIRST_GEN}/leave`);
    expect(left.status).toBe(200);
    expect(left.body.myMembership).toBeNull();
    const back = await priya.post(`/communities/${FIRST_GEN}/join`);
    expect(back.body.myMembership.recruiterSearchOptIn).toBe(false);
    // And recruiters no longer find her through it.
    const search = await recruiter.get(`/search/athletes?communityId=${FIRST_GEN}`);
    expect(search.text).not.toContain(USERS.priya.id);
  });

  it('can’t leave a team community', async () => {
    const { as } = await world();
    expect((await (await as('athlete')).post(`/communities/${TEAM}/leave`)).status).toBe(400);
  });
});

describe('private communities', () => {
  it('shows posts and events to members only', async () => {
    const { as } = await world();
    const coach = await as('coach'); // made Captains
    const jordan = await as('athlete'); // a member
    const created = await coach.post(`/communities/${CAPTAINS}/events`, {
      title: 'Captains lunch',
      startsAt: '2026-11-02T17:00:00.000Z',
      location: 'Carmichael',
    });
    await approve(await as('staff'), created.body.id);
    expect(ids((await jordan.get('/events')).body)).toContain(created.body.id);

    const outsider = await as('alumni_athlete');
    expect(ids((await outsider.get('/events')).body)).not.toContain(created.body.id);
    expect((await outsider.get(`/events/${created.body.id}`)).status).toBe(404);
    expect((await outsider.get(`/communities/${CAPTAINS}/posts`)).body.items).toHaveLength(0);
    const post = (await jordan.get(`/communities/${CAPTAINS}/posts`)).body.items[0];
    expect((await outsider.get(`/posts/${post.id}`)).status).toBe(404);
    expect((await outsider.get(`/posts/${post.id}/comments`)).status).toBe(404);
    expect((await outsider.post(`/posts/${post.id}/comments`, { text: 'Hi' })).status).toBe(404);
    const event = { title: 'x', startsAt: '2026-11-02T17:00:00.000Z', location: 'y' };
    expect((await outsider.post(`/communities/${CAPTAINS}/events`, event)).status).toBe(403);
  });

  it('tells the requester when the creator lets them in', async () => {
    const { as } = await world();
    const priya = await as('alumni_athlete');
    const coach = await as('coach');
    await priya.post(`/communities/${CAPTAINS}/join`);
    await coach.post(`/communities/${CAPTAINS}/requests/${USERS.priya.id}`, {
      decision: 'approve',
    });
    const notes = (await priya.get('/notifications')).body.items;
    expect(notes[0]).toMatchObject({
      kind: 'join_approved',
      target: { kind: 'community', id: CAPTAINS },
    });
  });
});

describe('notifications', () => {
  it('marks read, one or all', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const athlete = await as('athlete');
    for (const text of ['First announcement here', 'Second announcement here']) {
      await staff.post(`/communities/${TEAM_IMPACT}/posts`, { text });
    }
    const list = (await athlete.get('/notifications')).body;
    expect(list.unreadCount).toBe(2);
    const one = await athlete.post('/notifications/read', { ids: [list.items[0].id] });
    expect(one.body.unreadCount).toBe(1);
    const all = await athlete.post('/notifications/read', {});
    expect(all.body.unreadCount).toBe(0);
  });

  it('tells only members about an event in a medical community', async () => {
    const { as } = await world();
    const athlete = await as('athlete'); // Jordan is a member
    const hosted = await athlete.post(`/communities/${MEDICAL}/events`, {
      title: 'Meal train',
      startsAt: '2026-11-03T17:00:00.000Z',
      location: 'Online',
    });
    expect(hosted.status).toBe(201);
    await approve(await as('staff'), hosted.body.id);
    expect((await (await as('parent')).get('/notifications')).body.items).toHaveLength(1);
    for (const role of ['teen', 'recruiter', 'coach'] as const) {
      expect((await (await as(role)).get('/notifications')).body.items, role).toHaveLength(0);
    }
  });
});

describe('push text', () => {
  /** A world where Jordan has one phone. */
  const withPhone = () => {
    const w = new MockWorld({ identitySearch: true, medicalCommunities: true });
    w.devices.push({
      userId: USERS.jordan.id,
      token: 'jordan-phone',
      platform: 'ios',
      createdAt: new Date().toISOString(),
    });
    return w;
  };
  const community = (w: MockWorld, communityId: string) =>
    w.communities.find((c) => c.id === communityId)!;
  const eventIn = (w: MockWorld, communityId: string) =>
    notify(w, {
      userId: USERS.jordan.id,
      kind: 'event',
      actorId: USERS.lisa.id,
      text: `Lisa Nguyen added Meal train in ${community(w, communityId).name}`,
      target: { kind: 'event', id: id(9999) },
      communityId,
    });

  it('never names a medical community on the lock screen, but keeps it in the app', () => {
    const w = withPhone();
    const c = community(w, MEDICAL);
    notifyJoinApproved(w, c, USERS.jordan.id, w.user(USERS.lisa.id)!);
    expect(w.pushOutbox.map((p) => p.text)).toEqual([DISCREET_PUSH_TEXT]);
    expect(w.notifications[0]!.text).toContain(c.name);
  });

  it('keeps a medical community discreet even when it isn’t private', () => {
    const w = withPhone();
    Object.assign(community(w, MEDICAL), { private: false });
    eventIn(w, MEDICAL);
    expect(w.pushOutbox[0]!.text).toBe(DISCREET_PUSH_TEXT);
    expect(w.pushOutbox[0]!.text).not.toContain('Meal train');
  });

  it('never names a private interest community either', () => {
    const w = withPhone();
    eventIn(w, CAPTAINS);
    expect(w.pushOutbox[0]!.text).toBe(DISCREET_PUSH_TEXT);
  });

  it('sends the full text for an open community', () => {
    const w = withPhone();
    eventIn(w, FINANCE);
    expect(w.pushOutbox[0]!.text).toBe(w.notifications[0]!.text);
  });

  it('pushes every kind, not just join approvals', () => {
    const w = withPhone();
    for (const kind of NOTIFICATION_KINDS) {
      notify(w, {
        userId: USERS.jordan.id,
        kind,
        actorId: null,
        text: `A ${kind}`,
        target: { kind: 'community', id: TEAM_IMPACT },
        communityId: TEAM_IMPACT,
      });
    }
    expect(w.pushOutbox.map((p) => p.text)).toEqual(NOTIFICATION_KINDS.map((k) => `A ${k}`));
  });
});

describe('who gets a push', () => {
  /** A world where Jordan (a member of the medical community) has one phone. */
  const withPhone = (flags: FeatureFlags = { identitySearch: true, medicalCommunities: true }) => {
    const w = new MockWorld(flags);
    w.devices.push({
      userId: USERS.jordan.id,
      token: 'jordan-phone',
      platform: 'ios',
      createdAt: new Date().toISOString(),
    });
    return w;
  };
  const tellJordan = (w: MockWorld, communityId: string) =>
    notify(w, {
      userId: USERS.jordan.id,
      kind: 'event',
      actorId: null,
      text: 'Something happened',
      target: { kind: 'community', id: communityId },
      communityId,
    });

  it('sends nothing to a suspended account', () => {
    const w = withPhone();
    expect(suspend(w, w.user(USERS.staff.id)!, w.user(USERS.jordan.id)!)).toBeNull();
    tellJordan(w, TEAM_IMPACT);
    expect(w.pushOutbox).toEqual([]);
  });

  it('sends nothing about a community the reader can’t see', () => {
    const off = withPhone({ identitySearch: true, medicalCommunities: false });
    tellJordan(off, MEDICAL);
    expect(off.pushOutbox).toEqual([]);

    const removed = withPhone();
    removed.communities.find((c) => c.id === FINANCE)!.moderation = 'removed';
    tellJordan(removed, FINANCE);
    expect(removed.pushOutbox).toEqual([]);
  });

  it('pushes a staff warning even with every switch off, as the in-app one arrives', () => {
    const w = withPhone();
    const allOff = Object.fromEntries(Object.keys(DEFAULT_PREFS).map((k) => [k, false]));
    w.notificationPrefs.set(USERS.jordan.id, allOff as typeof DEFAULT_PREFS);
    const ticket = { id: id(9998), target: { kind: 'post' as const, id: id(9999) }, preview: '…' };
    warn(w, w.user(USERS.staff.id)!, w.user(USERS.jordan.id)!, ticket, null);
    expect(w.notifications.map((n) => n.kind)).toEqual(['warning']);
    expect(w.pushOutbox).toHaveLength(1);
    expect(w.pushOutbox[0]!.text).toBe(w.notifications[0]!.text);
  });

  it('agrees with the in-app list, which uses the same check', () => {
    const w = withPhone({ identitySearch: true, medicalCommunities: false });
    tellJordan(w, MEDICAL);
    tellJordan(w, TEAM_IMPACT);
    const jordan = w.user(USERS.jordan.id)!;
    const listed = w.notifications.filter((n) => canReceive(w, jordan.id, n.communityId));
    expect(w.pushOutbox.map((p) => p.notificationId)).toEqual(listed.map((n) => n.id));
    expect(listed.map((n) => n.communityId)).toEqual([TEAM_IMPACT]);
  });
});
