import { afterEach, describe, expect, it } from 'vitest';
import type { FeatureFlags, Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { id, USERS } from './fixtures';

const MEDICAL = id(303);
const FIRST_GEN = id(304); // official interest community
const FINANCE = id(305); // interest, not official
const TEAM = id(301);
const CAPTAINS = id(307); // private interest community

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

/** A fresh mock API, signed in as `role`'s fixture user. */
const signIn = async (role: Role, flags?: FeatureFlags) => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true, flags });
  close = () => app.close();
  const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: { role } });
  expect(res.statusCode).toBe(200);
  const cookie = res.cookies[0]!;
  const get = async (url: string) => {
    const r = await app.inject({ method: 'GET', url, cookies: { [cookie.name]: cookie.value } });
    return { status: r.statusCode, body: r.json(), text: r.body };
  };
  const send = async (method: 'POST' | 'PUT', url: string, payload: object) => {
    const r = await app.inject({ method, url, payload, cookies: { [cookie.name]: cookie.value } });
    return { status: r.statusCode, body: r.json() };
  };
  return { app, get, send };
};

const ids = (items: { id: string }[]) => items.map((i) => i.id);

describe('mock API: session', () => {
  it('signs every role in as its fixture user', async () => {
    for (const role of ['staff', 'coach', 'athlete', 'parent', 'teen', 'recruiter'] as const) {
      const { get } = await signIn(role);
      const me = await get('/me');
      expect(me.status, role).toBe(200);
      expect(me.body.role, role).toBe(role);
      await close?.();
    }
  });

  it('refuses requests without a session', async () => {
    const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
    close = () => app.close();
    const res = await app.inject({ method: 'GET', url: '/me' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthenticated');
  });

  it('serves no mock routes unless asked', async () => {
    const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [] });
    close = () => app.close();
    const res = await app.inject({ method: 'POST', url: '/auth/dev-sign-in', payload: {} });
    expect(res.statusCode).toBe(404);
  });
});

describe('mock API: recruiter search', () => {
  it('returns only published, open-to-recruiting athletes', async () => {
    const { get } = await signIn('recruiter');
    const res = await get('/search/athletes');
    expect(res.status).toBe(200);
    const athletes = res.body.items.map((c: { athleteId: string }) => c.athleteId);
    // Jordan, Sam (current) and Priya (alumni). Riley isn't open, Ava isn't published.
    expect(athletes.sort()).toEqual([USERS.jordan.id, USERS.sam.id, USERS.priya.id].sort());
  });

  it('never returns a child or teen, and never a contact detail', async () => {
    const { get } = await signIn('recruiter');
    const res = await get('/search/athletes');
    expect(res.text).not.toContain(USERS.noah.id);
    expect(res.text).not.toContain('Mateo');
    expect(res.text).not.toContain('@');
  });

  it('filters by an official community, only for members who opted in, and logs it', async () => {
    const { get } = await signIn('recruiter');
    const res = await get(`/search/athletes?communityId=${FIRST_GEN}`);
    expect(res.status).toBe(200);
    const athletes = res.body.items.map((c: { athleteId: string }) => c.athleteId);
    // Sam is a member but didn't opt in.
    expect(athletes.sort()).toEqual([USERS.jordan.id, USERS.priya.id].sort());
  });

  it('logs every identity search with recruiter, company and time', async () => {
    const { app, get } = await signIn('recruiter');
    await get(`/search/athletes?communityId=${FIRST_GEN}`);
    await get('/search/athletes?major=economics');
    const staffSignIn = await app.inject({
      method: 'POST',
      url: '/auth/dev-sign-in',
      payload: { role: 'staff' },
    });
    const cookie = staffSignIn.cookies[0]!;
    const log = await app.inject({
      method: 'GET',
      url: '/staff/identity-searches',
      cookies: { [cookie.name]: cookie.value },
    });
    expect(log.json()).toHaveLength(1);
    expect(log.json()[0]).toMatchObject({
      recruiter: { id: USERS.elena.id },
      company: { name: 'Northbeam Capital' },
      community: { id: FIRST_GEN },
    });
  });

  it('never filters by a medical, team or unofficial community', async () => {
    const { get } = await signIn('recruiter');
    for (const communityId of [MEDICAL, TEAM, FINANCE]) {
      expect((await get(`/search/athletes?communityId=${communityId}`)).status).toBe(400);
    }
  });

  it('turns the community filter off with the flag, and nothing else', async () => {
    const { get } = await signIn('recruiter', { identitySearch: false, medicalCommunities: true });
    expect((await get(`/search/athletes?communityId=${FIRST_GEN}`)).status).toBe(400);
    expect((await get('/search/athletes?sport=soccer')).body.items).toHaveLength(2);
  });

  it('is for recruiters only', async () => {
    const { get } = await signIn('athlete');
    expect((await get('/search/athletes')).status).toBe(403);
  });
});

describe('mock API: cards and contacts', () => {
  it('shows recruiters only the contacts shared with recruiters', async () => {
    const { get } = await signIn('recruiter');
    const card = await get(`/cards/${USERS.jordan.id}`);
    expect(card.body.contact).toEqual({
      email: USERS.jordan.email,
      linkedinUrl: 'https://www.linkedin.com/in/jordan-lee',
    });
    expect((await get(`/cards/${USERS.riley.id}`)).status).toBe(404);
  });

  it('shows parents the family set, and teens no contact details at all', async () => {
    const parent = await signIn('parent');
    expect((await parent.get(`/cards/${USERS.jordan.id}`)).body.contact).toEqual({
      email: USERS.jordan.email,
    });
    await close?.();
    const teen = await signIn('teen');
    expect((await teen.get(`/cards/${USERS.jordan.id}`)).body.contact).toEqual({});
  });

  it('hides unpublished cards from everyone but the athlete', async () => {
    const { get } = await signIn('coach');
    expect((await get(`/cards/${USERS.ava.id}`)).status).toBe(404);
  });
});

describe('mock API: communities', () => {
  it('lets teens and recruiters never see a medical community', async () => {
    for (const role of ['teen', 'recruiter'] as const) {
      const { get } = await signIn(role);
      expect(ids((await get('/communities')).body), role).not.toContain(MEDICAL);
      expect((await get(`/communities/${MEDICAL}`)).status, role).toBe(404);
      expect((await get('/feed')).text, role).not.toContain(MEDICAL);
      await close?.();
    }
  });

  it('never puts medical membership on a profile, card or search result', async () => {
    // Jordan is a member.
    const { get } = await signIn('athlete');
    expect((await get('/me')).text).not.toContain(MEDICAL);
    await close?.();
    const recruiter = await signIn('recruiter');
    expect((await recruiter.get(`/cards/${USERS.jordan.id}`)).text).not.toContain(MEDICAL);
    expect((await recruiter.get('/search/athletes')).text).not.toContain(MEDICAL);
  });

  it('hides the medical kind everywhere with one switch', async () => {
    const off = { identitySearch: true, medicalCommunities: false };
    const { get, send } = await signIn('parent', off);
    const kinds = (await get('/communities')).body.map((c: { kind: string }) => c.kind);
    expect(kinds).not.toContain('medical');
    expect((await get('/feed')).text).not.toContain(MEDICAL);
    // Lisa made it, but while the switch is off there's nothing to join.
    expect((await send('POST', `/communities/${MEDICAL}/join`, {})).status).toBe(404);
    await close?.();
    // Staff, who see every other community, don't see it either.
    const staff = await signIn('staff', off);
    const listed = (await staff.get('/staff/communities')).body.map(
      (r: { community: { kind: string } }) => r.community.kind,
    );
    expect(listed).not.toContain('medical');
  });

  it('shows recruiters only Team Impact and official interest communities', async () => {
    const { get } = await signIn('recruiter');
    expect(ids((await get('/communities')).body).sort()).toEqual([id(302), FIRST_GEN].sort());
  });

  it('keeps the team community to its members and families', async () => {
    const alum = await signIn('alumni_mentor');
    expect(ids((await alum.get('/communities')).body)).not.toContain(TEAM);
    await close?.();
    const parent = await signIn('parent');
    expect(ids((await parent.get('/communities')).body)).toContain(TEAM);
  });

  it('shows members their medical community’s posts in the home feed (PRD v2.3)', async () => {
    // Lisa started the medical community and posted in it.
    const member = await signIn('parent');
    expect((await member.get('/feed')).text).toContain('sent meals');
    await close?.();
    // The coach can see the community exists, but isn't a member.
    const coach = await signIn('coach');
    expect((await coach.get('/feed')).text).not.toContain('sent meals');
  });

  it('keeps a private community’s posts to members, and makes joining a request', async () => {
    const outsider = await signIn('teen');
    // Findable by name...
    expect(ids((await outsider.get('/communities')).body)).toContain(CAPTAINS);
    // ...but nothing inside it.
    expect((await outsider.get(`/communities/${CAPTAINS}/posts`)).body.items).toEqual([]);
    expect((await outsider.get('/feed')).text).not.toContain('leadership meeting');
    const asked = await outsider.send('POST', `/communities/${CAPTAINS}/join`, {});
    expect(asked.status).toBe(200);
    expect(asked.body.myMembership).toBeNull();
    expect(asked.body.myJoinRequest).not.toBeNull();
    await close?.();

    const member = await signIn('athlete');
    expect((await member.get('/feed')).text).toContain('leadership meeting');
  });

  it('lets only the creator approve requests to a private community', async () => {
    const athlete = await signIn('athlete');
    expect((await athlete.get(`/communities/${CAPTAINS}/requests`)).status).toBe(403);
    await close?.();
    const { get, send } = await signIn('coach');
    const waiting = await get(`/communities/${CAPTAINS}/requests`);
    expect(waiting.body.map((r: { user: { id: string } }) => r.user.id)).toEqual([USERS.sam.id]);
    const left = await send('POST', `/communities/${CAPTAINS}/requests/${USERS.sam.id}`, {
      decision: 'approve',
    });
    expect(left.body).toEqual([]);
    const sam = (await get(`/communities/${CAPTAINS}`)).body;
    expect(sam.memberCount).toBe(3);
  });

  it('puts the team first and shows only approved posts', async () => {
    const { get } = await signIn('athlete');
    const feed = (await get('/feed')).body.items as { community: { kind: string } }[];
    expect(feed[0]?.community.kind).toBe('team');
    expect(JSON.stringify(feed)).not.toContain('$5,000');
  });

  it('orders every home feed by the pilot ranking (team weighted highest)', async () => {
    // Fixture posts by number (fixtures.ts), ranked by PILOT_RANKING (./feed.ts). The team posts
    // (401, 406: newest, team weight 4) lead; 401 and 406 tie, so the higher id goes first.
    // Team Impact's 402 is a day older and weighted 1, but its 48 rallies lift it above the
    // other communities' 3-rally posts (weight 1.5), which then follow newest first.
    const expected: Record<string, number[]> = {
      athlete: [406, 401, 402, 408, 403, 404, 405], // medical ranks like any other community
      parent: [406, 401, 402, 404],
      teen: [406, 401, 402, 403, 405],
      coach: [406, 401, 402, 408, 403, 405],
      recruiter: [402, 403, 405], // Team Impact and official First Gen only
      alumni_athlete: [402, 403, 405],
      alumni_mentor: [402, 407], // their own held post shows, but has no rallies yet
      staff: [402],
    };
    for (const [role, posts] of Object.entries(expected)) {
      const { get } = await signIn(role as Role);
      expect(ids((await get('/feed')).body.items), role).toEqual(posts.map(id));
      await close?.();
    }
  });

  it('orders a community feed by the same ranking', async () => {
    const { get } = await signIn('athlete');
    expect(ids((await get(`/communities/${FIRST_GEN}/posts`)).body.items)).toEqual(
      [403, 405].map(id),
    );
  });

  it('shows a medical community’s posts in its own feed, to members only', async () => {
    const member = await signIn('parent');
    const own = await member.get(`/communities/${MEDICAL}/posts`);
    expect(own.text).toContain('sent meals');
    await close?.();
    const coach = await signIn('coach'); // can see it exists, isn't a member
    expect((await coach.get(`/communities/${MEDICAL}/posts`)).body.items).toEqual([]);
  });

  it('lets people join interest communities, but never teens into medical ones', async () => {
    const coach = await signIn('coach');
    const joined = await coach.send('POST', `/communities/${FINANCE}/join`, {});
    expect(joined.status).toBe(200);
    expect(joined.body.myMembership).toMatchObject({ recruiterSearchOptIn: false });
    expect((await coach.send('POST', `/communities/${TEAM}/join`, {})).status).toBe(403);
    await close?.();
    const teen = await signIn('teen');
    expect((await teen.send('POST', `/communities/${MEDICAL}/join`, {})).status).toBe(404);
  });

  it('makes an athlete findable only in official communities they belong to', async () => {
    const { send, app } = await signIn('athlete');
    const off = await send('PUT', `/communities/${FIRST_GEN}/membership`, {
      recruiterSearchOptIn: false,
    });
    expect(off.status).toBe(200);
    expect(off.body.myMembership.recruiterSearchOptIn).toBe(false);
    const unofficial = await send('PUT', `/communities/${FINANCE}/membership`, {
      recruiterSearchOptIn: true,
    });
    expect(unofficial.status).toBe(400);
    // Turning it off drops Jordan from the identity search straight away.
    const r = await app.inject({
      method: 'POST',
      url: '/auth/dev-sign-in',
      payload: { role: 'recruiter' },
    });
    const res = await app.inject({
      method: 'GET',
      url: `/search/athletes?communityId=${FIRST_GEN}`,
      cookies: { [r.cookies[0]!.name]: r.cookies[0]!.value },
    });
    expect(res.body).not.toContain(USERS.jordan.id);
  });

  it('lets staff mark interest communities official, and nothing else', async () => {
    const { send } = await signIn('staff');
    const ok = await send('PUT', `/staff/communities/${FINANCE}/official`, { official: true });
    expect(ok.status).toBe(200);
    expect(ok.body.community.official).toBe(true);
    const privateOne = await send('PUT', `/staff/communities/${CAPTAINS}/official`, {
      official: true,
    });
    expect(privateOne.status).toBe(400);
    // Held for review: can't become a recruiter filter yet.
    const held = await send('PUT', `/staff/communities/${id(306)}/official`, { official: true });
    expect(held.status).toBe(400);
    for (const target of [MEDICAL, TEAM]) {
      const res = await send('PUT', `/staff/communities/${target}/official`, { official: true });
      expect(res.status).toBe(400);
    }
  });
});

describe('mock API: feed pages', () => {
  /** Every page of `url`, two at a time over HTTP, joined back together. */
  const walk = async (get: Awaited<ReturnType<typeof signIn>>['get'], url: string, max: number) => {
    const items: string[] = [];
    let cursor: string | null = null;
    for (let pages = 1; ; pages++) {
      const q = new URLSearchParams({ limit: '2', ...(cursor ? { cursor } : {}) });
      const { body } = await get(`${url}?${q}`);
      items.push(...ids(body.items));
      cursor = body.nextCursor;
      if (!cursor) return items;
      if (pages > max + 1) throw new Error('paging never ended');
    }
  };

  it('walks both feeds page by page to the same posts as one big page', async () => {
    const { get } = await signIn('athlete');
    for (const url of ['/feed', `/communities/${FIRST_GEN}/posts`]) {
      const all = ids((await get(`${url}?limit=100`)).body.items);
      expect(await walk(get, url, all.length), url).toEqual(all);
    }
  });

  it('answers 400 for a cursor it didn’t issue, or one from another feed', async () => {
    const { get } = await signIn('athlete');
    for (const url of ['/feed?cursor=nope', `/communities/${TEAM}/posts?cursor=nope`]) {
      const res = await get(url);
      expect(res.status, url).toBe(400);
      expect(res.body.error.code).toBe('bad_request');
    }
    const home = (await get('/feed?limit=1')).body.nextCursor;
    const q = new URLSearchParams({ cursor: home });
    expect((await get(`/communities/${TEAM}/posts?${q}`)).status).toBe(400);
  });

  it('pages 20 by default, allows up to 100, and refuses 0 or 101', async () => {
    const { get, send } = await signIn('coach');
    // Twenty held posts: the coach sees their own, so the coach's feeds grow past 20.
    for (let n = 1; n <= 20; n++) {
      expect(
        (await send('POST', `/communities/${TEAM}/posts`, { text: `Drill ${n}` })).status,
      ).toBe(201);
    }
    const home = (await get('/feed?limit=100')).body.items.length;
    const team = (await get(`/communities/${TEAM}/posts?limit=100`)).body.items.length;
    expect([home, team]).toEqual([26, 22]);

    for (const url of ['/feed', `/communities/${TEAM}/posts`]) {
      const first = (await get(url)).body;
      expect(first.items, url).toHaveLength(20);
      expect(first.nextCursor, url).not.toBeNull();
      expect((await get(`${url}?limit=100`)).body.nextCursor, url).toBeNull();
      for (const limit of [0, 101]) {
        expect((await get(`${url}?limit=${limit}`)).status, `${url} limit ${limit}`).toBe(400);
      }
    }
  });

  it('answers 404, not 400, when the reader can’t see the community at all', async () => {
    const teen = await signIn('teen');
    expect((await teen.get(`/communities/${MEDICAL}/posts?cursor=nope`)).status).toBe(404);
    await close?.();
    const recruiter = await signIn('recruiter');
    expect((await recruiter.get(`/communities/${TEAM}/posts?cursor=nope`)).status).toBe(404);
  });
});

describe('mock API: staff and join flow', () => {
  it('gives staff the teams, companies and moderation pages, and no one else', async () => {
    const staff = await signIn('staff');
    for (const url of ['/staff/teams', '/staff/companies', '/staff/moderation/tickets']) {
      expect((await staff.get(url)).status, url).toBe(200);
    }
    await close?.();
    const coach = await signIn('coach');
    expect((await coach.get('/staff/teams')).status).toBe(403);
  });

  it('walks a newcomer through the join flow once', async () => {
    const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
    close = () => app.close();
    const signedIn = await app.inject({
      method: 'POST',
      url: '/auth/dev-sign-in',
      payload: { role: 'athlete', newcomer: true },
    });
    expect(signedIn.json().teamIds).toEqual([]);
    const cookies = { [signedIn.cookies[0]!.name]: signedIn.cookies[0]!.value };
    const payload = { role: 'athlete', teamId: id(201), classYear: 2029 };
    const first = await app.inject({ method: 'POST', url: '/join-requests', payload, cookies });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ status: 'pending', requester: { id: USERS.leo.id } });
    const again = await app.inject({ method: 'POST', url: '/join-requests', payload, cookies });
    expect(again.statusCode).toBe(409);
  });

  it('takes a join request for a live team, as the account’s own role', async () => {
    const { send, get } = await signIn('teen');
    const colleges = (await get('/colleges')).body as { id: string }[];
    const teams = (await get(`/teams?collegeId=${colleges[0]!.id}`)).body as { id: string }[];
    // Live teams only: lacrosse is still waiting on its first coach.
    expect(teams.map((t) => t.id)).toEqual([id(201), id(210)]);
    // Already on it.
    expect(
      (await send('POST', '/join-requests', { role: 'teen', teamId: teams[0]!.id })).status,
    ).toBe(409);
    const asAthlete = { role: 'athlete', teamId: teams[0]!.id, classYear: 2029 };
    expect((await send('POST', '/join-requests', asAthlete)).status).toBe(400);
  });
});
