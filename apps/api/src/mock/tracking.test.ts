import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { Role, TrackedEventName } from '@team-impact/contracts';
import { useZodContracts } from '../zod';
import { id, USERS } from './fixtures';
import { registerMockRoutes } from './routes';
import { QR_TOKENS } from './team';
import { MockWorld } from './world';

const SOCCER = id(201);
const TEAM = id(301); // the soccer team's community
const FIRST_GEN = id(304); // official interest community
const FAMILY_NIGHT = id(502); // approved event in Team Impact's community
const FALL_INTERNS = id(901); // Elena's list

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
  return { world, call, signInAs, logged };
};

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
      { userId: res.body.id, properties: { role: 'athlete' } },
    ]);
  });

  it('logs join requests and QR joins', async () => {
    const { call, signInAs, logged } = await setup();
    await signInAs('athlete', true);
    const sent = await call('POST', '/join-requests', {
      role: 'athlete',
      teamId: SOCCER,
      classYear: 2028,
    });
    expect(sent.status).toBe(201);
    expect(logged('join_request.created')).toMatchObject([
      { properties: { joinRequestId: sent.body.id, teamId: SOCCER, role: 'athlete' } },
    ]);

    expect((await call('POST', `/qr/${QR_TOKENS.live}/join`)).status).toBe(201);
    expect(logged('qr_code.redeemed')).toMatchObject([{ properties: { teamId: SOCCER } }]);
  });

  it('logs card publishing, posts and RSVPs', async () => {
    const { call, signInAs, logged } = await setup();
    await signInAs('athlete');
    expect((await call('POST', '/cards/me/publish')).status).toBe(200);
    expect(logged('card.published')).toMatchObject([{ userId: USERS.jordan.id }]);

    const post = await call('POST', `/communities/${TEAM}/posts`, { text: 'Great win today!' });
    expect(post.status).toBe(201);
    expect(logged('post.created')).toMatchObject([
      { properties: { postId: post.body.id, kind: 'post' } },
    ]);

    await signInAs('parent');
    expect((await call('PUT', `/events/${FAMILY_NIGHT}/rsvp`, { status: 'going' })).status).toBe(
      200,
    );
    expect(logged('rsvp.set')).toMatchObject([
      { properties: { calendarEventId: FAMILY_NIGHT, status: 'going' } },
    ]);
  });

  it('logs every recruiter search and who it showed, the identity filter as its own event', async () => {
    const { call, signInAs, logged } = await setup();
    await signInAs('recruiter');
    const found = await call('GET', '/search/athletes?sport=Soccer');
    expect(found.body.items.length).toBeGreaterThan(0);
    const [search] = logged('search.run');
    expect(search).toMatchObject({
      userId: USERS.elena.id,
      properties: { surface: 'athletes', filters: ['sport'] },
    });
    const shown = logged('search.result_shown');
    expect(shown.map((e) => e.subjectId)).toEqual(
      found.body.items.map((c: { athleteId: string }) => c.athleteId),
    );
    const { searchId } = search!.properties as { searchId: string };
    for (const e of shown) expect(e.properties).toMatchObject({ searchId });

    await call('GET', `/search/athletes?communityId=${FIRST_GEN}`);
    expect(logged('search.run')).toHaveLength(1);
    expect(logged('search.identity_filter')).toMatchObject([
      { properties: { communityId: FIRST_GEN, companyId: USERS.elena.companyId, filters: [] } },
    ]);
  });

  it('logs card and contact views from the apps, and saves to a list', async () => {
    const { call, signInAs, logged } = await setup();
    await signInAs('recruiter');
    const subjectId = USERS.jordan.id;
    const view = { name: 'card.viewed', properties: { cardId: id(1) }, subjectId };
    expect((await call('POST', '/events', view)).status).toBe(204);
    const contact = { name: 'contact.viewed', properties: { channel: 'email' }, subjectId };
    expect((await call('POST', '/events', contact)).status).toBe(204);
    expect(logged('card.viewed')).toMatchObject([{ userId: USERS.elena.id, subjectId }]);
    expect(logged('contact.viewed')).toMatchObject([
      { subjectId, properties: { channel: 'email' } },
    ]);

    const { body } = await call('GET', '/search/athletes');
    const newcomer = body.items
      .map((c: { athleteId: string }) => c.athleteId)
      .find((a: string) => a !== USERS.jordan.id && a !== USERS.riley.id);
    expect((await call('POST', `/lists/${FALL_INTERNS}/athletes/${newcomer}`)).status).toBe(200);
    expect(logged('list.athlete_saved')).toMatchObject([
      { subjectId: newcomer, properties: { listId: FALL_INTERNS } },
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
});
