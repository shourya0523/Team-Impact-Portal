import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Role, TRACKED_EVENT_NAMES, type TrackedEventName } from '@team-impact/contracts';
import { CLIENT_EVENTS, forgedBody } from '../test/events';
import { useZodContracts } from '../zod';
import { id, USERS } from './fixtures';
import { registerMockRoutes } from './routes';
import { INVITE_TOKENS, QR_TOKENS } from './team';
import { MockWorld } from './world';

const SOCCER = id(201);
const TEAM = id(301); // the soccer team's community
const TEAM_IMPACT = id(302);
const FIRST_GEN = id(304); // official interest community
const FAMILY_NIGHT = id(502); // approved event in Team Impact's community
const TUFTS = id(701);
const FALL_INTERNS = id(901); // Elena's list
const LIVE_QR = id(1201); // the soccer team's live code

afterEach(() => {
  vi.restoreAllMocks();
});

type Card = { athleteId: string };

/** The mock API on a world the test can read, with one signed-in user at a time. */
const setup = async () => {
  const world = new MockWorld({ identitySearch: true, medicalCommunities: true });
  const app = useZodContracts(Fastify());
  await app.register(cookie, { secret: 'x'.repeat(32) });
  registerMockRoutes(app, world);
  let cookies: Record<string, string> = {};
  const call = async (method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: object) => {
    const r = await app.inject({ method, url, payload, cookies });
    for (const c of r.cookies) cookies[c.name] = c.value;
    return { status: r.statusCode, body: r.body ? r.json() : undefined };
  };
  const signInAs = async (role: Role, newcomer = false) => {
    cookies = {};
    expect((await call('POST', '/auth/dev-sign-in', { role, newcomer })).status).toBe(200);
  };
  const logged = (name: TrackedEventName) => world.eventsLog.filter((e) => e.event === name);
  /** The result rows logged for one search, in the order they were logged. */
  const shownBy = (searchId: string) =>
    logged('search.result_shown').filter(
      (e) => (e.properties as { searchId: string }).searchId === searchId,
    );
  return { world, call, signInAs, logged, shownBy };
};

/** What a search should log about its page: the searcher saw each athlete, at their place. */
const shownRows = (searchId: string, items: Card[], userId = USERS.elena.id) =>
  items.map((card, position) => ({
    userId,
    subjectId: card.athleteId,
    properties: { searchId, position },
  }));

describe('mock API: tracked events', () => {
  it('logs sign-ups', async () => {
    const { call, logged } = await setup();
    const res = await call('POST', '/auth/sign-up', {
      email: 'casey.new@example.org',
      password: 'correct horse battery',
      firstName: 'Casey',
      lastName: 'New',
      birthDate: '2005-03-04',
      role: 'athlete',
      acceptTerms: true,
    });
    expect(res.status).toBe(201);
    expect(logged('user.signed_up')).toMatchObject([
      { userId: res.body.id, subjectId: null, properties: { role: 'athlete' } },
    ]);
  });

  it('logs a coach’s sign-up through an invite', async () => {
    const { call, logged } = await setup();
    const accepted = await call('POST', `/invites/${INVITE_TOKENS.lacrosse}/accept`, {
      newAccount: {
        firstName: 'Pat',
        lastName: 'Nguyen',
        password: 'correct horse battery',
        acceptTerms: true,
      },
    });
    expect(accepted.status).toBe(200);
    expect(logged('user.signed_up')).toMatchObject([
      { userId: accepted.body.id, subjectId: null, properties: { role: 'coach' } },
    ]);
  });

  it('logs a recruiter’s sign-up when staff approve it, as the new recruiter', async () => {
    const { call, signInAs, logged } = await setup();
    const requested = await call('POST', '/auth/recruiter-sign-up', {
      email: 'robin.hale@northbeam.com',
      password: 'correct horse battery',
      firstName: 'Robin',
      lastName: 'Hale',
      acceptTerms: true,
    });
    expect(requested.status).toBe(202);

    await signInAs('staff');
    const [pending] = (await call('GET', '/staff/recruiter-sign-ups')).body;
    const approved = await call('POST', `/staff/recruiter-sign-ups/${pending.id}/approve`);
    expect(approved.status).toBe(200);
    expect(logged('user.signed_up')).toMatchObject([
      { userId: approved.body.user.id, subjectId: null, properties: { role: 'recruiter' } },
    ]);
  });

  it('logs the team search, join requests and QR joins', async () => {
    const { call, signInAs, logged } = await setup();
    await signInAs('athlete', true);
    const teams = await call('GET', `/teams?collegeId=${TUFTS}&sport=soccer`);
    expect(teams.status).toBe(200);
    const [search, ...more] = logged('search.run');
    expect(more).toEqual([]);
    expect(search).toMatchObject({
      userId: USERS.leo.id,
      subjectId: null,
      properties: { surface: 'teams', resultCount: teams.body.length },
    });
    const { filters } = search!.properties as { filters: string[] };
    expect([...filters].sort()).toEqual(['collegeId', 'sport']);
    // Teams aren't people: nothing is logged as shown to the joiner.
    expect(logged('search.result_shown')).toEqual([]);

    const sent = await call('POST', '/join-requests', {
      role: 'athlete',
      teamId: SOCCER,
      classYear: 2028,
    });
    expect(sent.status).toBe(201);
    expect(logged('join_request.created')).toMatchObject([
      {
        userId: USERS.leo.id,
        subjectId: null,
        properties: { joinRequestId: sent.body.id, teamId: SOCCER, role: 'athlete' },
      },
    ]);

    expect((await call('POST', `/qr/${QR_TOKENS.live}/join`)).status).toBe(201);
    expect(logged('qr_code.redeemed')).toMatchObject([
      { userId: USERS.leo.id, subjectId: null, properties: { teamId: SOCCER, qrCodeId: LIVE_QR } },
    ]);
  });

  it('logs card publishing, posts, announcements and RSVPs', async () => {
    const { call, signInAs, logged } = await setup();
    await signInAs('athlete');
    const published = await call('POST', '/cards/me/publish');
    expect(published.status).toBe(200);
    expect(logged('card.published')).toMatchObject([
      { userId: USERS.jordan.id, subjectId: null, properties: { cardId: published.body.card.id } },
    ]);

    const post = await call('POST', `/communities/${TEAM}/posts`, { text: 'Great win today!' });
    expect(post.status).toBe(201);
    expect(logged('post.created')).toMatchObject([
      { userId: USERS.jordan.id, properties: { postId: post.body.id, kind: 'post' } },
    ]);

    await signInAs('staff');
    const announcement = await call('POST', '/staff/announcements', {
      communityId: TEAM_IMPACT,
      text: 'Pilot opens in December!',
      sendPush: false,
    });
    expect(announcement.status).toBe(201);
    expect(logged('post.created').slice(1)).toMatchObject([
      {
        userId: USERS.staff.id,
        subjectId: null,
        properties: { postId: announcement.body.id, kind: 'announcement' },
      },
    ]);

    await signInAs('parent');
    expect((await call('PUT', `/events/${FAMILY_NIGHT}/rsvp`, { status: 'going' })).status).toBe(
      200,
    );
    expect(logged('rsvp.set')).toMatchObject([
      {
        userId: USERS.lisa.id,
        subjectId: null,
        properties: { calendarEventId: FAMILY_NIGHT, status: 'going' },
      },
    ]);
  });

  it('logs nothing for an action that was refused', async () => {
    const { call, signInAs, world, logged } = await setup();
    await signInAs('athlete', true);
    // Leo has no card yet, and his draft is missing what a card needs.
    expect((await call('POST', '/cards/me/publish')).status).toBe(400);
    expect((await call('POST', `/qr/${QR_TOKENS.revoked}/join`)).status).toBe(410);
    expect(world.eventsLog).toEqual([]);

    const request = { role: 'athlete', teamId: SOCCER, classYear: 2028 };
    expect((await call('POST', '/join-requests', request)).status).toBe(201);
    expect((await call('POST', '/join-requests', request)).status).toBe(409);
    expect(logged('join_request.created')).toHaveLength(1);
  });

  it('logs every recruiter search and who it showed, the identity filter as its own event', async () => {
    const { call, signInAs, logged, shownBy } = await setup();
    await signInAs('recruiter');
    const found = await call('GET', '/search/athletes?sport=Soccer');
    expect(found.body.items.length).toBeGreaterThan(0);
    expect(found.body.nextCursor).toBeNull();
    const [search] = logged('search.run');
    expect(search).toMatchObject({
      userId: USERS.elena.id,
      subjectId: null,
      properties: {
        surface: 'athletes',
        filters: ['sport'],
        resultCount: found.body.items.length,
      },
    });
    const { searchId } = search!.properties as { searchId: string };
    expect(logged('search.result_shown')).toMatchObject(shownRows(searchId, found.body.items));

    await call('GET', `/search/athletes?communityId=${FIRST_GEN}`);
    expect(logged('search.run')).toHaveLength(1);
    expect(logged('search.identity_filter')).toMatchObject([
      { properties: { communityId: FIRST_GEN, companyId: USERS.elena.companyId, filters: [] } },
    ]);
    expect(shownBy(searchId)).toHaveLength(found.body.items.length);
  });

  it('logs only the page a search returned, each person at their place on it', async () => {
    const { call, signInAs, logged, shownBy } = await setup();
    await signInAs('recruiter');
    const first = await call('GET', '/search/athletes?limit=2');
    expect(first.body.items).toHaveLength(2);
    expect(first.body.nextCursor).not.toBeNull();
    const second = await call('GET', `/search/athletes?limit=2&cursor=${first.body.nextCursor}`);
    expect(second.body.items.length).toBeGreaterThan(0);

    const searches = logged('search.run');
    expect(searches).toHaveLength(2);
    // Paging isn't a filter.
    for (const s of searches) expect(s.properties).toMatchObject({ filters: [] });
    const [a, b] = searches.map((s) => (s.properties as { searchId: string }).searchId);
    expect(a).not.toBe(b);
    expect(shownBy(a!)).toMatchObject(shownRows(a!, first.body.items));
    expect(shownBy(b!)).toMatchObject(shownRows(b!, second.body.items));
    expect(logged('search.result_shown')).toHaveLength(
      first.body.items.length + second.body.items.length,
    );
  });

  it('logs an identity search with recruiter, company and time, and who it showed', async () => {
    const { call, signInAs, logged, shownBy } = await setup();
    await signInAs('recruiter');
    const before = Date.now();
    const found = await call('GET', `/search/athletes?communityId=${FIRST_GEN}`);
    const after = Date.now();
    expect(found.status).toBe(200);
    expect(found.body.items.length).toBeGreaterThan(0);
    expect(found.body.nextCursor).toBeNull();

    expect(logged('search.run')).toEqual([]);
    const [search, ...more] = logged('search.identity_filter');
    expect(more).toEqual([]);
    expect(search).toMatchObject({
      userId: USERS.elena.id,
      subjectId: null,
      properties: {
        communityId: FIRST_GEN,
        companyId: USERS.elena.companyId,
        filters: [],
        resultCount: found.body.items.length,
      },
    });
    const time = Date.parse(search!.occurredAt);
    expect(time).toBeGreaterThanOrEqual(before);
    expect(time).toBeLessThanOrEqual(after);
    const { searchId } = search!.properties as { searchId: string };
    expect(logged('search.result_shown')).toMatchObject(shownRows(searchId, found.body.items));

    // One that finds nobody is still logged, with nobody shown.
    const none = await call('GET', `/search/athletes?communityId=${FIRST_GEN}&sport=Curling`);
    expect(none.body.items).toEqual([]);
    const [, empty] = logged('search.identity_filter');
    expect(empty).toMatchObject({
      userId: USERS.elena.id,
      properties: { communityId: FIRST_GEN, filters: ['sport'], resultCount: 0 },
    });
    expect(shownBy((empty!.properties as { searchId: string }).searchId)).toEqual([]);
  });

  it('fails an identity search whose log can’t be written, showing nobody', async () => {
    const { call, signInAs, world } = await setup();
    await signInAs('recruiter');
    const url = `/search/athletes?communityId=${FIRST_GEN}`;
    const athletes = (await call('GET', url)).body.items.map((c: Card) => c.athleteId);
    expect(athletes.length).toBeGreaterThan(0);

    vi.spyOn(world, 'track').mockImplementation(() => {
      throw new Error('events_log is down');
    });
    const res = await call('GET', url);
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body?.items).toBeUndefined();
    for (const athleteId of athletes) expect(JSON.stringify(res.body)).not.toContain(athleteId);
  });

  it('logs card and contact views from the apps, and saves to a list', async () => {
    const { call, signInAs, logged } = await setup();
    await signInAs('recruiter');
    const subjectId = USERS.jordan.id;
    const view = { name: 'card.viewed', properties: { cardId: id(1) }, subjectId };
    expect((await call('POST', '/events', view)).status).toBe(204);
    const contact = { name: 'contact.viewed', properties: { channel: 'email' }, subjectId };
    expect((await call('POST', '/events', contact)).status).toBe(204);
    expect(logged('card.viewed')).toMatchObject([
      { userId: USERS.elena.id, subjectId, properties: { cardId: id(1) } },
    ]);
    expect(logged('contact.viewed')).toMatchObject([
      { userId: USERS.elena.id, subjectId, properties: { channel: 'email' } },
    ]);

    const { body } = await call('GET', '/search/athletes');
    const newcomer = body.items
      .map((c: Card) => c.athleteId)
      .find((a: string) => a !== USERS.jordan.id && a !== USERS.riley.id);
    expect((await call('POST', `/lists/${FALL_INTERNS}/athletes/${newcomer}`)).status).toBe(200);
    expect(logged('list.athlete_saved')).toMatchObject([
      { userId: USERS.elena.id, subjectId: newcomer, properties: { listId: FALL_INTERNS } },
    ]);
  });

  it('deleting an account drops what they did and what was shown about them', async () => {
    const { call, signInAs, world } = await setup();
    await signInAs('recruiter');
    await call('GET', '/search/athletes');
    const view = { name: 'card.viewed', properties: { cardId: id(1) }, subjectId: USERS.jordan.id };
    await call('POST', '/events', view);
    expect(world.eventsLog.some((e) => e.subjectId === USERS.jordan.id)).toBe(true);

    await signInAs('athlete');
    await call('POST', '/cards/me/publish');
    expect((await call('DELETE', '/me')).status).toBe(204);
    const jordan = (e: { userId: string | null; subjectId: string | null }) =>
      e.userId === USERS.jordan.id || e.subjectId === USERS.jordan.id;
    expect(world.eventsLog.filter(jordan)).toEqual([]);
    expect(world.eventsLog.some((e) => e.userId === USERS.elena.id)).toBe(true);

    // A view the recruiter's app sends late doesn't bring them back.
    await signInAs('recruiter');
    expect((await call('POST', '/events', view)).status).toBe(404);
    expect(world.eventsLog.filter(jordan)).toEqual([]);
  });

  it('refuses client events that are signed out, API-only or about nobody', async () => {
    const { call, signInAs, world } = await setup();
    const view = { name: 'card.viewed', properties: { cardId: id(1) }, subjectId: USERS.jordan.id };
    expect((await call('POST', '/events', view)).status).toBe(401);
    await signInAs('recruiter');
    expect(
      (await call('POST', '/events', { ...view, name: 'search.identity_filter' })).status,
    ).toBe(400);
    expect((await call('POST', '/events', { ...view, subjectId: id(9999) })).status).toBe(404);
    expect(world.eventsLog.filter((e) => e.event === 'card.viewed')).toEqual([]);
  });

  it('takes card and contact views only, refusing every well-formed API event', async () => {
    const { call, signInAs, world } = await setup();
    await signInAs('recruiter');
    for (const name of TRACKED_EVENT_NAMES) {
      const res = await call('POST', '/events', forgedBody(name, USERS.jordan.id));
      expect(res.status, name).toBe(CLIENT_EVENTS.includes(name) ? 204 : 400);
    }
    expect(world.eventsLog.map((e) => e.event).sort()).toEqual([...CLIENT_EVENTS].sort());
  });

  it('takes the user from the session and the time from the server, never the body', async () => {
    const { call, signInAs, world } = await setup();
    await signInAs('recruiter');
    const view = { name: 'card.viewed', properties: { cardId: id(1) }, subjectId: USERS.jordan.id };
    const forgedAt = '2020-01-01T00:00:00.000Z';
    const before = Date.now();
    for (const forged of [
      { userId: USERS.tom.id },
      { occurredAt: forgedAt },
      { user_id: USERS.tom.id, occurred_at: forgedAt },
    ]) {
      const res = await call('POST', '/events', { ...view, ...forged });
      // Refusing the field and ignoring it both keep the client from setting it.
      expect([204, 400], JSON.stringify(forged)).toContain(res.status);
    }
    expect((await call('POST', '/events', view)).status).toBe(204);
    const after = Date.now();

    expect(world.eventsLog.length).toBeGreaterThan(0);
    for (const e of world.eventsLog) {
      expect(e.userId).toBe(USERS.elena.id);
      expect(Date.parse(e.occurredAt)).toBeGreaterThanOrEqual(before);
      expect(Date.parse(e.occurredAt)).toBeLessThanOrEqual(after);
    }
  });
});
