import { afterEach, describe, expect, it } from 'vitest';
import type { FeatureFlags, Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { id, USERS } from './fixtures';

const MEDICAL = id(303);
const FIRST_GEN = id(304); // official interest community
const FINANCE = id(305); // interest, not official
const TEAM = id(301);

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
    const { get } = await signIn('parent', { identitySearch: true, medicalCommunities: false });
    const kinds = (await get('/communities')).body.map((c: { kind: string }) => c.kind);
    expect(kinds).not.toContain('medical');
    expect((await get('/feed')).text).not.toContain(MEDICAL);
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

  it('keeps medical posts out of the home feed, even for members', async () => {
    // Lisa started the medical community and posted in it.
    const { get } = await signIn('parent');
    const feed = await get('/feed');
    expect(feed.text).not.toContain(MEDICAL);
    expect(feed.text).not.toContain('sent meals');
  });

  it('ranks the team first and shows only approved posts', async () => {
    const { get } = await signIn('athlete');
    const feed = (await get('/feed')).body.items as { community: { kind: string } }[];
    expect(feed[0]?.community.kind).toBe('team');
    expect(feed.at(-1)?.community.kind).toBe('team_impact');
    expect(JSON.stringify(feed)).not.toContain('$5,000');
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
    // Held for review: can't become a recruiter filter yet.
    const held = await send('PUT', `/staff/communities/${id(306)}/official`, { official: true });
    expect(held.status).toBe(400);
    for (const target of [MEDICAL, TEAM]) {
      const res = await send('PUT', `/staff/communities/${target}/official`, { official: true });
      expect(res.status).toBe(400);
    }
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
    expect(teams).toHaveLength(1);
    // Already on it.
    expect(
      (await send('POST', '/join-requests', { role: 'teen', teamId: teams[0]!.id })).status,
    ).toBe(409);
    const asAthlete = { role: 'athlete', teamId: teams[0]!.id, classYear: 2029 };
    expect((await send('POST', '/join-requests', asAthlete)).status).toBe(400);
  });
});
