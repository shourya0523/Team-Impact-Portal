import { afterEach, describe, expect, it } from 'vitest';
import { CURRENT_TERMS_VERSION, type Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { id, USERS } from './fixtures';
import { authorOf, isSuspended, suspend } from './staff-tools';
import { MockWorld } from './world';

const TEAM = id(301);
const COACH_POST = id(401);
const ANNOUNCEMENT = id(402); // staff's, in Team Impact's community
const SPAM_TICKET = id(1001); // on Chris's held spam post
const SPAM_POST = id(407);
const JORDAN_COMMENT = id(1302); // approved, on the announcement
const CHILD = id(150); // Lisa's son: a profile, never an account

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

type Method = 'GET' | 'POST' | 'PUT';

/** One mock API; `as(role)` signs a fixture user in, so several people act on the same world. */
const world = async () => {
  const app = await buildApp({ sessionSecret: 'x'.repeat(32), corsOrigins: [], mock: true });
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
      return { status: r.statusCode, body: r.body ? r.json() : undefined };
    };
    return {
      get: (url: string) => call('GET', url),
      post: (url: string, payload: object = {}) => call('POST', url, payload),
      put: (url: string, payload: object) => call('PUT', url, payload),
    };
  };
  return { app, as };
};

type Client = Awaited<ReturnType<Awaited<ReturnType<typeof world>>['as']>>;

const ids = (items: { id: string }[]) => items.map((i) => i.id);

/** The open ticket on `targetId`. */
const ticketOn = async (staff: Client, targetId: string) => {
  const tickets = (await staff.get('/staff/moderation/tickets')).body as {
    id: string;
    status: string;
    target: { id: string };
  }[];
  const t = tickets.find((x) => x.target.id === targetId && x.status === 'open');
  expect(t, 'an open ticket').toBeTruthy();
  return t!;
};

describe('recruiter approvals', () => {
  it('declines a pending sign-up, which drops it without making an account', async () => {
    const { as, app } = await world();
    const signup = await app.inject({
      method: 'POST',
      url: '/auth/recruiter-sign-up',
      payload: {
        email: 'casey.new@northbeam.com',
        password: 'correct horse battery',
        firstName: 'Casey',
        lastName: 'New',
        acceptTerms: true,
        termsVersion: CURRENT_TERMS_VERSION,
      },
    });
    expect(signup.statusCode).toBe(202);
    const staff = await as('staff');
    const pending = (await staff.get('/staff/recruiter-sign-ups')).body;
    expect(pending).toHaveLength(1);

    expect((await staff.post(`/staff/recruiter-sign-ups/${pending[0].id}/decline`)).status).toBe(
      204,
    );
    expect((await staff.get('/staff/recruiter-sign-ups')).body).toHaveLength(0);
    const recruiters = (await staff.get('/staff/recruiters')).body;
    expect(recruiters.map((r: { email: string }) => r.email)).not.toContain(
      'casey.new@northbeam.com',
    );
    expect((await staff.post(`/staff/recruiter-sign-ups/${pending[0].id}/decline`)).status).toBe(
      404,
    );
  });

  it('locks a suspended recruiter out of every route until restored', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const recruiter = await as('recruiter'); // Elena
    expect((await recruiter.get('/search/athletes')).status).toBe(200);

    const suspended = await staff.post(`/staff/recruiters/${USERS.elena.id}/suspend`);
    expect(suspended.status).toBe(200);
    expect(suspended.body.suspended).toBe(true);
    for (const url of ['/me', '/search/athletes', '/lists', '/feed', '/notifications']) {
      expect((await recruiter.get(url)).status, url).toBe(403);
    }
    // Her colleague at the same company keeps access: this isn't a company suspension.
    const list = (await staff.get('/staff/recruiters')).body as {
      user: { id: string };
      suspended: boolean;
    }[];
    expect(list.find((r) => r.user.id === USERS.elena.id)?.suspended).toBe(true);
    expect(list.find((r) => r.user.id === USERS.tom.id)?.suspended).toBe(false);

    expect((await staff.post(`/staff/recruiters/${USERS.elena.id}/restore`)).body.suspended).toBe(
      false,
    );
    expect((await recruiter.get('/me')).status).toBe(200);
  });

  it('only suspends recruiters from the recruiters page', async () => {
    const { as } = await world();
    const staff = await as('staff');
    expect((await staff.post(`/staff/recruiters/${USERS.jordan.id}/suspend`)).status).toBe(404);
    expect((await staff.post(`/staff/recruiters/${USERS.staff.id}/suspend`)).status).toBe(404);
  });
});

describe('moderation actions', () => {
  it('warns the author with a notification that no switch can turn off', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const chris = await as('alumni_mentor');
    await chris.put('/me/notification-prefs', {
      approvals: false,
      replies: false,
      events: false,
      announcements: false,
    });

    const res = await staff.post(`/staff/moderation/tickets/${SPAM_TICKET}/resolve`, {
      resolution: 'remove',
      authorAction: 'warn',
      note: 'Spam',
    });
    expect(res.status).toBe(200);
    const items = (await chris.get('/notifications')).body.items;
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('warning');
    // Shows as from Team Impact, never naming the staff member, and never links to the item.
    expect(items[0].actor).toBeNull();
    expect(items[0].target.kind).toBe('community');
    expect(JSON.stringify(items[0])).not.toContain(SPAM_POST);
  });

  it('suspends the author: 403 everywhere and their content gone from feeds, until unsuspended', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const jordan = await as('athlete');
    const coach = await as('coach');
    const teen = await as('teen');

    const created = await jordan.post(`/communities/${TEAM}/posts`, { text: 'Lift at 6?' });
    await staff.post(
      `/staff/moderation/tickets/${(await ticketOn(staff, created.body.id)).id}/resolve`,
      {
        resolution: 'dismiss',
      },
    );
    expect(ids((await coach.get('/feed')).body.items)).toContain(created.body.id);
    const comments = () => coach.get(`/posts/${ANNOUNCEMENT}/comments`);
    expect(ids((await comments()).body)).toContain(JORDAN_COMMENT);

    // A teammate reports it; staff keep the post but suspend its author.
    expect(
      (
        await teen.post('/reports', {
          target: { kind: 'post', id: created.body.id },
          reason: 'bullying',
        })
      ).status,
    ).toBe(201);
    const ticket = await ticketOn(staff, created.body.id);
    const res = await staff.post(`/staff/moderation/tickets/${ticket.id}/resolve`, {
      resolution: 'dismiss',
      authorAction: 'suspend',
      note: 'Repeated bullying',
    });
    expect(res.status).toBe(200);

    for (const url of ['/me', '/feed', '/events', '/notifications']) {
      expect((await jordan.get(url)).status, url).toBe(403);
    }
    expect((await jordan.post(`/communities/${TEAM}/posts`, { text: 'Hi' })).status).toBe(403);
    expect(ids((await coach.get('/feed')).body.items)).not.toContain(created.body.id);
    expect(ids((await comments()).body)).not.toContain(JORDAN_COMMENT);

    const suspended = (await staff.get('/staff/suspended-users')).body;
    expect(suspended).toHaveLength(1);
    expect(suspended[0].user.id).toBe(USERS.jordan.id);
    expect(suspended[0].reason).toBe('Repeated bullying');
    expect(suspended[0].ticketId).toBe(ticket.id);

    const after = await staff.post(`/staff/users/${USERS.jordan.id}/unsuspend`);
    expect(after.status).toBe(200);
    expect(after.body).toHaveLength(0);
    expect((await jordan.get('/me')).status).toBe(200);
    expect(ids((await coach.get('/feed')).body.items)).toContain(created.body.id);
    expect((await staff.post(`/staff/users/${USERS.jordan.id}/unsuspend`)).status).toBe(404);
  });

  it('never suspends staff, and leaves the ticket open when refused', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const athlete = await as('athlete');
    await athlete.post('/reports', {
      target: { kind: 'post', id: ANNOUNCEMENT },
      reason: 'other',
    });
    const ticket = await ticketOn(staff, ANNOUNCEMENT);
    const res = await staff.post(`/staff/moderation/tickets/${ticket.id}/resolve`, {
      resolution: 'dismiss',
      authorAction: 'suspend',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Staff accounts can’t be suspended/);
    expect((await ticketOn(staff, ANNOUNCEMENT)).id).toBe(ticket.id);
    expect((await staff.get('/me')).status).toBe(200);
    expect((await staff.get('/staff/moderation/log')).body).toHaveLength(0);
  });

  it('never suspends a team’s last coach', async () => {
    const { as } = await world();
    const staff = await as('staff');
    const athlete = await as('athlete');
    await athlete.post('/reports', { target: { kind: 'post', id: COACH_POST }, reason: 'other' });
    const ticket = await ticketOn(staff, COACH_POST);
    const res = await staff.post(`/staff/moderation/tickets/${ticket.id}/resolve`, {
      resolution: 'dismiss',
      authorAction: 'suspend',
    });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/last coach/);
    expect((await (await as('coach')).get('/me')).status).toBe(200);
  });

  it('logs every staff moderation action: who, what, target, when', async () => {
    const { as } = await world();
    const staff = await as('staff');
    await staff.post(`/staff/moderation/tickets/${SPAM_TICKET}/resolve`, {
      resolution: 'remove',
      authorAction: 'suspend',
      note: 'Spam',
    });
    await staff.post(`/staff/users/${USERS.chris.id}/unsuspend`);
    await staff.post(`/staff/recruiters/${USERS.tom.id}/suspend`);

    const log = (await staff.get('/staff/moderation/log')).body as {
      action: string;
      actor: { id: string };
      target: { kind: string; id: string; label: string };
      ticketId: string | null;
      createdAt: string;
    }[];
    // Newest first.
    expect(log.map((e) => [e.action, e.target.id])).toEqual([
      ['suspend', USERS.tom.id],
      ['unsuspend', USERS.chris.id],
      ['suspend', USERS.chris.id],
      ['remove', SPAM_POST],
    ]);
    for (const e of log) {
      expect(e.actor.id).toBe(USERS.staff.id);
      expect(Date.parse(e.createdAt)).not.toBeNaN();
    }
    expect(log[3]!.ticketId).toBe(SPAM_TICKET);
    expect(log[3]!.target.kind).toBe('post');
    expect(log[2]!.target).toEqual({ kind: 'user', id: USERS.chris.id, label: 'Chris Doyle' });
  });

  it('refuses every new staff route to everyone but staff', async () => {
    const { as } = await world();
    const roles: Role[] = [
      'coach',
      'athlete',
      'parent',
      'teen',
      'recruiter',
      'alumni_athlete',
      'alumni_mentor',
    ];
    for (const role of roles) {
      const u = await as(role);
      const calls = [
        u.get('/staff/recruiters'),
        u.get('/staff/suspended-users'),
        u.get('/staff/moderation/log'),
        u.post(`/staff/recruiter-sign-ups/${id(9999)}/decline`),
        u.post(`/staff/recruiters/${USERS.tom.id}/suspend`),
        u.post(`/staff/recruiters/${USERS.tom.id}/restore`),
        u.post(`/staff/users/${USERS.sam.id}/unsuspend`),
        u.post(`/staff/moderation/tickets/${SPAM_TICKET}/resolve`, {
          resolution: 'remove',
          authorAction: 'suspend',
        }),
      ];
      for (const r of await Promise.all(calls)) expect(r.status, role).toBe(403);
    }
  });
});

describe('suspension rules on the world', () => {
  const fresh = () => new MockWorld({ identitySearch: true, medicalCommunities: true });

  it('keeps a suspended parent’s children', () => {
    const w = fresh();
    const lisa = w.user(USERS.lisa.id)!;
    expect(suspend(w, w.user(USERS.staff.id)!, lisa)).toBeNull();
    expect(isSuspended(w, lisa.id)).toBe(true);
    expect(w.children.some((c) => c.id === CHILD && c.parentId === lisa.id)).toBe(true);
  });

  it('finds no account behind a child’s profile, so a child can’t be warned or suspended', () => {
    const w = fresh();
    const result = authorOf(w, { kind: 'profile', id: CHILD });
    expect('status' in result && result.status).toBe(400);
  });

  it('drops a suspended athlete from the employer portal', () => {
    const w = fresh();
    const card = w.cards.find((c) => c.face.athleteId === USERS.jordan.id)!;
    expect(w.recruiterCanSee(card)).toBe(true);
    suspend(w, w.user(USERS.staff.id)!, w.user(USERS.jordan.id)!);
    expect(w.recruiterCanSee(card)).toBe(false);
  });
});
