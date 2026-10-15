import cookie from '@fastify/cookie';
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import type { Role, TrackedEventName } from '@team-impact/contracts';
import { useZodContracts } from '../zod';
import { id, USERS } from './fixtures';
import { registerMockRoutes } from './routes';
import { INVITE_TOKENS, QR_TOKENS } from './team';
import { MockWorld } from './world';

const SOCCER = id(201);
const LACROSSE = id(202); // invited by staff, waiting on its first coach
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

  it('logs a new coach and who added them', async () => {
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
      { userId: accepted.body.id, properties: { role: 'coach' } },
    ]);
    // Staff sent the lacrosse team's first-coach invite, so staff added Pat: not Pat themselves.
    expect(logged('coach.added')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: accepted.body.id,
        properties: expect.objectContaining({ teamId: LACROSSE, via: 'invite' }),
      }),
    ]);
  });

  it('logs the coach who sent the invite as the one who added the new coach', async () => {
    const { world, call, signInAs, logged } = await setup();
    await signInAs('coach');
    const invited = await call('POST', `/teams/${SOCCER}/coach-invites`, {
      email: 'assistant.coach@tufts.edu',
    });
    expect(invited.status).toBe(201);
    expect(logged('coach.invited')).toEqual([
      expect.objectContaining({
        userId: USERS.coach.id,
        properties: { teamId: SOCCER, inviteId: invited.body.id },
      }),
    ]);
    // The link is only ever emailed; the new coach opens it signed out.
    await call('POST', '/auth/sign-out');
    const token = world.coachInvites.find((i) => i.id === invited.body.id)!.token;
    const accepted = await call('POST', `/invites/${token}/accept`, {
      newAccount: {
        firstName: 'Alex',
        lastName: 'Moore',
        password: 'correct horse battery',
        acceptTerms: true,
      },
    });
    expect(accepted.status).toBe(200);
    expect(logged('coach.added')).toEqual([
      expect.objectContaining({
        userId: USERS.coach.id,
        subjectId: accepted.body.id,
        properties: expect.objectContaining({ teamId: SOCCER, via: 'invite' }),
      }),
    ]);
  });

  it('logs each inviter when one coach accepts invites from staff and from a coach', async () => {
    const { world, call, signInAs, logged } = await setup();
    const email = 'alex.moore@tufts.edu';
    const tokenOf = (inviteId: string) => world.coachInvites.find((i) => i.id === inviteId)!.token;
    await signInAs('coach');
    const fromDana = await call('POST', `/teams/${SOCCER}/coach-invites`, { email });
    await signInAs('staff');
    const fromStaff = await call('POST', `/staff/teams/${LACROSSE}/coach-invites`, { email });
    expect([fromDana.status, fromStaff.status]).toEqual([201, 201]);

    // Alex creates their account through staff's invite, which signs them in...
    await call('POST', '/auth/sign-out');
    const alex = await call('POST', `/invites/${tokenOf(fromStaff.body.id)}/accept`, {
      newAccount: {
        firstName: 'Alex',
        lastName: 'Moore',
        password: 'correct horse battery',
        acceptTerms: true,
      },
    });
    expect(alex.status).toBe(200);
    // ...then accepts Dana's while signed in.
    expect((await call('POST', `/invites/${tokenOf(fromDana.body.id)}/accept`, {})).status).toBe(
      200,
    );
    expect(logged('coach.added')).toEqual([
      expect.objectContaining({
        userId: USERS.staff.id,
        subjectId: alex.body.id,
        properties: expect.objectContaining({ teamId: LACROSSE, via: 'invite' }),
      }),
      expect.objectContaining({
        userId: USERS.coach.id,
        subjectId: alex.body.id,
        properties: expect.objectContaining({ teamId: SOCCER, via: 'invite' }),
      }),
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
