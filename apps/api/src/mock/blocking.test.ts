// Blocking users (PRD §9, P2), beyond posts and comments: a block also hides each person's profile,
// card and roster entry from the other, keeps a blocked recruiter from finding the athlete, and
// silences notifications about each other's activity. The team's coaches and staff still see
// everyone they manage. Blocks cut both ways, and unblocking undoes all of it.
import { afterEach, describe, expect, it } from 'vitest';
import type { Role } from '@team-impact/contracts';
import { buildApp } from '../app';
import { notify } from './activity';
import { CHILDREN, id, USERS } from './fixtures';
import { MockWorld } from './world';

const TEAM = id(201); // Tufts women's soccer: coach Dana, athletes incl. Jordan, parent Lisa, teen Noah
const TEAM_COMMUNITY = id(301);
const FALL_INTERNS = id(901); // Elena's list; Jordan is on it
const MATEO = CHILDREN[0]!; // Lisa's son, on the team

let close: (() => Promise<void>) | undefined;
afterEach(() => close?.());

type Method = 'GET' | 'POST' | 'DELETE';

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
      // 204 (unblock) has no body.
      return { status: r.statusCode, body: r.body ? r.json() : null, text: r.body };
    };
    const get = (url: string) => call('GET', url);
    return {
      get,
      post: (url: string, payload: object = {}) => call('POST', url, payload),
      block: async (userId: string) =>
        expect((await call('POST', `/blocks/${userId}`)).status).toBe(201),
      unblock: async (userId: string) =>
        expect((await call('DELETE', `/blocks/${userId}`)).status).toBe(204),
      /** Every user id on this person's roster of the team (children by id under their parent). */
      rosterIds: async () => {
        const r = (await get(`/teams/${TEAM}/members`)).body;
        const people = [...r.coaches, ...r.athletes, ...r.teens, ...r.parents];
        return new Set<string>([
          ...people.map((m: { user: { id: string } }) => m.user.id),
          ...r.parents.flatMap((p: { children: { id: string }[] }) => p.children.map((c) => c.id)),
        ]);
      },
      status: async (url: string) => (await get(url)).status,
    };
  };
  return { as };
};

describe('blocking: profiles, cards and children', () => {
  it('hides each person’s profile and card from the other, until unblocked', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const lisa = await as('parent');
    expect(await lisa.status(`/profiles/${USERS.jordan.id}`)).toBe(200);
    expect(await lisa.status(`/cards/${USERS.jordan.id}`)).toBe(200);

    await jordan.block(USERS.lisa.id);
    // Both ways: the person blocked and the person who blocked.
    expect(await lisa.status(`/profiles/${USERS.jordan.id}`)).toBe(404);
    expect(await lisa.status(`/cards/${USERS.jordan.id}`)).toBe(404);
    expect(await jordan.status(`/profiles/${USERS.lisa.id}`)).toBe(404);

    await jordan.unblock(USERS.lisa.id);
    expect(await lisa.status(`/profiles/${USERS.jordan.id}`)).toBe(200);
    expect(await jordan.status(`/profiles/${USERS.lisa.id}`)).toBe(200);
  });

  it('hides a blocked parent’s child too', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    expect(await jordan.status(`/profiles/${MATEO.id}`)).toBe(200);
    await jordan.block(USERS.lisa.id);
    expect(await jordan.status(`/profiles/${MATEO.id}`)).toBe(404);
    // The family still sees their own child.
    expect(await (await as('parent')).status(`/profiles/${MATEO.id}`)).toBe(200);
  });

  it('hides a teen across a block, both ways', async () => {
    const { as } = await world();
    const noah = await as('teen');
    const jordan = await as('athlete');
    expect(await jordan.status(`/profiles/${USERS.noah.id}`)).toBe(200);
    await noah.block(USERS.jordan.id);
    expect(await jordan.status(`/profiles/${USERS.noah.id}`)).toBe(404);
    expect(await noah.status(`/profiles/${USERS.jordan.id}`)).toBe(404);
  });

  it('never hides anyone from staff', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    await jordan.block(USERS.lisa.id);
    const staff = await as('staff');
    expect(await staff.status(`/profiles/${USERS.jordan.id}`)).toBe(200);
    expect(await staff.status(`/profiles/${USERS.lisa.id}`)).toBe(200);
  });
});

describe('blocking: the roster', () => {
  it('drops a blocked parent, with their children, from the athlete’s roster, and vice versa', async () => {
    const { as } = await world();
    const jordan = await as('athlete');
    const lisa = await as('parent');
    expect(await jordan.rosterIds()).toContain(USERS.lisa.id);
    expect(await jordan.rosterIds()).toContain(MATEO.id);

    await jordan.block(USERS.lisa.id);
    const jordansRoster = await jordan.rosterIds();
    expect(jordansRoster).not.toContain(USERS.lisa.id);
    expect(jordansRoster).not.toContain(MATEO.id);
    expect(await lisa.rosterIds()).not.toContain(USERS.jordan.id);
    // Everyone else is still there.
    expect(jordansRoster).toContain(USERS.mark.id);
    expect(jordansRoster).toContain(USERS.coach.id);
  });

  it('drops the blocked athlete from the parent’s athlete contacts', async () => {
    const { as } = await world();
    const lisa = await as('parent');
    const contactIds = async () =>
      (
        (await lisa.get(`/teams/${TEAM}/athlete-contacts`)).body as { athlete: { id: string } }[]
      ).map((a) => a.athlete.id);
    expect(await contactIds()).toContain(USERS.jordan.id);
    await (await as('athlete')).block(USERS.lisa.id);
    expect(await contactIds()).not.toContain(USERS.jordan.id);
    expect(await contactIds()).toContain(USERS.sam.id);
  });

  it('never hides anyone from the team’s coaches or staff, who run the team', async () => {
    const { as } = await world();
    const lisa = await as('parent');
    await lisa.block(USERS.coach.id);
    const coach = await as('coach');
    expect(await coach.rosterIds()).toContain(USERS.lisa.id);
    expect(await coach.rosterIds()).toContain(MATEO.id);
    expect(await (await as('staff')).rosterIds()).toContain(USERS.lisa.id);
    // The parent chose to block the coach, so the coach leaves the parent's roster.
    expect(await lisa.rosterIds()).not.toContain(USERS.coach.id);
  });
});

describe('blocking: recruiters', () => {
  it('a blocked recruiter can’t find, open or save the athlete, and lists don’t break', async () => {
    const { as } = await world();
    const elena = await as('recruiter');
    const searchIds = async () =>
      ((await elena.get('/search/athletes')).body.items as { athleteId: string }[]).map(
        (c) => c.athleteId,
      );
    expect(await searchIds()).toContain(USERS.jordan.id);
    const before = (await elena.get('/lists')).body.find(
      (l: { id: string }) => l.id === FALL_INTERNS,
    );

    await (await as('athlete')).block(USERS.elena.id);
    expect(await searchIds()).not.toContain(USERS.jordan.id);
    expect(await elena.status(`/cards/${USERS.jordan.id}`)).toBe(404);
    expect(await elena.status(`/profiles/${USERS.jordan.id}`)).toBe(404);

    const list = await elena.get(`/lists/${FALL_INTERNS}`);
    expect(list.status).toBe(200);
    expect(
      list.body.entries.map((e: { card: { athleteId: string } }) => e.card.athleteId),
    ).not.toContain(USERS.jordan.id);
    const after = (await elena.get('/lists')).body.find(
      (l: { id: string }) => l.id === FALL_INTERNS,
    );
    expect(after.athleteCount).toBe(before.athleteCount - 1);
    const save = await elena.post(`/lists/${FALL_INTERNS}/athletes/${USERS.jordan.id}`);
    expect(save.status).toBe(404);
  });
});

describe('blocking: notifications', () => {
  const event = { title: 'Team dinner', startsAt: '2026-11-01T23:00:00.000Z', location: 'Dewick' };

  /** The coach creates an event and staff approve it, which notifies the team. */
  const coachEvent = async (as: Awaited<ReturnType<typeof world>>['as']) => {
    const created = await (await as('coach')).post(`/communities/${TEAM_COMMUNITY}/events`, event);
    expect(created.status).toBe(201);
    const staff = await as('staff');
    const ticket = (await staff.get('/staff/moderation/tickets')).body.find(
      (t: { target: { id: string }; status: string }) =>
        t.target.id === created.body.id && t.status === 'open',
    );
    expect(
      (
        await staff.post(`/staff/moderation/tickets/${ticket.id}/resolve`, {
          resolution: 'dismiss',
        })
      ).status,
    ).toBe(200);
    return created.body.id as string;
  };
  const eventNotes = async (person: {
    get: (u: string) => Promise<{ body: { items: { kind: string }[] } }>;
  }) => (await person.get('/notifications')).body.items.filter((n) => n.kind === 'event');

  it('nobody is told about the activity of someone they blocked', async () => {
    const { as } = await world();
    const lisa = await as('parent');
    // An unblocked teammate, for comparison.
    const jordan = await as('athlete');
    await lisa.block(USERS.coach.id);
    await coachEvent(as);
    expect(await eventNotes(lisa)).toHaveLength(0);
    expect(await eventNotes(jordan)).toHaveLength(1);
  });

  it('blocking someone clears their earlier notifications from your list', async () => {
    const { as } = await world();
    const lisa = await as('parent');
    await coachEvent(as);
    expect(await eventNotes(lisa)).toHaveLength(1);
    await lisa.block(USERS.coach.id);
    expect(await eventNotes(lisa)).toHaveLength(0);
  });

  it('a push is never sent across a block, while account notices still arrive', () => {
    // A push can't be taken back, so this is checked when it's sent, not only when the list is read.
    const w = new MockWorld({ identitySearch: true, medicalCommunities: true });
    const at = new Date().toISOString();
    w.devices.push({ userId: USERS.lisa.id, token: 'lisa-phone', platform: 'ios', createdAt: at });
    w.blocks.push({ blockerId: USERS.lisa.id, blockedId: USERS.coach.id, createdAt: at });
    const from = { userId: USERS.lisa.id, actorId: USERS.coach.id, communityId: TEAM_COMMUNITY };

    notify(w, { ...from, kind: 'event', text: 'Team dinner', target: { kind: 'event', id: 'e1' } });
    expect(w.notifications).toHaveLength(0);
    expect(w.pushOutbox).toHaveLength(0);

    // Being let into a community is about the reader's own account: it still arrives.
    notify(w, {
      ...from,
      kind: 'join_approved',
      text: 'You’re in',
      target: { kind: 'community', id: TEAM_COMMUNITY },
    });
    expect(w.notifications.map((n) => n.kind)).toEqual(['join_approved']);
    expect(w.pushOutbox).toHaveLength(1);
  });
});
