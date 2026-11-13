import { afterEach, describe, expect, it } from 'vitest';
import { CURRENT_TERMS_VERSION, type JoinRequest, type Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { id, summaryOf, USERS } from './fixtures';
import { applyJoinDecision, INVITE_TOKENS, QR_TOKENS } from './team';
import { MockWorld } from './world';

const SOCCER = id(201);
const LACROSSE = id(202);
const BASKETBALL = id(210);
const TUFTS = id(701);

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

type Method = 'GET' | 'POST' | 'PUT';

/** A fresh mock API with a cookie jar, so sign-up and sign-in carry over between calls. */
const client = async () => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
  close = () => app.close();
  let cookies: Record<string, string> = {};
  const call = async (method: Method, url: string, payload?: object) => {
    const r = await app.inject({ method, url, payload, cookies });
    for (const c of r.cookies) cookies = { ...cookies, [c.name]: c.value };
    return { status: r.statusCode, body: r.body ? r.json() : undefined };
  };
  const signInAs = async (role: Role, newcomer = false) => {
    cookies = {};
    const r = await call('POST', '/auth/dev-sign-in', { role, newcomer });
    expect(r.status).toBe(200);
  };
  const signOut = () => {
    cookies = {};
  };
  return { app, call, signInAs, signOut };
};

/** An ISO date `years` ago (a day earlier, so the birthday has passed). */
const bornYearsAgo = (years: number) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

const signup = (over: object = {}) => ({
  email: 'casey.new@example.org',
  password: 'correct horse battery',
  firstName: 'Casey',
  lastName: 'New',
  birthDate: bornYearsAgo(20),
  role: 'athlete',
  acceptTerms: true,
  termsVersion: CURRENT_TERMS_VERSION,
  ...over,
});

describe('sign-up', () => {
  it('creates an adult account and signs it in', async () => {
    const { call } = await client();
    const res = await call('POST', '/auth/sign-up', signup());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      role: 'athlete',
      email: 'casey.new@example.org',
      teamIds: [],
    });
    expect(res.body).not.toHaveProperty('birthDate');
    const me = await call('GET', '/me');
    expect(me.body.id).toBe(res.body.id);
  });

  it('never creates an account for anyone under 13, and points them to a parent', async () => {
    const { app, call } = await client();
    const before = await call('GET', '/me');
    expect(before.status).toBe(401);
    for (const role of ['athlete', 'teen', 'parent']) {
      const res = await call(
        'POST',
        '/auth/sign-up',
        signup({ birthDate: bornYearsAgo(12), role }),
      );
      expect(res.status, role).toBe(400);
      const messages = res.body.error.issues.map((i: { message: string }) => i.message);
      expect(messages.join(' ')).toMatch(/13 or older.*parent or guardian/);
    }
    const me = await app.inject({ method: 'GET', url: '/me' });
    expect(me.statusCode).toBe(401);
  });

  it('signs 13–17 year olds up as teens only, with the teen terms agreed', async () => {
    const { call } = await client();
    const teen = { birthDate: bornYearsAgo(15), role: 'teen' };
    const noTerms = await call('POST', '/auth/sign-up', signup(teen));
    expect(noTerms.status).toBe(400);
    expect(noTerms.body.error.issues[0].path).toEqual(['body', 'parentAgreed']);

    const asAthlete = await call(
      'POST',
      '/auth/sign-up',
      signup({ ...teen, role: 'athlete', parentAgreed: true }),
    );
    expect(asAthlete.status).toBe(400);

    const ok = await call('POST', '/auth/sign-up', signup({ ...teen, parentAgreed: true }));
    expect(ok.status).toBe(201);
    expect(ok.body.role).toBe('teen');
  });

  it('keeps adults off the teen role and refuses a taken email', async () => {
    const { call } = await client();
    expect((await call('POST', '/auth/sign-up', signup({ role: 'teen' }))).status).toBe(400);
    const taken = await call('POST', '/auth/sign-up', signup({ email: USERS.jordan.email }));
    expect(taken.status).toBe(409);
  });
});

describe('join flow: sport step', () => {
  it('lists every live sport at a college and filters by sport', async () => {
    const { call, signInAs } = await client();
    await signInAs('athlete', true);
    const all = await call('GET', `/teams?collegeId=${TUFTS}`);
    // Lacrosse is still waiting on its first coach, so it isn't listed.
    expect(all.body.map((t: { id: string }) => t.id).sort()).toEqual([SOCCER, BASKETBALL].sort());
    const soccer = await call('GET', `/teams?collegeId=${TUFTS}&sport=soccer`);
    expect(soccer.body.map((t: { id: string }) => t.id)).toEqual([SOCCER]);
  });
});

describe('parents adding children to a join request', () => {
  const child = (over: object = {}) => ({
    firstName: 'Lucia',
    lastInitial: 'd',
    birthDate: bornYearsAgo(8),
    ...over,
  });

  it('creates the child profile on approval, never an account or login', async () => {
    const { call, signInAs } = await client();
    await signInAs('parent', true);
    const sent = await call('POST', '/join-requests', {
      role: 'parent',
      teamId: SOCCER,
      relationship: 'parent',
      children: [child()],
    });
    expect(sent.status).toBe(201);
    // The coach sees first name, last initial and age; the birth date is never kept.
    expect(sent.body.children).toEqual([{ firstName: 'Lucia', lastInitial: 'D', age: 8 }]);
    expect(JSON.stringify(sent.body)).not.toContain(child().birthDate);

    await signInAs('coach');
    const decided = await call('POST', `/join-requests/${sent.body.id}/decision`, {
      decision: 'approve',
    });
    expect(decided.status).toBe(200);
    expect(decided.body.status).toBe('approved');

    // The parent is on the team; Lucia is a child profile with no account behind it.
    await signInAs('parent', true);
    expect((await call('GET', '/me')).body.teamIds).toEqual([SOCCER]);
    // A second decision is refused: approval runs once.
    await signInAs('coach');
    const again = await call('POST', `/join-requests/${sent.body.id}/decision`, {
      decision: 'approve',
    });
    expect(again.status).toBe(409);
  });

  it('approval adds a child row a parent runs, and no user', () => {
    const world = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const users = world.users.length;
    const request: JoinRequest = {
      id: world.newId(),
      teamId: SOCCER,
      requester: summaryOf(USERS.rosa),
      role: 'parent',
      relationship: 'guardian',
      children: [{ firstName: 'Lucia', lastInitial: 'D', age: 8 }],
      status: 'pending',
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    world.joinRequests.push(request);
    applyJoinDecision(world, request, 'approve');
    expect(world.users).toHaveLength(users);
    expect(world.users.some((u) => u.firstName === 'Lucia')).toBe(false);
    const lucia = world.children.find((c) => c.firstName === 'Lucia');
    expect(lucia).toMatchObject({ parentId: USERS.rosa.id, teamId: SOCCER, age: 8 });
    expect(lucia).not.toHaveProperty('email');
    expect(lucia).not.toHaveProperty('birthDate');
  });

  it('declining adds no child', () => {
    const world = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const before = world.children.length;
    const request: JoinRequest = {
      id: world.newId(),
      teamId: SOCCER,
      requester: summaryOf(USERS.rosa),
      role: 'parent',
      relationship: 'parent',
      children: [{ firstName: 'Lucia', lastInitial: 'D', age: 8 }],
      status: 'pending',
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    applyJoinDecision(world, request, 'decline');
    expect(world.children).toHaveLength(before);
    expect(world.teamIdsOf(USERS.rosa.id)).toEqual([]);
  });

  it('refuses children 13 or over, and a child can never sign up or sign in', async () => {
    const { call, signInAs } = await client();
    await signInAs('parent', true);
    const teen = await call('POST', '/join-requests', {
      role: 'parent',
      teamId: SOCCER,
      relationship: 'parent',
      children: [child({ birthDate: bornYearsAgo(14) })],
    });
    expect(teen.status).toBe(400);
    expect(teen.body.error.issues[0].message).toMatch(/sign up themselves/);

    // No route turns a child into an account: sign-up refuses, and sign-in has no child role.
    const asChild = await call(
      'POST',
      '/auth/sign-up',
      signup({ email: 'lucia@example.org', birthDate: bornYearsAgo(8) }),
    );
    expect(asChild.status).toBe(400);
    expect((await call('POST', '/auth/dev-sign-in', { role: 'child' })).status).toBe(400);
  });
});

describe('team QR codes', () => {
  it('previews a live code signed out, then joins straight away once signed in', async () => {
    const { call, signInAs } = await client();
    const preview = await call('GET', `/qr/${QR_TOKENS.live}`);
    expect(preview.status).toBe(200);
    expect(preview.body.team.id).toBe(SOCCER);
    expect(preview.body.sharedBy.id).toBe(USERS.coach.id);

    expect((await call('POST', `/qr/${QR_TOKENS.live}/join`)).status).toBe(401);

    await signInAs('athlete', true);
    const joined = await call('POST', `/qr/${QR_TOKENS.live}/join`);
    expect(joined.status).toBe(201);
    expect(joined.body.team.id).toBe(SOCCER);
    expect((await call('GET', '/me')).body.teamIds).toEqual([SOCCER]);
    expect((await call('POST', `/qr/${QR_TOKENS.live}/join`)).status).toBe(409);
  });

  it('rejects revoked, expired and unknown codes', async () => {
    const { call, signInAs } = await client();
    await signInAs('teen', true);
    for (const token of [QR_TOKENS.revoked, QR_TOKENS.expired]) {
      expect((await call('GET', `/qr/${token}`)).status, token).toBe(410);
      expect((await call('POST', `/qr/${token}/join`)).status, token).toBe(410);
    }
    expect((await call('GET', '/qr/not-a-real-team-code-123')).status).toBe(404);
    expect((await call('GET', '/me')).body.teamIds).toEqual([]);
  });

  it('only lets people who could ask to join scan in', async () => {
    const { call, signInAs } = await client();
    for (const role of ['recruiter', 'alumni_mentor'] as const) {
      await signInAs(role);
      expect((await call('POST', `/qr/${QR_TOKENS.live}/join`)).status, role).toBe(403);
    }
  });
});

describe('coach invites', () => {
  it('creates the coach account, puts them on the team and makes the team live', async () => {
    const { call, signInAs } = await client();
    const preview = await call('GET', `/invites/${INVITE_TOKENS.lacrosse}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ email: 'pat.nguyen@tufts.edu', hasAccount: false });

    const noAccount = await call('POST', `/invites/${INVITE_TOKENS.lacrosse}/accept`, {});
    expect(noAccount.status).toBe(400);

    const accepted = await call('POST', `/invites/${INVITE_TOKENS.lacrosse}/accept`, {
      newAccount: {
        firstName: 'Pat',
        lastName: 'Nguyen',
        password: 'correct horse battery',
        acceptTerms: true,
        termsVersion: CURRENT_TERMS_VERSION,
      },
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body).toMatchObject({ role: 'coach', teamIds: [LACROSSE] });

    // Single use, and the team now shows in the join search.
    expect((await call('GET', `/invites/${INVITE_TOKENS.lacrosse}`)).status).toBe(410);
    await signInAs('athlete', true);
    const teams = await call('GET', `/teams?collegeId=${TUFTS}`);
    expect(teams.body.map((t: { id: string }) => t.id)).toContain(LACROSSE);
  });

  it('refuses revoked and expired invites, and someone else’s session', async () => {
    const { call, signInAs } = await client();
    expect((await call('GET', `/invites/${INVITE_TOKENS.revoked}`)).status).toBe(410);
    expect((await call('GET', `/invites/${INVITE_TOKENS.expired}`)).status).toBe(410);
    await signInAs('coach');
    const wrong = await call('POST', `/invites/${INVITE_TOKENS.lacrosse}/accept`, {});
    expect(wrong.status).toBe(403);
  });
});

describe('recruiter sign-up', () => {
  const recruiter = (email: string) => ({
    email,
    password: 'correct horse battery',
    firstName: 'Robin',
    lastName: 'Hale',
    acceptTerms: true,
    termsVersion: CURRENT_TERMS_VERSION,
  });

  it('waits in pending with no session until staff approve', async () => {
    const { call, signInAs, signOut } = await client();
    const res = await call(
      'POST',
      '/auth/recruiter-sign-up',
      recruiter('robin.hale@northbeam.com'),
    );
    expect(res.status).toBe(202);
    expect(res.body).toMatchObject({ status: 'pending', company: { name: 'Northbeam Capital' } });
    expect((await call('GET', '/me')).status).toBe(401);

    await signInAs('staff');
    const queue = await call('GET', '/staff/recruiter-sign-ups');
    expect(queue.body).toHaveLength(1);
    const approved = await call('POST', `/staff/recruiter-sign-ups/${queue.body[0].id}/approve`);
    expect(approved.status).toBe(200);
    expect(approved.body.user.role).toBe('recruiter');
    signOut();
  });

  it('rejects a suspended company, an unknown company and personal email', async () => {
    const { call } = await client();
    const suspended = await call('POST', '/auth/recruiter-sign-up', recruiter('jo@kestrel.co'));
    expect(suspended.status).toBe(403);
    const unknown = await call('POST', '/auth/recruiter-sign-up', recruiter('jo@acme.example'));
    expect(unknown.status).toBe(404);
    const personal = await call('POST', '/auth/recruiter-sign-up', recruiter('jo@gmail.com'));
    expect(personal.status).toBe(400);
  });
});
